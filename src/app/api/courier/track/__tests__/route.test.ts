import { GET } from '../route';
import { sriLankaCourierService } from '@/lib/courier/sriLankaCourierService';
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
jest.mock('@/lib/courier/sriLankaCourierService', () => ({
  sriLankaCourierService: {
    trackShipment: jest.fn(),
  },
}));

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));

describe('/api/courier/track', () => {
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

      const request = new MockNextRequest('http://localhost:3000/api/courier/track?trackingNumber=TRACK123&courierCode=FAST');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return tracking information', async () => {
      const mockTrackingInfo = {
        trackingNumber: 'TRACK123',
        status: 'IN_TRANSIT',
        location: 'Colombo',
      };
      (sriLankaCourierService.trackShipment as jest.Mock).mockResolvedValue(mockTrackingInfo);

      const request = new MockNextRequest('http://localhost:3000/api/courier/track?trackingNumber=TRACK123&courierCode=FAST');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.trackingNumber).toBe('TRACK123');
      expect(data.status).toBe('IN_TRANSIT');
    });

    it('should return 400 for missing tracking number or courier code', async () => {
      const request = new MockNextRequest('http://localhost:3000/api/courier/track?trackingNumber=TRACK123');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Tracking number and courier code required');
    });

    it('should return 500 on server error', async () => {
      (sriLankaCourierService.trackShipment as jest.Mock).mockRejectedValue(new Error('Service error'));

      const request = new MockNextRequest('http://localhost:3000/api/courier/track?trackingNumber=TRACK123&courierCode=FAST');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });
  });
});

