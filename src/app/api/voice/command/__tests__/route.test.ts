import { POST } from '../route';
import { VoiceCommerceService } from '@/lib/voice/voiceCommerceService';
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
jest.mock('@/lib/voice/voiceCommerceService', () => ({
  VoiceCommerceService: jest.fn().mockImplementation(() => ({
    processVoiceCommand: jest.fn(),
  })),
}));

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));

describe('/api/voice/command', () => {
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

      const request = new MockNextRequest('http://localhost:3000/api/voice/command', {
        method: 'POST',
        body: JSON.stringify({ command: 'search products' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.message).toBe('Unauthorized');
    });

    it('should process voice command', async () => {
      const mockResult = { success: true, action: 'search' };
      const mockService = {
        processVoiceCommand: jest.fn().mockResolvedValue(mockResult),
      };
      (VoiceCommerceService as jest.Mock).mockImplementation(() => mockService);

      const request = new MockNextRequest('http://localhost:3000/api/voice/command', {
        method: 'POST',
        body: JSON.stringify({ command: 'search products' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should return 400 for missing command', async () => {
      const request = new MockNextRequest('http://localhost:3000/api/voice/command', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toBe('Missing command parameter');
    });

    it('should return 500 on server error', async () => {
      (getServerSession as jest.Mock).mockRejectedValue(new Error('Auth error'));

      const request = new MockNextRequest('http://localhost:3000/api/voice/command', {
        method: 'POST',
        body: JSON.stringify({ command: 'test' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe('Internal server error');
    });
  });
});

