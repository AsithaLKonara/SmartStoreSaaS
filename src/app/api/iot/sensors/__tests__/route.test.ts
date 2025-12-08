import { GET } from '../route';
import { IoTService } from '@/lib/iot/iotService';
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
jest.mock('@/lib/iot/iotService', () => ({
  IoTService: jest.fn().mockImplementation(() => ({
    getSmartShelfInventory: jest.fn(),
  })),
}));

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));

describe('/api/iot/sensors', () => {
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

      const request = new MockNextRequest('http://localhost:3000/api/iot/sensors?deviceId=device-1');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.message).toBe('Unauthorized');
    });

    it('should return smart shelf inventory', async () => {
      const mockInventory = { productId: 'product-1', quantity: 10, location: 'A1' };
      const mockService = {
        getSmartShelfInventory: jest.fn().mockResolvedValue(mockInventory),
      };
      (IoTService as jest.Mock).mockImplementation(() => mockService);

      const request = new MockNextRequest('http://localhost:3000/api/iot/sensors?deviceId=device-1');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.productId).toBe('product-1');
    });

    it('should return 400 for missing deviceId', async () => {
      const request = new MockNextRequest('http://localhost:3000/api/iot/sensors');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toBe('Missing deviceId');
    });

    it('should return 500 on server error', async () => {
      const mockService = {
        getSmartShelfInventory: jest.fn().mockRejectedValue(new Error('Service error')),
      };
      (IoTService as jest.Mock).mockImplementation(() => mockService);

      const request = new MockNextRequest('http://localhost:3000/api/iot/sensors?deviceId=device-1');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe('Internal server error');
    });
  });
});

