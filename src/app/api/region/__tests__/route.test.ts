import { GET } from '../route';
import { RegionService } from '@/lib/region/regionService';
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
jest.mock('@/lib/region/regionService', () => ({
  RegionService: jest.fn().mockImplementation(() => ({
    getRegionConfigByRegion: jest.fn().mockReturnValue({ region: 'US', currency: 'USD' }),
    getRegionConfig: jest.fn().mockResolvedValue({ region: 'US', currency: 'USD' }),
  })),
}));

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));

describe('/api/region', () => {
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

      const request = new MockNextRequest('http://localhost:3000/api/region');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.message).toBe('Unauthorized');
    });

    it('should return region information for organization', async () => {
      const request = new MockNextRequest('http://localhost:3000/api/region');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toBeDefined();
    });

    it('should return region config by region parameter', async () => {
      const request = new MockNextRequest('http://localhost:3000/api/region?region=US');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toBeDefined();
    });

    it('should return 500 on server error', async () => {
      const mockService = {
        getRegionConfig: jest.fn().mockRejectedValue(new Error('Service error')),
      };
      (RegionService as jest.Mock).mockImplementation(() => mockService);

      const request = new MockNextRequest('http://localhost:3000/api/region');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe('Internal server error');
    });
  });
});

