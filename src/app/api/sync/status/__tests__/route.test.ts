import { GET } from '../route';
import { realTimeSyncService } from '@/lib/sync/realTimeSyncService';
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
jest.mock('@/lib/sync/realTimeSyncService', () => ({
  realTimeSyncService: {
    getSyncStatus: jest.fn(),
  },
}));

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));

describe('/api/sync/status', () => {
  const mockSession = {
    user: {
      id: 'user-1',
      email: 'test@example.com',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getServerSession as jest.Mock).mockResolvedValue(mockSession);
  });

  describe('GET', () => {
    it('should return 401 for unauthorized requests', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(null);

      const request = new MockNextRequest('http://localhost:3000/api/sync/status?organizationId=org-1');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 400 for missing organizationId', async () => {
      const request = new MockNextRequest('http://localhost:3000/api/sync/status');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Organization ID required');
    });

    it('should return sync status', async () => {
      const mockStatus = { status: 'synced', lastSync: new Date() };
      (realTimeSyncService.getSyncStatus as jest.Mock).mockResolvedValue(mockStatus);

      const request = new MockNextRequest('http://localhost:3000/api/sync/status?organizationId=org-1');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toBeDefined();
    });

    it('should return 500 on server error', async () => {
      (realTimeSyncService.getSyncStatus as jest.Mock).mockRejectedValue(new Error('Service error'));

      const request = new MockNextRequest('http://localhost:3000/api/sync/status?organizationId=org-1');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });
  });
});

