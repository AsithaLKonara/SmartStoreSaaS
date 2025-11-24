import { GET, POST } from '../route';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';

// Mock Next.js server components
jest.mock('next/server', () => ({
  NextRequest: class {
    url: string;
    method: string;
    body: unknown;
    constructor(url: string, init?: { method?: string; body?: unknown }) {
      this.url = url;
      this.method = init?.method || 'GET';
      this.body = init?.body;
    }
    json() {
      return Promise.resolve(JSON.parse(this.body || '{}'));
    }
  },
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      json: () => Promise.resolve(data),
      status: init?.status || 200,
    }),
  },
}));

// Mock dependencies
jest.mock('@/lib/prisma', () => ({
  prisma: {
    product: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
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

describe('Products API Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/products', () => {
    it('should return products for authenticated user', async () => {
      const mockSession = {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          organizationId: 'org-1',
        },
      };

      const mockProducts = [
        {
          id: 'product-1',
          name: 'Test Product',
          price: 99.99,
          stock: 10,
          organizationId: 'org-1',
        },
      ];

      (getServerSession as jest.Mock).mockResolvedValue(mockSession);
      (prisma.product.findMany as jest.Mock).mockResolvedValue(mockProducts);
      (prisma.product.count as jest.Mock).mockResolvedValue(1);

      const request = { url: 'http://localhost:3000/api/products' } as NextRequest;
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.products).toBeDefined();
      expect(data.products).toHaveLength(1);
      expect(data.pagination).toBeDefined();
      expect(data.pagination.total).toBe(1);
    });

    it('should return 401 for unauthenticated user', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(null);

      const request = { url: 'http://localhost:3000/api/products' } as NextRequest;
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.message).toBe('Unauthorized');
    });

    it('should handle pagination', async () => {
      const mockSession = {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          organizationId: 'org-1',
        },
      };

      const mockProducts = Array.from({ length: 10 }, (_, i) => ({
        id: `product-${i}`,
        name: `Product ${i}`,
        price: 99.99,
        stock: 10,
        organizationId: 'org-1',
      }));

      (getServerSession as jest.Mock).mockResolvedValue(mockSession);
      (prisma.product.findMany as jest.Mock).mockResolvedValue(mockProducts);
      (prisma.product.count as jest.Mock).mockResolvedValue(25);

      const request = { url: 'http://localhost:3000/api/products?page=1&limit=10' } as { url: string };
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.products).toHaveLength(10);
      expect(data.pagination).toBeDefined();
      expect(data.pagination.total).toBe(25);
      expect(data.pagination.page).toBe(1);
      expect(data.pagination.limit).toBe(10);
    });

    it('should filter products by search query', async () => {
      const mockSession = {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          organizationId: 'org-1',
        },
      };

      const mockProducts = [
        {
          id: 'product-1',
          name: 'Test Product',
          price: 99.99,
          stock: 10,
          organizationId: 'org-1',
        },
      ];

      (getServerSession as jest.Mock).mockResolvedValue(mockSession);
      (prisma.product.findMany as jest.Mock).mockResolvedValue(mockProducts);
      (prisma.product.count as jest.Mock).mockResolvedValue(1);

      const request = { url: 'http://localhost:3000/api/products?search=Test' } as { url: string };
      const response = await GET(request);
      const _data = await response.json();

      expect(response.status).toBe(200);
      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({
                name: expect.objectContaining({
                  contains: 'Test',
                  mode: 'insensitive',
                }),
              }),
            ]),
          }),
        })
      );
    });
  });

  describe('POST /api/products', () => {
    it('should create product for authenticated user', async () => {
      const mockSession = {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          organizationId: 'org-1',
        },
      };

      const mockProduct = {
        id: 'product-1',
        name: 'New Product',
        price: 99.99,
        stock: 10,
        organizationId: 'org-1',
      };

      (getServerSession as jest.Mock).mockResolvedValue(mockSession);
      (prisma.product.findFirst as jest.Mock).mockResolvedValue(null); // No existing SKU
      (prisma.product.create as jest.Mock).mockResolvedValue(mockProduct);

      const request = {
        url: 'http://localhost:3000/api/products',
        method: 'POST',
        json: async () => ({
          name: 'New Product',
          price: 99.99,
          costPrice: 50.00,
          sku: 'TEST-SKU-001',
          categoryId: 'category-1',
          stockQuantity: 10,
        })
      } as { url: string; json: () => Promise<unknown> };

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.product).toBeDefined();
      expect(data.product.name).toBe('New Product');
    });

    it('should return 401 for unauthenticated user', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(null);

      const request = {
        url: 'http://localhost:3000/api/products',
        method: 'POST',
        json: async () => ({
          name: 'New Product',
          price: 99.99,
        })
      } as { url: string; json: () => Promise<unknown> };

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.message).toBe('Unauthorized');
    });

    it('should validate required fields', async () => {
      const mockSession = {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          organizationId: 'org-1',
        },
      };

      (getServerSession as jest.Mock).mockResolvedValue(mockSession);

      const request = {
        url: 'http://localhost:3000/api/products',
        method: 'POST',
        json: async () => ({
          // Missing required fields
        })
      } as { url: string; json: () => Promise<unknown> };

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toBeDefined();
    });
  });
});

