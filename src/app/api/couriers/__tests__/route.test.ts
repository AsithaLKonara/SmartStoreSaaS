import { GET, POST } from '../route';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';

// Mock NextRequest
class MockNextRequest {
  url: string;
  method: string;
  body: string;
  
  constructor(url: string, init?: { method?: string; body?: unknown }) {
    this.url = url;
    this.method = init?.method || 'GET';
    this.body = typeof init?.body === 'string' ? init.body : JSON.stringify(init?.body || {});
  }
  
  async json() {
    return JSON.parse(this.body);
  }
}

// Mock dependencies
jest.mock('@/lib/prisma', () => ({
  prisma: {
    courier: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    courierRating: {
      aggregate: jest.fn(),
    },
    courierDelivery: {
      aggregate: jest.fn(),
      findFirst: jest.fn(),
    },
  },
}));

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));

describe('/api/couriers', () => {
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

      const request = new MockNextRequest('http://localhost:3000/api/couriers');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.message).toBe('Unauthorized');
    });

    it('should return couriers list with stats', async () => {
      const mockCouriers = [
        {
          id: 'courier-1',
          name: 'Fast Delivery',
          code: 'FAST',
          organizationId: 'org-1',
          deliveries: [],
          ratings: [],
        },
      ];
      (prisma.courier.findMany as jest.Mock).mockResolvedValue(mockCouriers);
      (prisma.courierRating.aggregate as jest.Mock).mockResolvedValue({ _avg: { rating: 4.5 } });
      (prisma.courierDelivery.aggregate as jest.Mock).mockResolvedValue({ _sum: { earnings: 1000 } });
      (prisma.courierDelivery.findFirst as jest.Mock).mockResolvedValue(null);

      const request = new MockNextRequest('http://localhost:3000/api/couriers');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data[0].name).toBe('Fast Delivery');
      expect(data[0].rating).toBe(4.5);
    });

    it('should ensure organization data isolation', async () => {
      (prisma.courier.findMany as jest.Mock).mockResolvedValue([]);

      const request = new MockNextRequest('http://localhost:3000/api/couriers');
      await GET(request);

      expect(prisma.courier.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org-1' },
        })
      );
    });

    it('should return 500 on server error', async () => {
      (prisma.courier.findMany as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = new MockNextRequest('http://localhost:3000/api/couriers');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe('Internal server error');
    });
  });

  describe('POST', () => {
    it('should return 401 for unauthorized requests', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: {} });

      const request = new MockNextRequest('http://localhost:3000/api/couriers', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Courier', code: 'TEST' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.message).toBe('Unauthorized');
    });

    it('should return 400 for missing required fields', async () => {
      const request = new MockNextRequest('http://localhost:3000/api/couriers', {
        method: 'POST',
        body: JSON.stringify({}), // Missing name
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toBe('Name is required');
    });

    it('should create courier successfully', async () => {
      const mockCourier = {
        id: 'courier-1',
        name: 'Test Courier',
        code: 'TEST',
        organizationId: 'org-1',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      (prisma.courier.create as jest.Mock).mockResolvedValue(mockCourier);

      const request = new MockNextRequest('http://localhost:3000/api/couriers', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Courier',
          code: 'TEST',
          apiKey: 'test-key',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.name).toBe('Test Courier');
      expect(prisma.courier.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Test Courier',
            code: 'TEST',
            organizationId: 'org-1',
          }),
        })
      );
    });

    it('should return 500 on server error', async () => {
      (prisma.courier.create as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = new MockNextRequest('http://localhost:3000/api/couriers', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Courier',
          code: 'TEST',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe('Internal server error');
    });
  });
});

