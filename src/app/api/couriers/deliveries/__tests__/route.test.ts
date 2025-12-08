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
  },
}));

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));

describe('/api/couriers/deliveries', () => {
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

      const request = new MockNextRequest('http://localhost:3000/api/couriers/deliveries');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.message).toBe('Unauthorized');
    });

    it('should return deliveries list', async () => {
      const mockOrders = [
        {
          id: 'order-1',
          orderNumber: 'ORD-001',
          status: 'CONFIRMED',
          customer: { name: 'Test Customer' },
          shipments: [{ courierId: 'courier-1', courier: { name: 'Fast Delivery' } }],
          metadata: { shippingAddress: '123 Main St' },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      (prisma.order.findMany as jest.Mock).mockResolvedValue(mockOrders);

      const request = new MockNextRequest('http://localhost:3000/api/couriers/deliveries');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data[0].orderNumber).toBe('ORD-001');
      expect(data[0].customerName).toBe('Test Customer');
    });

    it('should ensure organization data isolation', async () => {
      (prisma.order.findMany as jest.Mock).mockResolvedValue([]);

      const request = new MockNextRequest('http://localhost:3000/api/couriers/deliveries');
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

      const request = new MockNextRequest('http://localhost:3000/api/couriers/deliveries');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe('Internal server error');
    });
  });
});

