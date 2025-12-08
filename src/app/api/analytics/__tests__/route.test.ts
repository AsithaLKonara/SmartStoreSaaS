import { GET } from '../route';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';

// Mock Next.js server components
jest.mock('next/server', () => ({
  NextRequest: class {
  url: string;
  method: string;
    body: unknown;
  constructor(url: string, init?: { method?: string; body?: unknown }) {
    this.url = url;
    this.method = init?.method || 'GET';
      this.body = init?.body;
    }
    json() {
      return Promise.resolve(JSON.parse(this.body || '{}'));
  }
  },
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      json: () => Promise.resolve(data),
      status: init?.status || 200,
    }),
  },
}));

// Mock dependencies
jest.mock('@/lib/prisma', () => ({
  prisma: {
    order: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    customer: {
      findMany: jest.fn(),
    },
    product: {
      findMany: jest.fn(),
    },
    payment: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));

describe('Analytics API Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/analytics', () => {
    it('should return analytics for authenticated user', async () => {
  const mockSession = {
    user: {
      id: 'user-1',
          email: 'test@example.com',
      organizationId: 'org-1',
    },
  };

      const mockOrders = [
        {
          id: 'order-1',
          totalAmount: 100.00,
          createdAt: new Date(),
          customer: { id: 'cust-1', name: 'Test Customer' },
          items: [
            {
              productId: 'prod-1',
              quantity: 2,
              price: 50.00,
              product: { id: 'prod-1', name: 'Test Product' },
            },
          ],
        },
      ];

      const mockCustomers = [
        { id: 'cust-1', name: 'Test Customer', createdAt: new Date() },
      ];

      const mockProducts = [
        { id: 'prod-1', name: 'Test Product', isActive: true },
      ];

      const mockPayments = [
        {
          id: 'payment-1',
          amount: 100.00,
          method: 'STRIPE',
          status: 'COMPLETED',
          createdAt: new Date(),
        },
      ];

      (getServerSession as jest.Mock).mockResolvedValue(mockSession);
      (prisma.order.findMany as jest.Mock).mockResolvedValue(mockOrders);
      (prisma.customer.findMany as jest.Mock).mockResolvedValue(mockCustomers);
      (prisma.product.findMany as jest.Mock).mockResolvedValue(mockProducts);
      (prisma.payment.findMany as jest.Mock).mockResolvedValue(mockPayments);

      const request = { url: 'http://localhost:3000/api/analytics?range=30' } as { url: string };
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('revenue');
      expect(data).toHaveProperty('orders');
      expect(data).toHaveProperty('customers');
      expect(data).toHaveProperty('products');
      expect(data).toHaveProperty('salesByDay');
      expect(data).toHaveProperty('topProducts');
      expect(data).toHaveProperty('topCustomers');
      expect(data).toHaveProperty('paymentMethods');
    });

    it('should return 401 for unauthenticated user', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(null);

      const request = { url: 'http://localhost:3000/api/analytics' } as { url: string };
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.message).toBe('Unauthorized');
    });

    it('should return 401 for user without organizationId', async () => {
      const mockSession = {
        user: {
          id: 'user-1',
          email: 'test@example.com',
        },
      };

      (getServerSession as jest.Mock).mockResolvedValue(mockSession);

      const request = { url: 'http://localhost:3000/api/analytics' } as { url: string };
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.message).toBe('Unauthorized');
    });

    it('should handle different time ranges', async () => {
      const mockSession = {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          organizationId: 'org-1',
        },
      };

      (getServerSession as jest.Mock).mockResolvedValue(mockSession);
      (prisma.order.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.customer.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.product.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.payment.findMany as jest.Mock).mockResolvedValue([]);

      const request = { url: 'http://localhost:3000/api/analytics?range=7' } as { url: string };
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.salesByDay).toHaveLength(7);
    });

    it('should calculate revenue change correctly', async () => {
      const mockSession = {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          organizationId: 'org-1',
        },
      };

      const currentOrders = [
        { id: 'order-1', totalAmount: 200.00, createdAt: new Date() },
      ];

      const previousOrders = [
        { id: 'order-2', totalAmount: 100.00, createdAt: new Date() },
      ];

      (getServerSession as jest.Mock).mockResolvedValue(mockSession);
      (prisma.order.findMany as jest.Mock)
        .mockResolvedValueOnce(currentOrders)
        .mockResolvedValueOnce(previousOrders);
      (prisma.customer.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.product.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.payment.findMany as jest.Mock).mockResolvedValue([]);

      const request = { url: 'http://localhost:3000/api/analytics?range=30' } as { url: string };
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.revenue.change).toBeGreaterThan(0);
      expect(data.revenue.trend).toBe('up');
    });
  });
});
