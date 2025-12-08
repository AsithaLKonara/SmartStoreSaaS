import { POST } from '../route';
import { BlockchainService } from '@/lib/blockchain/blockchainService';
import { getServerSession } from 'next-auth';

// Mock NextRequest
class MockNextRequest {
  url: string;
  method: string;
  body: string;
  
  constructor(url: string, init?: { method?: string; body?: unknown }) {
    this.url = url;
    this.method = init?.method || 'POST';
    this.body = typeof init?.body === 'string' ? init.body : JSON.stringify(init?.body || {});
  }
  
  async json() {
    return JSON.parse(this.body);
  }
}

// Mock dependencies
jest.mock('@/lib/blockchain/blockchainService', () => ({
  BlockchainService: jest.fn().mockImplementation(() => ({
    processCryptoPayment: jest.fn(),
    trackSupplyChain: jest.fn(),
  })),
}));

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));

describe('/api/blockchain', () => {
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
      (getServerSession as jest.Mock).mockResolvedValue({ user: {} });

      const request = new MockNextRequest('http://localhost:3000/api/blockchain', {
        method: 'POST',
        body: JSON.stringify({ type: 'payment', action: 'create' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.message).toBe('Unauthorized');
    });

    it('should process crypto payment', async () => {
      const mockTxHash = '0x123abc';
      const mockService = {
        processCryptoPayment: jest.fn().mockResolvedValue(mockTxHash),
      };
      (BlockchainService as jest.Mock).mockImplementation(() => mockService);

      const request = new MockNextRequest('http://localhost:3000/api/blockchain', {
        method: 'POST',
        body: JSON.stringify({
          type: 'payment',
          action: 'create',
          orderId: 'order-1',
          amount: 100,
          currency: 'ETH',
          fromAddress: '0x123',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.txHash).toBe(mockTxHash);
    });

    it('should track supply chain', async () => {
      const mockTxHash = '0x456def';
      const mockService = {
        trackSupplyChain: jest.fn().mockResolvedValue(mockTxHash),
      };
      (BlockchainService as jest.Mock).mockImplementation(() => mockService);

      const request = new MockNextRequest('http://localhost:3000/api/blockchain', {
        method: 'POST',
        body: JSON.stringify({
          type: 'supply_chain',
          action: 'track',
          productId: 'product-1',
          fromLocation: 'Warehouse A',
          toLocation: 'Warehouse B',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.txHash).toBe(mockTxHash);
    });

    it('should return 500 on server error', async () => {
      const mockService = {
        processCryptoPayment: jest.fn().mockRejectedValue(new Error('Service error')),
      };
      (BlockchainService as jest.Mock).mockImplementation(() => mockService);

      const request = new MockNextRequest('http://localhost:3000/api/blockchain', {
        method: 'POST',
        body: JSON.stringify({
          type: 'payment',
          action: 'create',
          orderId: 'order-1',
          amount: 100,
          currency: 'ETH',
          fromAddress: '0x123',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe('Internal server error');
    });
  });
});

