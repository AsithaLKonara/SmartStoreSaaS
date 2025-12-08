import { POST } from '../route';
import { getServerSession } from 'next-auth';
import { BuyNowPayLaterService } from '@/lib/payments/buyNowPayLaterService';

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

// Mock dependencies
jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));

jest.mock('@/lib/payments/buyNowPayLaterService', () => ({
  BuyNowPayLaterService: jest.fn().mockImplementation(() => ({
    createSession: jest.fn(),
  })),
}));

describe('/api/payments/bnpl', () => {
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

  describe('POST', () => {
    it('should return 401 for unauthorized requests', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(null);

      const request = new MockNextRequest('http://localhost:3000/api/payments/bnpl', {
        method: 'POST',
        body: JSON.stringify({ provider: 'klarna' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.message).toBe('Unauthorized');
    });

    it('should return 400 for missing required fields', async () => {
      const request = new MockNextRequest('http://localhost:3000/api/payments/bnpl', {
        method: 'POST',
        body: JSON.stringify({ provider: 'klarna' }), // Missing amount, currency, orderId
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toBe('Missing required fields');
    });

    it('should create BNPL session', async () => {
      const mockSession = {
        id: 'bnpl_session_123',
        provider: 'klarna',
        status: 'pending',
        redirectUrl: 'https://klarna.com/checkout',
      };
      const mockService = {
        createSession: jest.fn().mockResolvedValue(mockSession),
      };
      (BuyNowPayLaterService as jest.Mock).mockImplementation(() => mockService);

      const request = new MockNextRequest('http://localhost:3000/api/payments/bnpl', {
        method: 'POST',
        body: JSON.stringify({
          provider: 'klarna',
          amount: 1000,
          currency: 'USD',
          orderId: 'order-1',
          customerInfo: { email: 'test@example.com' },
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe('bnpl_session_123');
      expect(mockService.createSession).toHaveBeenCalledWith(
        'klarna',
        1000,
        'USD',
        'order-1',
        { email: 'test@example.com' }
      );
    });

    it('should create BNPL session without customerInfo', async () => {
      const mockSession = {
        id: 'bnpl_session_123',
        provider: 'klarna',
        status: 'pending',
      };
      const mockService = {
        createSession: jest.fn().mockResolvedValue(mockSession),
      };
      (BuyNowPayLaterService as jest.Mock).mockImplementation(() => mockService);

      const request = new MockNextRequest('http://localhost:3000/api/payments/bnpl', {
        method: 'POST',
        body: JSON.stringify({
          provider: 'klarna',
          amount: 1000,
          currency: 'USD',
          orderId: 'order-1',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe('bnpl_session_123');
      expect(mockService.createSession).toHaveBeenCalledWith(
        'klarna',
        1000,
        'USD',
        'order-1',
        {}
      );
    });

    it('should return 500 on server error', async () => {
      const mockService = {
        createSession: jest.fn().mockRejectedValue(new Error('BNPL service error')),
      };
      (BuyNowPayLaterService as jest.Mock).mockImplementation(() => mockService);

      const request = new MockNextRequest('http://localhost:3000/api/payments/bnpl', {
        method: 'POST',
        body: JSON.stringify({
          provider: 'klarna',
          amount: 1000,
          currency: 'USD',
          orderId: 'order-1',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe('Internal server error');
    });
  });
});

