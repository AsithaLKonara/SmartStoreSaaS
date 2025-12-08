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
    reportTemplate: {
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

describe('/api/reports/templates', () => {
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

      const request = new MockNextRequest('http://localhost:3000/api/reports/templates');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.message).toBe('Unauthorized');
    });

    it('should return templates list', async () => {
      const mockTemplates = [
        { id: 'template-1', name: 'Sales Report', type: 'SALES' },
      ];
      (prisma.reportTemplate.findMany as jest.Mock).mockResolvedValue(mockTemplates);

      const request = new MockNextRequest('http://localhost:3000/api/reports/templates');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data[0].name).toBe('Sales Report');
    });

    it('should return 500 on server error', async () => {
      (prisma.reportTemplate.findMany as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = new MockNextRequest('http://localhost:3000/api/reports/templates');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe('Internal server error');
    });
  });
});

