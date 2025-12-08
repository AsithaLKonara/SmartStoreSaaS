import { GET } from '../route';
import { prisma } from '@/lib/prisma';
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
jest.mock('@/lib/prisma', () => ({
  prisma: {
    campaignTemplate: {
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

describe('/api/campaigns/templates', () => {
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

      const request = new MockNextRequest('http://localhost:3000/api/campaigns/templates');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.message).toBe('Unauthorized');
    });

    it('should return templates list including system templates', async () => {
      const mockTemplates = [
        { id: 'template-1', name: 'System Template', organizationId: null },
        { id: 'template-2', name: 'Org Template', organizationId: 'org-1' },
      ];
      (prisma.campaignTemplate.findMany as jest.Mock).mockResolvedValue(mockTemplates);

      const request = new MockNextRequest('http://localhost:3000/api/campaigns/templates');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(2);
    });

    it('should include both system and organization templates', async () => {
      (prisma.campaignTemplate.findMany as jest.Mock).mockResolvedValue([]);

      const request = new MockNextRequest('http://localhost:3000/api/campaigns/templates');
      await GET(request);

      expect(prisma.campaignTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { organizationId: null },
              { organizationId: 'org-1' },
            ],
          }),
        })
      );
    });

    it('should return 500 on server error', async () => {
      (prisma.campaignTemplate.findMany as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = new MockNextRequest('http://localhost:3000/api/campaigns/templates');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe('Internal server error');
    });
  });
});

