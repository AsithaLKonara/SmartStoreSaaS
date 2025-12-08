import { GET } from '../route';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';

// Mock NextRequest
class MockNextRequest {
  url: string;
  method: string;
  
  constructor(url: string, init?: { method?: string }) {
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
        { id: 'order-1', totalAmount: 100, createdAt: new Date() },
        { id: 'order-2', totalAmount: 200, createdAt: new Date() },
      ];
      const mockCustomers = [
        { id: 'cust-1', createdAt: new Date() },
      ];
      
      (prisma.order.findMany as jest.Mock)
        .mockResolvedValueOnce(mockOrders) // current period
        .mockResolvedValueOnce([]) // previous period
        .mockResolvedValueOnce(mockOrders) // current period for customers
        .mockResolvedValueOnce([]); // previous period for customers
      
      (prisma.customer.findMany as jest.Mock)
        .mockResolvedValueOnce(mockCustomers) // current period
        .mockResolvedValueOnce([]); // previous period
      
      (prisma.product.count as jest.Mock).mockResolvedValue(10);
      (prisma.customer.count as jest.Mock).mockResolvedValue(5);

      const request = new MockNextRequest('http://localhost:3000/api/analytics/dashboard-stats');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toBeDefined();
      expect(data.totalRevenue).toBeDefined();
      expect(data.revenueChange).toBeDefined();
    });

    it('should ensure organization data isolation', async () => {
      (prisma.order.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.customer.findMany as jest.Mock).mockResolvedValue([]);

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
