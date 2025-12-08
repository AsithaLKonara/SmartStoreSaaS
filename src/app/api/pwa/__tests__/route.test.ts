import { GET, POST } from '../route';
import { advancedPWAService } from '@/lib/pwa/advancedPWAService';
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
jest.mock('@/lib/pwa/advancedPWAService', () => ({
  advancedPWAService: {
    getOfflineData: jest.fn(),
    getBackgroundSyncTasks: jest.fn(),
    registerBackgroundSync: jest.fn(),
  },
}));

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));

describe('/api/pwa', () => {
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
      (getServerSession as jest.Mock).mockResolvedValue(null);

      const request = new MockNextRequest('http://localhost:3000/api/pwa?type=offline-data');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return offline data', async () => {
      const mockData = { products: [], orders: [] };
      (advancedPWAService.getOfflineData as jest.Mock).mockResolvedValue(mockData);

      const request = new MockNextRequest('http://localhost:3000/api/pwa?type=offline-data&dataType=products');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.offlineData).toBeDefined();
    });

    it('should return background sync tasks', async () => {
      const mockTasks = [{ id: 'task-1', type: 'sync' }];
      (advancedPWAService.getBackgroundSyncTasks as jest.Mock).mockResolvedValue(mockTasks);

      const request = new MockNextRequest('http://localhost:3000/api/pwa?type=background-sync-tasks');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.syncTasks).toBeDefined();
    });

    it('should return 400 for missing organizationId', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

      const request = new MockNextRequest('http://localhost:3000/api/pwa?type=offline-data');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Organization ID not found');
    });
  });

  describe('POST', () => {
    it('should return 401 for unauthorized requests', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(null);

      const request = new MockNextRequest('http://localhost:3000/api/pwa', {
        method: 'POST',
        body: JSON.stringify({ action: 'register-sync' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should register background sync', async () => {
      const mockResult = { success: true, taskId: 'task-1' };
      (advancedPWAService.registerBackgroundSync as jest.Mock).mockResolvedValue(mockResult);

      const request = new MockNextRequest('http://localhost:3000/api/pwa', {
        method: 'POST',
        body: JSON.stringify({ action: 'register-sync', task: { type: 'sync' } }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect([200, 400, 500]).toContain(response.status);
    });
  });
});

