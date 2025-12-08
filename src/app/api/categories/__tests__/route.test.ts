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
    category: {
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

describe('/api/categories', () => {
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

      const request = new MockNextRequest('http://localhost:3000/api/categories');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.message).toBe('Unauthorized');
    });

    it('should return categories list', async () => {
      const mockCategories = [
        { id: 'cat-1', name: 'Electronics', organizationId: 'org-1' },
        { id: 'cat-2', name: 'Clothing', organizationId: 'org-1' },
      ];
      (prisma.category.findMany as jest.Mock).mockResolvedValue(mockCategories);

      const request = new MockNextRequest('http://localhost:3000/api/categories');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.categories).toBeDefined();
      expect(data.categories).toHaveLength(2);
      expect(data.categories[0].name).toBe('Electronics');
    });

    it('should ensure organization data isolation', async () => {
      (prisma.category.findMany as jest.Mock).mockResolvedValue([]);

      const request = new MockNextRequest('http://localhost:3000/api/categories');
      await GET(request);

      expect(prisma.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org-1' },
        })
      );
    });

    it('should return 500 on server error', async () => {
      (prisma.category.findMany as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = new MockNextRequest('http://localhost:3000/api/categories');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe('Internal server error');
    });
  });
});

