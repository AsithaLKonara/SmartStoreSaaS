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
    report: {
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

describe('/api/reports', () => {
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

      const request = new MockNextRequest('http://localhost:3000/api/reports');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.message).toBe('Unauthorized');
    });

    it('should return reports list', async () => {
      const mockReports = [
        { id: 'report-1', name: 'Sales Report', type: 'SALES', status: 'COMPLETED' },
      ];
      (prisma.report.findMany as jest.Mock).mockResolvedValue(mockReports);

      const request = new MockNextRequest('http://localhost:3000/api/reports');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data[0].name).toBe('Sales Report');
    });

    it('should ensure organization data isolation', async () => {
      (prisma.report.findMany as jest.Mock).mockResolvedValue([]);

      const request = new MockNextRequest('http://localhost:3000/api/reports');
      await GET(request);

      expect(prisma.report.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org-1' },
        })
      );
    });

    it('should return 500 on server error', async () => {
      (prisma.report.findMany as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = new MockNextRequest('http://localhost:3000/api/reports');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe('Internal server error');
    });
  });

  describe('POST', () => {
    it('should return 401 for unauthorized requests', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: {} });

      const request = new MockNextRequest('http://localhost:3000/api/reports', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Report', type: 'SALES', format: 'PDF' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.message).toBe('Unauthorized');
    });

    it('should return 400 for missing required fields', async () => {
      const request = new MockNextRequest('http://localhost:3000/api/reports', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Report' }), // Missing type and format
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toBe('Required fields are missing');
    });

    it('should create report successfully', async () => {
      const mockReport = {
        id: 'report-1',
        name: 'Test Report',
        type: 'SALES',
        format: 'PDF',
        status: 'GENERATING',
        organizationId: 'org-1',
      };
      (prisma.report.create as jest.Mock).mockResolvedValue(mockReport);

      const request = new MockNextRequest('http://localhost:3000/api/reports', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Report',
          type: 'SALES',
          format: 'PDF',
          parameters: { startDate: '2024-01-01' },
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.name).toBe('Test Report');
      expect(data.status).toBe('GENERATING');
    });

    it('should return 500 on server error', async () => {
      (prisma.report.create as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = new MockNextRequest('http://localhost:3000/api/reports', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Report',
          type: 'SALES',
          format: 'PDF',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe('Internal server error');
    });
  });
});

