import { GET, POST } from '../route';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { InstagramShoppingService } from '@/lib/integrations/instagram/instagramShoppingService';

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
    instagramIntegration: {
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

jest.mock('@/lib/integrations/instagram/instagramShoppingService', () => ({
  InstagramShoppingService: jest.fn().mockImplementation(() => ({
    testConnection: jest.fn(),
    getOrCreateCatalog: jest.fn(),
  })),
}));

describe('/api/integrations/instagram', () => {
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

      const request = new MockNextRequest('http://localhost:3000/api/integrations/instagram');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.message).toBe('Unauthorized');
    });

    it('should return integration when found', async () => {
      const mockIntegration = {
        id: 'int-1',
        isActive: true,
        lastSync: new Date(),
        businessAccountId: 'test-businessAccountId',
        accessToken: 'test-accessToken',
      };
      (prisma.instagramIntegration.findFirst as jest.Mock).mockResolvedValue(mockIntegration);

      const request = new MockNextRequest('http://localhost:3000/api/integrations/instagram');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id || (Array.isArray(data) && data[0]?.id)).toBe('int-1');
    });

    it('should return 404 when integration not found', async () => {
      (prisma.instagramIntegration.findFirst as jest.Mock).mockResolvedValue(null);

      const request = new MockNextRequest('http://localhost:3000/api/integrations/instagram');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.message).toBe('Integration not found');
    });

    it('should return 500 on server error', async () => {
      (prisma.instagramIntegration.findFirst as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = new MockNextRequest('http://localhost:3000/api/integrations/instagram');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe('Internal server error');
    });
  });

  describe('POST', () => {
    it('should return 401 for unauthorized requests', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: {} });

      const request = new MockNextRequest('http://localhost:3000/api/integrations/instagram', {
        method: 'POST',
        body: JSON.stringify({ businessAccountId: 'test', accessToken: 'test' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.message).toBe('Unauthorized');
    });

    it('should return 400 for missing required fields', async () => {
      const request = new MockNextRequest('http://localhost:3000/api/integrations/instagram', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message || data.error).toBeDefined();
    });

    it('should create integration successfully', async () => {
      const mockService = {
        testConnection: jest.fn().mockResolvedValue(true),
        getOrCreateCatalog: jest.fn().mockResolvedValue('catalog-1'),
      };
      (InstagramShoppingService as jest.Mock).mockImplementation(() => mockService);

      const mockIntegration = {
        id: 'int-1',
        isActive: true,
      };
      (prisma.instagramIntegration.upsert as jest.Mock).mockResolvedValue(mockIntegration);
      

      const request = new MockNextRequest('http://localhost:3000/api/integrations/instagram', {
        method: 'POST',
        body: JSON.stringify({
          businessAccountId: 'test-businessAccountId',
          accessToken: 'test-accessToken',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.id).toBe('int-1');
    });

    it('should return 400 when connection test fails', async () => {
      const mockService = {
        testConnection: jest.fn().mockResolvedValue(false),
      };
      (InstagramShoppingService as jest.Mock).mockImplementation(() => mockService);

      const request = new MockNextRequest('http://localhost:3000/api/integrations/instagram', {
        method: 'POST',
        body: JSON.stringify({
          businessAccountId: 'test-businessAccountId',
          accessToken: 'test-accessToken',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message || data.error).toBeDefined();
    });

    it('should return 500 on server error', async () => {
      const mockService = {
        testConnection: jest.fn().mockRejectedValue(new Error('Connection error')),
      };
      (InstagramShoppingService as jest.Mock).mockImplementation(() => mockService);

      const request = new MockNextRequest('http://localhost:3000/api/integrations/instagram', {
        method: 'POST',
        body: JSON.stringify({
          businessAccountId: 'test-businessAccountId',
          accessToken: 'test-accessToken',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe('Internal server error');
    });
  });
});
