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
    bulkOperation: {
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

describe('/api/bulk-operations', () => {
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

      const request = new MockNextRequest('http://localhost:3000/api/bulk-operations');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.message).toBe('Unauthorized');
    });

    it('should return bulk operations list with progress', async () => {
      const mockOperations = [
        {
          id: 'op-1',
          name: 'Bulk Import',
          type: 'IMPORT',
          totalRecords: 100,
          processedRecords: 50,
          successRecords: 45,
          failedRecords: 5,
          errors: [],
        },
      ];
      (prisma.bulkOperation.findMany as jest.Mock).mockResolvedValue(mockOperations);

      const request = new MockNextRequest('http://localhost:3000/api/bulk-operations');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data[0].name).toBe('Bulk Import');
      expect(data[0].progress).toBe(50);
      expect(data[0].successCount).toBe(45);
      expect(data[0].errorCount).toBe(5);
    });

    it('should calculate progress correctly', async () => {
      const mockOperations = [
        {
          id: 'op-1',
          totalRecords: 200,
          processedRecords: 100,
          successRecords: 95,
          failedRecords: 5,
          errors: [],
        },
      ];
      (prisma.bulkOperation.findMany as jest.Mock).mockResolvedValue(mockOperations);

      const request = new MockNextRequest('http://localhost:3000/api/bulk-operations');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data[0].progress).toBe(50);
    });

    it('should ensure organization data isolation', async () => {
      (prisma.bulkOperation.findMany as jest.Mock).mockResolvedValue([]);

      const request = new MockNextRequest('http://localhost:3000/api/bulk-operations');
      await GET(request);

      expect(prisma.bulkOperation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org-1' },
        })
      );
    });

    it('should return 500 on server error', async () => {
      (prisma.bulkOperation.findMany as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = new MockNextRequest('http://localhost:3000/api/bulk-operations');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe('Internal server error');
    });
  });

  describe('POST', () => {
    it('should return 401 for unauthorized requests', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: {} });

      const request = new MockNextRequest('http://localhost:3000/api/bulk-operations', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Operation', type: 'IMPORT', entity: 'PRODUCTS' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.message).toBe('Unauthorized');
    });

    it('should return 400 for missing required fields', async () => {
      const request = new MockNextRequest('http://localhost:3000/api/bulk-operations', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Operation' }), // Missing type and entity
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toBe('Required fields are missing');
    });

    it('should create bulk operation successfully', async () => {
      const mockOperation = {
        id: 'op-1',
        name: 'Test Operation',
        type: 'IMPORT',
        entity: 'PRODUCTS',
        status: 'PENDING',
        organizationId: 'org-1',
        totalRecords: 0,
        processedRecords: 0,
        successRecords: 0,
        failedRecords: 0,
      };
      (prisma.bulkOperation.create as jest.Mock).mockResolvedValue(mockOperation);

      const request = new MockNextRequest('http://localhost:3000/api/bulk-operations', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Operation',
          type: 'IMPORT',
          entity: 'PRODUCTS',
          templateId: 'template-1',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.name).toBe('Test Operation');
      expect(data.status).toBe('PENDING');
    });

    it('should return 500 on server error', async () => {
      (prisma.bulkOperation.create as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = new MockNextRequest('http://localhost:3000/api/bulk-operations', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Operation',
          type: 'IMPORT',
          entity: 'PRODUCTS',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe('Internal server error');
    });
  });
});

