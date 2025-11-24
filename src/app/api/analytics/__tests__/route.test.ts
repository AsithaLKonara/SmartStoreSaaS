import { GET } from '../route';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';

// Mock NextRequest
class MockNextRequest {
  url: string;
  method: string;
  
  constructor(url: string, init?: { method?: string; body?: unknown }) {
    this.url = url;
    this.method = init?.method || 'GET';
  }
}

// Mock dependencies
jest.mock('@/lib/prisma', () => ({
  prisma: {
    order: {
      findMany: jest.fn(),
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

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));

describe('/api/analytics', () => {
  const mockSession = {
    user: {
      id: 'user-1',
      organizationId: 'org-1',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getServerSession as jest.Mock).mockResolvedValue(mockSession);
  });

  describe('GET', () => {
    it('should return 401 for unauthorized requests', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: {} });

      const request = new MockNextRequest('http://localhost:3000/api/analytics');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.message).toBe('Unauthorized');
    });

    it('should return analytics data', async () => {
      const mockOrders = [
        {
          id: 'order-1',
          totalAmount: 100,
          createdAt: new Date(),
          customer: { id: 'customer-1', name: 'Test Customer' },
          items: [
            { productId: 'product-1', price: 50, quantity: 2, product: { name: 'Test Product' } },
          ],
        },
      ];
      const mockCustomers = [{ id: 'customer-1', name: 'Test Customer' }];
      const mockProducts = [{ id: 'product-1', name: 'Test Product' }];
      const mockPayments = [{ method: 'CARD', amount: 100 }];

      (prisma.order.findMany as jest.Mock).mockResolvedValueOnce(mockOrders).mockResolvedValueOnce([]);
      (prisma.customer.findMany as jest.Mock).mockResolvedValueOnce(mockCustomers).mockResolvedValueOnce([]);
      (prisma.product.findMany as jest.Mock).mockResolvedValue(mockProducts);
      (prisma.payment.findMany as jest.Mock).mockResolvedValue(mockPayments);

      const request = new MockNextRequest('http://localhost:3000/api/analytics');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.revenue).toBeDefined();
      expect(data.orders).toBeDefined();
      expect(data.customers).toBeDefined();
      expect(data.products).toBeDefined();
    });

    it('should calculate revenue correctly', async () => {
      const mockOrders = [
        { id: 'order-1', totalAmount: 100, createdAt: new Date(), customer: {}, items: [] },
        { id: 'order-2', totalAmount: 200, createdAt: new Date(), customer: {}, items: [] },
      ];

      (prisma.order.findMany as jest.Mock).mockResolvedValueOnce(mockOrders).mockResolvedValueOnce([]);
      (prisma.customer.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.product.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.payment.findMany as jest.Mock).mockResolvedValue([]);

      const request = new MockNextRequest('http://localhost:3000/api/analytics');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.revenue.total).toBe(300);
    });

    it('should calculate revenue change percentage', async () => {
      const currentOrders = [{ id: 'order-1', totalAmount: 200, createdAt: new Date(), customer: {}, items: [] }];
      const previousOrders = [{ id: 'order-2', totalAmount: 100, createdAt: new Date(), customer: {}, items: [] }];

      (prisma.order.findMany as jest.Mock).mockResolvedValueOnce(currentOrders).mockResolvedValueOnce(previousOrders);
      (prisma.customer.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.product.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.payment.findMany as jest.Mock).mockResolvedValue([]);

      const request = new MockNextRequest('http://localhost:3000/api/analytics');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.revenue.change).toBe(100); // 100% increase
      expect(data.revenue.trend).toBe('up');
    });

    it('should return top products', async () => {
      const mockOrders = [
        {
          id: 'order-1',
          totalAmount: 100,
          createdAt: new Date(),
          customer: { id: 'customer-1', name: 'Test Customer' },
          items: [
            { productId: 'product-1', price: 50, quantity: 2, product: { name: 'Product A' } },
            { productId: 'product-2', price: 30, quantity: 1, product: { name: 'Product B' } },
          ],
        },
      ];

      (prisma.order.findMany as jest.Mock).mockResolvedValueOnce(mockOrders).mockResolvedValueOnce([]);
      (prisma.customer.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.product.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.payment.findMany as jest.Mock).mockResolvedValue([]);

      const request = new MockNextRequest('http://localhost:3000/api/analytics');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.topProducts).toBeDefined();
      expect(Array.isArray(data.topProducts)).toBe(true);
    });

    it('should return top customers', async () => {
      const mockOrders = [
        {
          id: 'order-1',
          totalAmount: 100,
          createdAt: new Date(),
          customerId: 'customer-1',
          customer: { id: 'customer-1', name: 'Customer A' },
          items: [],
        },
        {
          id: 'order-2',
          totalAmount: 200,
          createdAt: new Date(),
          customerId: 'customer-1',
          customer: { id: 'customer-1', name: 'Customer A' },
          items: [],
        },
      ];

      (prisma.order.findMany as jest.Mock).mockResolvedValueOnce(mockOrders).mockResolvedValueOnce([]);
      (prisma.customer.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.product.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.payment.findMany as jest.Mock).mockResolvedValue([]);

      const request = new MockNextRequest('http://localhost:3000/api/analytics');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.topCustomers).toBeDefined();
      expect(Array.isArray(data.topCustomers)).toBe(true);
    });

    it('should respect date range parameter', async () => {
      (prisma.order.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.customer.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.product.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.payment.findMany as jest.Mock).mockResolvedValue([]);

      const request = new MockNextRequest('http://localhost:3000/api/analytics?range=60');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(prisma.order.findMany).toHaveBeenCalled();
    });

    it('should ensure organization data isolation', async () => {
      (prisma.order.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.customer.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.product.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.payment.findMany as jest.Mock).mockResolvedValue([]);

      const request = new MockNextRequest('http://localhost:3000/api/analytics');
      await GET(request);

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: 'org-1',
          }),
        })
      );
    });

    it('should return 500 on server error', async () => {
      (prisma.order.findMany as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = new MockNextRequest('http://localhost:3000/api/analytics');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe('Internal server error');
    });
  });
});

