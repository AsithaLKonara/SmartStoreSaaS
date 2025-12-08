import { GET } from '../route';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { businessIntelligenceService } from '@/lib/ai/businessIntelligenceService';

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
    product: {
      findMany: jest.fn(),
    },
    customer: {
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

jest.mock('@/lib/ai/businessIntelligenceService', () => ({
  businessIntelligenceService: {
    analyzeMarketTrends: jest.fn(),
    getSeasonalInsights: jest.fn(),
    analyzeCompetitors: jest.fn(),
    getMarketShare: jest.fn(),
    compareProducts: jest.fn(),
    assessMarketRisk: jest.fn(),
    generateFinancialForecast: jest.fn(),
    generateIndustryReport: jest.fn(),
  },
}));

describe('/api/ai/business-intelligence', () => {
  const mockSession = {
    user: {
      id: 'user-1',
      organizationId: 'org-1',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getServerSession as jest.Mock).mockResolvedValue(mockSession);
    (prisma.order.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.product.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.customer.findMany as jest.Mock).mockResolvedValue([]);
  });

  describe('GET', () => {
    it('should return 401 for unauthorized requests', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: {} });

      const request = new MockNextRequest('http://localhost:3000/api/ai/business-intelligence');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 400 when organizationId is missing', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

      const request = new MockNextRequest('http://localhost:3000/api/ai/business-intelligence');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Organization ID required');
    });

    it('should return market trends analysis', async () => {
      (businessIntelligenceService.analyzeMarketTrends as jest.Mock).mockResolvedValue({
        trends: [],
        insights: [],
      });

      const request = new MockNextRequest('http://localhost:3000/api/ai/business-intelligence?type=market-trends');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toBeDefined();
    });

    it('should return 500 on server error', async () => {
      (prisma.order.findMany as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = new MockNextRequest('http://localhost:3000/api/ai/business-intelligence');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });
  });
});

