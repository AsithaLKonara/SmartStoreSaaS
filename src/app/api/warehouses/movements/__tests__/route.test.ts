// @ts-nocheck
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
    inventoryMovement: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    product: {
      findUnique: jest.fn(),
      update: jest.fn(),
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

describe('/api/warehouses/movements', () => {
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

      const request = new MockNextRequest('http://localhost:3000/api/warehouses/movements');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.message).toBe('Unauthorized');
    });

    it('should return movements list', async () => {
      const mockMovements = [
        {
          id: 'movement-1',
          productId: 'product-1',
          type: 'in',
          quantity: 10,
          product: { id: 'product-1', name: 'Test Product', organizationId: 'org-1' },
          warehouse: { id: 'warehouse-1', name: 'Main Warehouse' },
          createdBy: { id: 'user-1', name: 'Test User' },
          createdAt: new Date(),
        },
      ];
      (prisma.inventoryMovement.findMany as jest.Mock).mockResolvedValue(mockMovements);

      const request = new MockNextRequest('http://localhost:3000/api/warehouses/movements');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data[0].productName).toBe('Test Product');
    });

    it('should ensure organization data isolation', async () => {
      (prisma.inventoryMovement.findMany as jest.Mock).mockResolvedValue([]);

      const request = new MockNextRequest('http://localhost:3000/api/warehouses/movements');
      await GET(request);

      expect(prisma.inventoryMovement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            product: expect.objectContaining({
              organizationId: 'org-1',
            }),
          }),
        })
      );
    });
  });

  describe('POST', () => {
    it('should return 401 for unauthorized requests', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: {} });

      const request = new MockNextRequest('http://localhost:3000/api/warehouses/movements', {
        method: 'POST',
        body: JSON.stringify({ productId: 'product-1', type: 'in', quantity: 10, reason: 'Restock' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.message).toBe('Unauthorized');
    });

    it('should return 400 for missing required fields', async () => {
      const request = new MockNextRequest('http://localhost:3000/api/warehouses/movements', {
        method: 'POST',
        body: JSON.stringify({ productId: 'product-1' }), // Missing type, quantity, reason
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toBe('Missing required fields');
    });

    it('should return 404 for non-existent product', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new MockNextRequest('http://localhost:3000/api/warehouses/movements', {
        method: 'POST',
        body: JSON.stringify({
          productId: 'non-existent',
          type: 'in',
          quantity: 10,
          reason: 'Restock',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.message).toBe('Product not found');
    });

    it('should create stock-in movement successfully', async () => {
      const mockProduct = {
        id: 'product-1',
        stockQuantity: 10,
        organizationId: 'org-1',
      };
      const mockMovement = {
        id: 'movement-1',
        productId: 'product-1',
        type: 'in',
        quantity: 5,
        product: { id: 'product-1', name: 'Test Product' },
        warehouse: { id: 'warehouse-1', name: 'Main Warehouse' },
        createdBy: { id: 'user-1', name: 'Test User' },
        createdAt: new Date(),
        fromLocation: null,
        toLocation: null,
        reason: 'Restock',
      };

      (prisma.product.findUnique as jest.Mock).mockResolvedValue(mockProduct);
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          product: {
            update: jest.fn().mockResolvedValue({ ...mockProduct, stockQuantity: 15 }),
          },
          inventoryMovement: {
            create: jest.fn().mockResolvedValue(mockMovement),
          },
        };
        return await callback(tx);
      });

      const request = new MockNextRequest('http://localhost:3000/api/warehouses/movements', {
        method: 'POST',
        body: JSON.stringify({
          productId: 'product-1',
          type: 'in',
          quantity: 5,
          reason: 'Restock',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.type).toBe('in');
      expect(data.quantity).toBe(5);
    });

    it('should create stock-out movement successfully', async () => {
      const mockProduct = {
        id: 'product-1',
        stockQuantity: 10,
        organizationId: 'org-1',
      };
      const mockMovement = {
        id: 'movement-1',
        productId: 'product-1',
        type: 'out',
        quantity: 3,
        product: { id: 'product-1', name: 'Test Product' },
        warehouse: null,
        createdBy: { id: 'user-1', name: 'Test User' },
        createdAt: new Date(),
        fromLocation: null,
        toLocation: null,
        reason: 'Sale',
      };

      (prisma.product.findUnique as jest.Mock).mockResolvedValue(mockProduct);
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          product: {
            update: jest.fn().mockResolvedValue({ ...mockProduct, stockQuantity: 7 }),
          },
          inventoryMovement: {
            create: jest.fn().mockResolvedValue(mockMovement),
          },
        };
        return await callback(tx);
      });

      const request = new MockNextRequest('http://localhost:3000/api/warehouses/movements', {
        method: 'POST',
        body: JSON.stringify({
          productId: 'product-1',
          type: 'out',
          quantity: 3,
          reason: 'Sale',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.type).toBe('out');
    });

    it('should return 400 for insufficient stock on stock-out', async () => {
      const mockProduct = {
        id: 'product-1',
        stockQuantity: 5,
        organizationId: 'org-1',
      };

      (prisma.product.findUnique as jest.Mock).mockResolvedValue(mockProduct);

      const request = new MockNextRequest('http://localhost:3000/api/warehouses/movements', {
        method: 'POST',
        body: JSON.stringify({
          productId: 'product-1',
          type: 'out',
          quantity: 10, // More than available
          reason: 'Sale',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toBe('Insufficient stock');
    });

    it('should ensure organization data isolation', async () => {
      const mockProduct = {
        id: 'product-1',
        stockQuantity: 10,
        organizationId: 'other-org', // Different organization
      };

      (prisma.product.findUnique as jest.Mock).mockResolvedValue(mockProduct);

      const request = new MockNextRequest('http://localhost:3000/api/warehouses/movements', {
        method: 'POST',
        body: JSON.stringify({
          productId: 'product-1',
          type: 'in',
          quantity: 5,
          reason: 'Restock',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.message).toBe('Product not found');
    });

    it('should return 500 on server error', async () => {
      (prisma.inventoryMovement.findMany as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = new MockNextRequest('http://localhost:3000/api/warehouses/movements');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe('Internal server error');
    });
  });
});

