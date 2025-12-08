import { GET, POST } from '../route';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { aiInventoryService } from '@/lib/ai/inventoryService';

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

jest.mock('@/lib/prisma', () => ({
  prisma: {
    product: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    order: {
      findMany: jest.fn(),
    },
    purchaseOrder: {
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

jest.mock('@/lib/ai/inventoryService', () => ({
  aiInventoryService: {
    predictStockoutRisk: jest.fn(),
    analyzeSeasonalTrends: jest.fn(),
    evaluateSupplierPerformance: jest.fn(),
    generatePurchaseOrders: jest.fn(),
    optimizePricing: jest.fn(),
  },
}));

describe('/api/ai/inventory', () => {
  const mockSession = {
    user: {
      id: 'user-1',
      organizationId: 'org-1',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getServerSession as jest.Mock).mockResolvedValue(mockSession);
    (prisma.product.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.order.findMany as jest.Mock).mockResolvedValue([]);
  });

  describe('GET', () => {
    it('should return 401 for unauthorized requests', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: {} });

      const request = new MockNextRequest('http://localhost:3000/api/ai/inventory');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return stockout predictions', async () => {
      const { aiInventoryService } = await import('@/lib/ai/inventoryService');
      (aiInventoryService.predictStockoutRisk as jest.Mock).mockResolvedValue({
        predictions: [],
      });

      const request = new MockNextRequest('http://localhost:3000/api/ai/inventory?type=stockout-predictions');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toBeDefined();
      expect(data.predictions).toBeDefined();
    });

    it('should return 500 on server error', async () => {
      (prisma.product.findMany as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = new MockNextRequest('http://localhost:3000/api/ai/inventory');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });
  });

  describe('POST', () => {
    it('should return 401 for unauthorized requests', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: {} });

      const request = new MockNextRequest('http://localhost:3000/api/ai/inventory', {
        method: 'POST',
        body: JSON.stringify({ action: 'optimize' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should generate purchase order successfully', async () => {
      const mockPurchaseOrder = {
        id: 'po-1',
        orderNumber: 'PO-123',
        status: 'DRAFT',
      };
      (prisma.purchaseOrder.create as jest.Mock).mockResolvedValue(mockPurchaseOrder);

      const request = new MockNextRequest('http://localhost:3000/api/ai/inventory', {
        method: 'POST',
        body: JSON.stringify({ 
          action: 'generate-purchase-order',
          data: {
            supplierId: 'supplier-1',
            totalAmount: 1000,
            items: [],
          },
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.purchaseOrder).toBeDefined();
    });
  });
});

