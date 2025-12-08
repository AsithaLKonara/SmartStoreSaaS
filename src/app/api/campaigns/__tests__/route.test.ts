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
    campaign: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  },
}));

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));

describe('/api/campaigns', () => {
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

      const request = new MockNextRequest('http://localhost:3000/api/campaigns');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.message).toBe('Unauthorized');
    });

    it('should return campaigns list with stats', async () => {
      const mockCampaigns = [
        {
          id: 'campaign-1',
          name: 'Summer Sale',
          type: 'EMAIL',
          organizationId: 'org-1',
          metrics: [{ sent: 100, delivered: 95, opened: 50, clicked: 20, bounced: 5 }],
        },
      ];
      (prisma.campaign.findMany as jest.Mock).mockResolvedValue(mockCampaigns);

      const request = new MockNextRequest('http://localhost:3000/api/campaigns');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data[0].name).toBe('Summer Sale');
      expect(data[0].stats).toBeDefined();
      expect(data[0].stats.sent).toBe(100);
    });

    it('should use default stats when metrics are missing', async () => {
      const mockCampaigns = [
        {
          id: 'campaign-1',
          name: 'Summer Sale',
          type: 'EMAIL',
          organizationId: 'org-1',
          metrics: [],
        },
      ];
      (prisma.campaign.findMany as jest.Mock).mockResolvedValue(mockCampaigns);

      const request = new MockNextRequest('http://localhost:3000/api/campaigns');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data[0].stats.sent).toBe(0);
      expect(data[0].stats.delivered).toBe(0);
    });

    it('should ensure organization data isolation', async () => {
      (prisma.campaign.findMany as jest.Mock).mockResolvedValue([]);

      const request = new MockNextRequest('http://localhost:3000/api/campaigns');
      await GET(request);

      expect(prisma.campaign.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org-1' },
        })
      );
    });

    it('should return 500 on server error', async () => {
      (prisma.campaign.findMany as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = new MockNextRequest('http://localhost:3000/api/campaigns');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe('Internal server error');
    });
  });

  describe('POST', () => {
    it('should return 401 for unauthorized requests', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: {} });

      const request = new MockNextRequest('http://localhost:3000/api/campaigns', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Campaign', type: 'EMAIL', content: 'Test' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.message).toBe('Unauthorized');
    });

    it('should return 400 for missing required fields', async () => {
      const request = new MockNextRequest('http://localhost:3000/api/campaigns', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Campaign' }), // Missing type and content
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toBe('Name, type, and content are required');
    });

    it('should create campaign successfully', async () => {
      const mockCampaign = {
        id: 'campaign-1',
        name: 'Test Campaign',
        type: 'EMAIL',
        content: 'Test content',
        organizationId: 'org-1',
        metrics: [{ sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 }],
      };
      (prisma.campaign.create as jest.Mock).mockResolvedValue(mockCampaign);

      const request = new MockNextRequest('http://localhost:3000/api/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Campaign',
          type: 'EMAIL',
          content: 'Test content',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.name).toBe('Test Campaign');
      expect(data.stats).toBeDefined();
    });

    it('should return 500 on server error', async () => {
      (prisma.campaign.create as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = new MockNextRequest('http://localhost:3000/api/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Campaign',
          type: 'EMAIL',
          content: 'Test content',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe('Internal server error');
    });
  });
});

