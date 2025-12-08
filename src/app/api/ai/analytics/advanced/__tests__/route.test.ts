import { GET } from '../route';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { AdvancedPredictiveService } from '@/lib/ai/analytics/advancedPredictiveService';

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
    order: {
      findMany: jest.fn(),
    },
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

jest.mock('@/lib/ai/analytics/advancedPredictiveService', () => ({
  AdvancedPredictiveService: jest.fn().mockImplementation(() => ({
    generateSalesForecast: jest.fn(),
    analyzeTrends: jest.fn(),
    competitiveIntelligence: jest.fn(),
    optimizePrice: jest.fn(),
  })),
}));

describe('/api/ai/analytics/advanced', () => {
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

      const request = new MockNextRequest('http://localhost:3000/api/ai/analytics/advanced');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error || data.message).toBe('Unauthorized');
    });

    it('should return sales forecast', async () => {
      const mockService = {
        generateSalesForecast: jest.fn().mockResolvedValue({ forecast: [] }),
      };
      (AdvancedPredictiveService as jest.Mock).mockImplementation(() => mockService);

      const request = new MockNextRequest('http://localhost:3000/api/ai/analytics/advanced?type=forecast');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toBeDefined();
    });

    it('should return 500 on server error', async () => {
      const mockService = {
        generateSalesForecast: jest.fn().mockRejectedValue(new Error('Service error')),
      };
      (AdvancedPredictiveService as jest.Mock).mockImplementation(() => mockService);

      const request = new MockNextRequest('http://localhost:3000/api/ai/analytics/advanced?type=forecast');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe('Internal server error');
    });
  });
});

