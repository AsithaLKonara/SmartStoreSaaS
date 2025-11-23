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
    product: {
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

describe('/api/warehouses/inventory', () => {
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

      const request = new MockNextRequest('http://localhost:3000/api/warehouses/inventory');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.message).toBe('Unauthorized');
    });

    it('should return inventory list', async () => {
      const mockProducts = [
        {
          id: 'product-1',
          name: 'Test Product',
          sku: 'SKU-001',
          stockQuantity: 10,
          lowStockThreshold: 5,
          updatedAt: new Date(),
          category: { name: 'Electronics' },
        },
      ];
      (prisma.product.findMany as jest.Mock).mockResolvedValue(mockProducts);

      const request = new MockNextRequest('http://localhost:3000/api/warehouses/inventory');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data[0].productName).toBe('Test Product');
      expect(data[0].quantity).toBe(10);
    });

    it('should calculate inventory status correctly', async () => {
      const mockProducts = [
        {
          id: 'product-1',
          name: 'Out of Stock',
          sku: 'SKU-001',
          stockQuantity: 0,
          lowStockThreshold: 5,
          updatedAt: new Date(),
          category: { name: 'Electronics' },
        },
        {
          id: 'product-2',
          name: 'Low Stock',
          sku: 'SKU-002',
          stockQuantity: 3,
          lowStockThreshold: 5,
          updatedAt: new Date(),
          category: { name: 'Electronics' },
        },
        {
          id: 'product-3',
          name: 'In Stock',
          sku: 'SKU-003',
          stockQuantity: 20,
          lowStockThreshold: 5,
          updatedAt: new Date(),
          category: { name: 'Electronics' },
        },
      ];
      (prisma.product.findMany as jest.Mock).mockResolvedValue(mockProducts);

      const request = new MockNextRequest('http://localhost:3000/api/warehouses/inventory');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data[0].status).toBe('out_of_stock');
      expect(data[1].status).toBe('low_stock');
      expect(data[2].status).toBe('in_stock');
    });

    it('should ensure organization data isolation', async () => {
      (prisma.product.findMany as jest.Mock).mockResolvedValue([]);

      const request = new MockNextRequest('http://localhost:3000/api/warehouses/inventory');
      await GET(request);

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org-1' },
        })
      );
    });

    it('should return 500 on server error', async () => {
      (prisma.product.findMany as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = new MockNextRequest('http://localhost:3000/api/warehouses/inventory');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe('Internal server error');
    });
  });
});

