import { GET } from '../route';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';

// Mock NextRequest
class MockNextRequest {
  url: string;
  method: string;
  
  constructor(url: string, init?: any) {
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
      count: jest.fn(),
    },
    product: {
      count: jest.fn(),
    },
  },
}));

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));

describe('/api/analytics/dashboard-stats', () => {
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

      const request = new MockNextRequest('http://localhost:3000/api/analytics/dashboard-stats');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.message).toBe('Unauthorized');
    });

    it('should return dashboard stats', async () => {
      const mockOrders = [
        { id: 'order-1', totalAmount: 100 },
        { id: 'order-2', totalAmount: 200 },
      ];
      const mockCustomers = [{ id: 'customer-1' }];

      (prisma.order.findMany as jest.Mock).mockResolvedValueOnce(mockOrders).mockResolvedValueOnce([]);
      (prisma.customer.findMany as jest.Mock).mockResolvedValueOnce(mockCustomers).mockResolvedValueOnce([]);
      (prisma.customer.count as jest.Mock).mockResolvedValue(5);
      (prisma.product.count as jest.Mock).mockResolvedValue(10);

      const request = new MockNextRequest('http://localhost:3000/api/analytics/dashboard-stats');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.totalRevenue).toBe(300);
      expect(data.totalOrders).toBe(2);
      expect(data.totalCustomers).toBe(5);
      expect(data.totalProducts).toBe(10);
    });

    it('should calculate change percentages correctly', async () => {
      const currentOrders = [{ id: 'order-1', totalAmount: 200 }];
      const previousOrders = [{ id: 'order-2', totalAmount: 100 }];
      const currentCustomers = [{ id: 'customer-1' }];
      const previousCustomers = [{ id: 'customer-2' }];

      (prisma.order.findMany as jest.Mock).mockResolvedValueOnce(currentOrders).mockResolvedValueOnce(previousOrders);
      (prisma.customer.findMany as jest.Mock).mockResolvedValueOnce(currentCustomers).mockResolvedValueOnce(previousCustomers);
      (prisma.customer.count as jest.Mock).mockResolvedValue(5);
      (prisma.product.count as jest.Mock).mockResolvedValue(10);

      const request = new MockNextRequest('http://localhost:3000/api/analytics/dashboard-stats');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.revenueChange).toBe(100); // 100% increase
      expect(data.ordersChange).toBe(100);
      expect(data.customersChange).toBe(100);
    });

    it('should handle zero previous period data', async () => {
      const currentOrders = [{ id: 'order-1', totalAmount: 100 }];
      const currentCustomers = [{ id: 'customer-1' }];

      (prisma.order.findMany as jest.Mock).mockResolvedValueOnce(currentOrders).mockResolvedValueOnce([]);
      (prisma.customer.findMany as jest.Mock).mockResolvedValueOnce(currentCustomers).mockResolvedValueOnce([]);
      (prisma.customer.count as jest.Mock).mockResolvedValue(1);
      (prisma.product.count as jest.Mock).mockResolvedValue(5);

      const request = new MockNextRequest('http://localhost:3000/api/analytics/dashboard-stats');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.revenueChange).toBe(100); // 100% when previous is 0
      expect(data.ordersChange).toBe(100);
    });

    it('should ensure organization data isolation', async () => {
      (prisma.order.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.customer.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.customer.count as jest.Mock).mockResolvedValue(0);
      (prisma.product.count as jest.Mock).mockResolvedValue(0);

      const request = new MockNextRequest('http://localhost:3000/api/analytics/dashboard-stats');
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

      const request = new MockNextRequest('http://localhost:3000/api/analytics/dashboard-stats');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe('Internal server error');
    });
  });
});

