import { GET, POST } from '../route';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';

// Mock NextRequest
class MockNextRequest {
  url: string;
  method: string;
  body: string;
  
  constructor(url: string, init?: any) {
    this.url = url;
    this.method = init?.method || 'GET';
    this.body = init?.body || '{}';
  }
  
  async json() {
    return JSON.parse(this.body);
  }
}

// Mock dependencies
jest.mock('@/lib/prisma', () => ({
  prisma: {
    warehouse: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  },
}));

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));

describe('/api/warehouses', () => {
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

      const request = new MockNextRequest('http://localhost:3000/api/warehouses');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.message).toBe('Unauthorized');
    });

    it('should return warehouses list', async () => {
      const mockWarehouses = [
        { id: 'warehouse-1', name: 'Main Warehouse', address: '123 Main St' },
      ];
      (prisma.warehouse.findMany as jest.Mock).mockResolvedValue(mockWarehouses);

      const request = new MockNextRequest('http://localhost:3000/api/warehouses');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data[0].name).toBe('Main Warehouse');
    });

    it('should ensure organization data isolation', async () => {
      (prisma.warehouse.findMany as jest.Mock).mockResolvedValue([]);

      const request = new MockNextRequest('http://localhost:3000/api/warehouses');
      await GET(request);

      expect(prisma.warehouse.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org-1' },
        })
      );
    });
  });

  describe('POST', () => {
    it('should return 401 for unauthorized requests', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: {} });

      const request = new MockNextRequest('http://localhost:3000/api/warehouses', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Warehouse', address: '123 Test St' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.message).toBe('Unauthorized');
    });

    it('should return 400 for missing required fields', async () => {
      const request = new MockNextRequest('http://localhost:3000/api/warehouses', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Warehouse' }), // Missing address
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toBe('Name and address are required');
    });

    it('should create warehouse successfully', async () => {
      const mockWarehouse = {
        id: 'warehouse-1',
        name: 'Test Warehouse',
        address: '123 Test St',
        organizationId: 'org-1',
        settings: {},
      };

      (prisma.warehouse.create as jest.Mock).mockResolvedValue(mockWarehouse);

      const request = new MockNextRequest('http://localhost:3000/api/warehouses', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Warehouse',
          address: '123 Test St',
          settings: { expirationTracking: { enabled: true } },
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.name).toBe('Test Warehouse');
      expect(prisma.warehouse.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Test Warehouse',
            address: '123 Test St',
            organizationId: 'org-1',
          }),
        })
      );
    });

    it('should return 500 on server error', async () => {
      (prisma.warehouse.findMany as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = new MockNextRequest('http://localhost:3000/api/warehouses');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe('Internal server error');
    });
  });
});

