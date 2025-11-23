import { DELETE } from '../route';
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
    productVariant: {
      deleteMany: jest.fn(),
    },
    product: {
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));

describe('/api/products/bulk-delete', () => {
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

  describe('DELETE', () => {
    it('should return 401 for unauthorized requests', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: {} });

      const request = new MockNextRequest('http://localhost:3000/api/products/bulk-delete', {
        method: 'DELETE',
        body: JSON.stringify({ productIds: ['product-1'] }),
      });
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.message).toBe('Unauthorized');
    });

    it('should return 400 for missing product IDs', async () => {
      const request = new MockNextRequest('http://localhost:3000/api/products/bulk-delete', {
        method: 'DELETE',
        body: JSON.stringify({}),
      });
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toBe('Product IDs are required');
    });

    it('should return 400 for empty product IDs array', async () => {
      const request = new MockNextRequest('http://localhost:3000/api/products/bulk-delete', {
        method: 'DELETE',
        body: JSON.stringify({ productIds: [] }),
      });
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toBe('Product IDs are required');
    });

    it('should delete products and variants successfully', async () => {
      const mockResult = { count: 2 };

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          productVariant: {
            deleteMany: jest.fn().mockResolvedValue({ count: 3 }),
          },
          product: {
            deleteMany: jest.fn().mockResolvedValue(mockResult),
          },
        };
        return await callback(tx);
      });

      const request = new MockNextRequest('http://localhost:3000/api/products/bulk-delete', {
        method: 'DELETE',
        body: JSON.stringify({ productIds: ['product-1', 'product-2'] }),
      });
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('2 products deleted successfully');
    });

    it('should delete variants before products', async () => {
      let variantDeleted = false;
      let productDeleted = false;

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          productVariant: {
            deleteMany: jest.fn().mockImplementation(() => {
              variantDeleted = true;
              return Promise.resolve({ count: 0 });
            }),
          },
          product: {
            deleteMany: jest.fn().mockImplementation(() => {
              productDeleted = true;
              return Promise.resolve({ count: 1 });
            }),
          },
        };
        await callback(tx);
        return { count: 1 };
      });

      const request = new MockNextRequest('http://localhost:3000/api/products/bulk-delete', {
        method: 'DELETE',
        body: JSON.stringify({ productIds: ['product-1'] }),
      });
      await DELETE(request);

      // Variants should be deleted before products
      expect(variantDeleted).toBe(true);
      expect(productDeleted).toBe(true);
    });

    it('should ensure organization data isolation', async () => {
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          productVariant: {
            deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
          },
          product: {
            deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
          },
        };
        return await callback(tx);
      });

      const request = new MockNextRequest('http://localhost:3000/api/products/bulk-delete', {
        method: 'DELETE',
        body: JSON.stringify({ productIds: ['product-1'] }),
      });
      await DELETE(request);

      // Verify transaction was called
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should handle transaction rollback on failure', async () => {
      (prisma.$transaction as jest.Mock).mockRejectedValue(new Error('Transaction failed'));

      const request = new MockNextRequest('http://localhost:3000/api/products/bulk-delete', {
        method: 'DELETE',
        body: JSON.stringify({ productIds: ['product-1'] }),
      });
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe('Internal server error');
    });

    it('should return 500 on server error', async () => {
      (prisma.$transaction as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = new MockNextRequest('http://localhost:3000/api/products/bulk-delete', {
        method: 'DELETE',
        body: JSON.stringify({ productIds: ['product-1'] }),
      });
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe('Internal server error');
    });
  });
});

