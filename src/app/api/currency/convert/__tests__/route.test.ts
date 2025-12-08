import { GET } from '../route';
import { CurrencyService } from '@/lib/currency/currencyService';
import { getServerSession } from 'next-auth';

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
jest.mock('@/lib/currency/currencyService', () => ({
  CurrencyService: jest.fn().mockImplementation(() => ({
    convertCurrency: jest.fn(),
  })),
}));

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));

describe('/api/currency/convert', () => {
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

      const request = new MockNextRequest('http://localhost:3000/api/currency/convert?from=USD&to=EUR&amount=100');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.message).toBe('Unauthorized');
    });

    it('should return converted amount', async () => {
      const mockResult = { from: 'USD', to: 'EUR', amount: 100, converted: 85 };
      const mockService = {
        convertCurrency: jest.fn().mockResolvedValue(mockResult),
      };
      (CurrencyService as jest.Mock).mockImplementation(() => mockService);

      const request = new MockNextRequest('http://localhost:3000/api/currency/convert?from=USD&to=EUR&amount=100');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toBeDefined();
    });

    it('should use default values when parameters are missing', async () => {
      const mockResult = { from: 'USD', to: 'EUR', amount: 1, converted: 0.85 };
      const mockService = {
        convertCurrency: jest.fn().mockResolvedValue(mockResult),
      };
      (CurrencyService as jest.Mock).mockImplementation(() => mockService);

      const request = new MockNextRequest('http://localhost:3000/api/currency/convert');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toBeDefined();
    });

    it('should return 500 on server error', async () => {
      const mockService = {
        convertCurrency: jest.fn().mockRejectedValue(new Error('Service error')),
      };
      (CurrencyService as jest.Mock).mockImplementation(() => mockService);

      const request = new MockNextRequest('http://localhost:3000/api/currency/convert?from=USD&to=EUR&amount=100');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe('Internal server error');
    });
  });
});

