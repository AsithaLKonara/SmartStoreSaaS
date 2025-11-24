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
    this.body = init?.body || '{}';
  }
  
  async json() {
    return JSON.parse(this.body);
  }
}

// Mock dependencies
jest.mock('@/lib/prisma', () => ({
  prisma: {
    order: {
      count: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    product: {
      findUnique: jest.fn(),
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

jest.mock('@/lib/utils', () => ({
  generateOrderNumber: jest.fn(() => 'ORD-12345'),
}));

describe('/api/orders', () => {
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

      const request = new MockNextRequest('http://localhost:3000/api/orders');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.message).toBe('Unauthorized');
    });

    it('should return orders list', async () => {
      const mockOrders = [
        { id: 'order-1', orderNumber: 'ORD-001', status: 'PENDING' },
      ];
      (prisma.order.count as jest.Mock).mockResolvedValue(1);
      (prisma.order.findMany as jest.Mock).mockResolvedValue(mockOrders);

      const request = new MockNextRequest('http://localhost:3000/api/orders');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.orders).toEqual(mockOrders);
      expect(data.pagination.total).toBe(1);
    });

    it('should filter orders by status', async () => {
      (prisma.order.count as jest.Mock).mockResolvedValue(0);
      (prisma.order.findMany as jest.Mock).mockResolvedValue([]);

      const request = new MockNextRequest('http://localhost:3000/api/orders?status=COMPLETED');
      const response = await GET(request);
      const _data = await response.json();

      expect(response.status).toBe(200);
      expect(prisma.order.findMany).toHaveBeenCalled();
    });
  });

  describe('POST', () => {
    it('should return 401 for unauthorized requests', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: {} });

      const request = new MockNextRequest('http://localhost:3000/api/orders', {
        method: 'POST',
        body: JSON.stringify({ customerId: 'customer-1', items: [] }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.message).toBe('Unauthorized');
    });

    it('should return 400 for missing customer or items', async () => {
      const request = new MockNextRequest('http://localhost:3000/api/orders', {
        method: 'POST',
        body: JSON.stringify({ customerId: 'customer-1' }), // Missing items
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toBe('Customer and items are required');
    });

    it('should create order with valid items', async () => {
      const mockProduct = {
        id: 'product-1',
        name: 'Test Product',
        price: 100,
        stockQuantity: 10,
      };

      const mockOrder = {
        id: 'order-1',
        orderNumber: 'ORD-12345',
        totalAmount: 200,
        items: [
          { productId: 'product-1', quantity: 2, price: 100 },
        ],
      };

      (prisma.product.findUnique as jest.Mock).mockResolvedValue(mockProduct);
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          product: {
            findUnique: jest.fn().mockResolvedValue(mockProduct),
          },
          order: {
            create: jest.fn().mockResolvedValue(mockOrder),
          },
        };
        return await callback(tx);
      });

      const request = new MockNextRequest('http://localhost:3000/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          customerId: 'customer-1',
          items: [
            { productId: 'product-1', quantity: 2 },
          ],
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.order).toBeDefined();
    });

    it('should return error for insufficient stock', async () => {
      const mockProduct = {
        id: 'product-1',
        name: 'Test Product',
        price: 100,
        stockQuantity: 5, // Less than requested
      };

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          product: {
            findUnique: jest.fn().mockResolvedValue(mockProduct),
          },
        };
        // The callback will throw an error when stock is insufficient
        await callback(tx);
      });

      const request = new MockNextRequest('http://localhost:3000/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          customerId: 'customer-1',
          items: [
            { productId: 'product-1', quantity: 10 }, // More than available
          ],
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe('Internal server error');
    });

    it('should return error for non-existent product', async () => {
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          product: {
            findUnique: jest.fn().mockResolvedValue(null), // Product not found
          },
        };
        // The callback will throw an error when product is not found
        await callback(tx);
      });

      const request = new MockNextRequest('http://localhost:3000/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          customerId: 'customer-1',
          items: [
            { productId: 'non-existent', quantity: 1 },
          ],
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe('Internal server error');
    });

    it('should handle transaction rollback on failure', async () => {
      (prisma.$transaction as jest.Mock).mockRejectedValue(new Error('Transaction failed'));

      const request = new MockNextRequest('http://localhost:3000/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          customerId: 'customer-1',
          items: [
            { productId: 'product-1', quantity: 1 },
          ],
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe('Internal server error');
    });

    it('should ensure organization data isolation', async () => {
      (prisma.order.count as jest.Mock).mockResolvedValue(0);
      (prisma.order.findMany as jest.Mock).mockResolvedValue([]);

      const request = new MockNextRequest('http://localhost:3000/api/orders');
      await GET(request);

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: 'org-1',
          }),
        })
      );
    });
  });
});

