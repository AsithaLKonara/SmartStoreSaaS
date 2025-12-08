import { GET, POST } from '../route';
import { getServerSession } from 'next-auth';
import { CryptoPaymentService } from '@/lib/payments/cryptoPaymentService';

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

jest.mock('@/lib/payments/cryptoPaymentService', () => ({
  CryptoPaymentService: jest.fn().mockImplementation(() => ({
    createPayment: jest.fn(),
    checkPaymentStatus: jest.fn(),
  })),
}));

describe('/api/payments/crypto', () => {
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

      const request = new MockNextRequest('http://localhost:3000/api/payments/crypto', {
        method: 'POST',
        body: JSON.stringify({ amount: 100, currency: 'USD' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.message).toBe('Unauthorized');
    });

    it('should return 400 for missing required fields', async () => {
      const request = new MockNextRequest('http://localhost:3000/api/payments/crypto', {
        method: 'POST',
        body: JSON.stringify({ amount: 100 }), // Missing currency, cryptoCurrency, orderId
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toBe('Missing required fields');
    });

    it('should create crypto payment', async () => {
      const mockPayment = {
        id: 'crypto_payment_123',
        address: '0x123...',
        amount: 100,
        currency: 'USD',
        cryptoCurrency: 'ETH',
      };
      const mockService = {
        createPayment: jest.fn().mockResolvedValue(mockPayment),
      };
      (CryptoPaymentService as jest.Mock).mockImplementation(() => mockService);

      const request = new MockNextRequest('http://localhost:3000/api/payments/crypto', {
        method: 'POST',
        body: JSON.stringify({
          amount: 100,
          currency: 'USD',
          cryptoCurrency: 'ETH',
          orderId: 'order-1',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe('crypto_payment_123');
      expect(mockService.createPayment).toHaveBeenCalledWith(100, 'USD', 'ETH', 'order-1');
    });

    it('should return 500 on server error', async () => {
      const mockService = {
        createPayment: jest.fn().mockRejectedValue(new Error('Crypto service error')),
      };
      (CryptoPaymentService as jest.Mock).mockImplementation(() => mockService);

      const request = new MockNextRequest('http://localhost:3000/api/payments/crypto', {
        method: 'POST',
        body: JSON.stringify({
          amount: 100,
          currency: 'USD',
          cryptoCurrency: 'ETH',
          orderId: 'order-1',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe('Internal server error');
    });
  });

  describe('GET', () => {
    it('should return 401 for unauthorized requests', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(null);

      const request = new MockNextRequest('http://localhost:3000/api/payments/crypto?paymentId=123&cryptoCurrency=ETH');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.message).toBe('Unauthorized');
    });

    it('should return 400 for missing paymentId or cryptoCurrency', async () => {
      const request = new MockNextRequest('http://localhost:3000/api/payments/crypto?paymentId=123');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toBe('Missing paymentId or cryptoCurrency');
    });

    it('should check payment status', async () => {
      const mockStatus = {
        status: 'confirmed',
        confirmations: 3,
        transactionHash: '0xabc...',
      };
      const mockService = {
        checkPaymentStatus: jest.fn().mockResolvedValue(mockStatus),
      };
      (CryptoPaymentService as jest.Mock).mockImplementation(() => mockService);

      const request = new MockNextRequest('http://localhost:3000/api/payments/crypto?paymentId=123&cryptoCurrency=ETH');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('confirmed');
      expect(mockService.checkPaymentStatus).toHaveBeenCalledWith('123', 'ETH');
    });

    it('should return 500 on server error', async () => {
      const mockService = {
        checkPaymentStatus: jest.fn().mockRejectedValue(new Error('Status check error')),
      };
      (CryptoPaymentService as jest.Mock).mockImplementation(() => mockService);

      const request = new MockNextRequest('http://localhost:3000/api/payments/crypto?paymentId=123&cryptoCurrency=ETH');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe('Internal server error');
    });
  });
});

