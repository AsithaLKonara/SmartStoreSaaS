import { POST } from '../route';
import { ThreatDetectionService } from '@/lib/security/threatDetectionService';
import { FraudPreventionService } from '@/lib/security/fraudPreventionService';
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
jest.mock('@/lib/security/threatDetectionService', () => ({
  ThreatDetectionService: jest.fn().mockImplementation(() => ({
    detectThreats: jest.fn(),
    logThreat: jest.fn(),
  })),
}));

jest.mock('@/lib/security/fraudPreventionService', () => ({
  FraudPreventionService: jest.fn().mockImplementation(() => ({
    checkFraud: jest.fn(),
  })),
}));

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));

describe('/api/security/threats', () => {
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

      const request = new MockNextRequest('http://localhost:3000/api/security/threats', {
        method: 'POST',
        body: JSON.stringify({ type: 'threat', check: { type: 'SUSPICIOUS_ACTIVITY', severity: 'HIGH' } }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.message).toBe('Unauthorized');
    });

    it('should detect threats', async () => {
      const mockResult = { isThreat: true, severity: 'HIGH' };
      const mockService = {
        detectThreats: jest.fn().mockResolvedValue(mockResult),
        logThreat: jest.fn().mockResolvedValue(undefined),
      };
      (ThreatDetectionService as jest.Mock).mockImplementation(() => mockService);

      const request = new MockNextRequest('http://localhost:3000/api/security/threats', {
        method: 'POST',
        body: JSON.stringify({
          type: 'threat',
          check: {
            type: 'SUSPICIOUS_ACTIVITY',
            severity: 'HIGH',
            source: 'login',
            details: 'Multiple failed attempts',
          },
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.isThreat).toBe(true);
    });

    it('should check fraud', async () => {
      const mockResult = { isFraud: false, riskScore: 0.2 };
      const mockService = {
        checkFraud: jest.fn().mockResolvedValue(mockResult),
      };
      (FraudPreventionService as jest.Mock).mockImplementation(() => mockService);

      const request = new MockNextRequest('http://localhost:3000/api/security/threats', {
        method: 'POST',
        body: JSON.stringify({
          type: 'fraud',
          check: { transactionId: 'txn-1', amount: 100 },
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.isFraud).toBe(false);
    });

    it('should return 400 for invalid type', async () => {
      const request = new MockNextRequest('http://localhost:3000/api/security/threats', {
        method: 'POST',
        body: JSON.stringify({ type: 'invalid' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toBe('Invalid type');
    });

    it('should return 500 on server error', async () => {
      const mockService = {
        detectThreats: jest.fn().mockRejectedValue(new Error('Service error')),
      };
      (ThreatDetectionService as jest.Mock).mockImplementation(() => mockService);

      const request = new MockNextRequest('http://localhost:3000/api/security/threats', {
        method: 'POST',
        body: JSON.stringify({
          type: 'threat',
          check: { type: 'SUSPICIOUS_ACTIVITY', severity: 'HIGH' },
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe('Internal server error');
    });
  });
});

