import { GET } from '../route';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { customerIntelligenceService } from '@/lib/ai/customerIntelligenceService';

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
    customer: {
      findMany: jest.fn(),
    },
    order: {
      findMany: jest.fn(),
    },
    customerActivity: {
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

jest.mock('@/lib/ai/customerIntelligenceService', () => ({
  customerIntelligenceService: {
    predictCustomerLTV: jest.fn(),
    assessChurnRisk: jest.fn(),
    createCustomerSegments: jest.fn(),
    generateProductRecommendations: jest.fn(),
  },
}));

describe('/api/ai/customer-intelligence', () => {
  const mockSession = {
    user: {
      id: 'user-1',
      organizationId: 'org-1',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getServerSession as jest.Mock).mockResolvedValue(mockSession);
    (prisma.customer.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.order.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.customerActivity.findMany as jest.Mock).mockResolvedValue([]);
  });

  describe('GET', () => {
    it('should return 401 for unauthorized requests', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: {} });

      const request = new MockNextRequest('http://localhost:3000/api/ai/customer-intelligence');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return customer LTV predictions', async () => {
      const { customerIntelligenceService } = require('@/lib/ai/customerIntelligenceService');
      (customerIntelligenceService.predictCustomerLTV as jest.Mock).mockResolvedValue({
        predictions: [],
      });

      const request = new MockNextRequest('http://localhost:3000/api/ai/customer-intelligence?type=customer-ltv');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toBeDefined();
      expect(data.ltvPredictions).toBeDefined();
    });

    it('should return 500 on server error', async () => {
      (prisma.customer.findMany as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = new MockNextRequest('http://localhost:3000/api/ai/customer-intelligence');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error || data.message).toBe('Internal server error');
    });
  });
});

