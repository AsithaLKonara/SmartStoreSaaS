import { GET, POST } from '../route';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';


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
jest.mock('@/lib/prisma', () => ({
  prisma: {
    cRMIntegration: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));



describe('/api/integrations/crm', () => {
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

      const request = new MockNextRequest('http://localhost:3000/api/integrations/crm');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.message).toBe('Unauthorized');
    });

    it('should return integrations list', async () => {
      const mockIntegration = {
        id: 'int-1',
        isActive: true,
        lastSync: new Date(),
        provider: 'test-provider',
        apiKey: 'test-apiKey',
      };
      (prisma.cRMIntegration.findMany as jest.Mock).mockResolvedValue([mockIntegration]);

      const request = new MockNextRequest('http://localhost:3000/api/integrations/crm');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data[0].id).toBe('int-1');
    });

    it('should return empty array when no integrations found', async () => {
      (prisma.cRMIntegration.findMany as jest.Mock).mockResolvedValue([]);

      const request = new MockNextRequest('http://localhost:3000/api/integrations/crm');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(0);
    });

    it('should return 500 on server error', async () => {
      (prisma.cRMIntegration.findMany as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = new MockNextRequest('http://localhost:3000/api/integrations/crm');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe('Internal server error');
    });
  });

  describe('POST', () => {
    it('should return 401 for unauthorized requests', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: {} });

      const request = new MockNextRequest('http://localhost:3000/api/integrations/crm', {
        method: 'POST',
        body: JSON.stringify({ provider: 'test', apiKey: 'test' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.message).toBe('Unauthorized');
    });

    it('should return 400 for missing required fields', async () => {
      const request = new MockNextRequest('http://localhost:3000/api/integrations/crm', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message || data.error).toBeDefined();
    });

    it('should create integration successfully', async () => {
      const mockIntegration = {
        id: 'int-1',
        isActive: true,
      };
      (prisma.cRMIntegration.create as jest.Mock).mockResolvedValue(mockIntegration);

      const request = new MockNextRequest('http://localhost:3000/api/integrations/crm', {
        method: 'POST',
        body: JSON.stringify({
          provider: 'salesforce',
          accessToken: 'token',
          instanceUrl: 'https://test.salesforce.com',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.id).toBe('int-1');
    });

    

    it('should return 500 on server error', async () => {
      (prisma.cRMIntegration.create as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = new MockNextRequest('http://localhost:3000/api/integrations/crm', {
        method: 'POST',
        body: JSON.stringify({
          provider: 'salesforce',
          accessToken: 'token',
          instanceUrl: 'https://test.salesforce.com',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe('Internal server error');
    });
  });
});
