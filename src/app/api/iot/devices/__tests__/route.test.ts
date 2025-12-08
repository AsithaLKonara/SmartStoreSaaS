import { GET, POST } from '../route';
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
    getDeviceStatus: jest.fn(),
    getWarehouseDevices: jest.fn(),
    registerDevice: jest.fn(),
  })),
}));

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));

describe('/api/iot/devices', () => {
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

      const request = new MockNextRequest('http://localhost:3000/api/iot/devices?deviceId=device-1');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.message).toBe('Unauthorized');
    });

    it('should return device status by deviceId', async () => {
      const mockDevice = { id: 'device-1', status: 'ONLINE', temperature: 25 };
      const mockService = {
        getDeviceStatus: jest.fn().mockResolvedValue(mockDevice),
      };
      (IoTService as jest.Mock).mockImplementation(() => mockService);

      const request = new MockNextRequest('http://localhost:3000/api/iot/devices?deviceId=device-1');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('ONLINE');
    });

    it('should return devices by warehouseId', async () => {
      const mockDevices = [{ id: 'device-1', name: 'Sensor 1' }];
      const mockService = {
        getWarehouseDevices: jest.fn().mockResolvedValue(mockDevices),
      };
      (IoTService as jest.Mock).mockImplementation(() => mockService);

      const request = new MockNextRequest('http://localhost:3000/api/iot/devices?warehouseId=warehouse-1');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
    });

    it('should return 400 for missing deviceId and warehouseId', async () => {
      const request = new MockNextRequest('http://localhost:3000/api/iot/devices');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toBe('Missing deviceId or warehouseId');
    });

    it('should return 500 on server error', async () => {
      const mockService = {
        getDeviceStatus: jest.fn().mockRejectedValue(new Error('Service error')),
      };
      (IoTService as jest.Mock).mockImplementation(() => mockService);

      const request = new MockNextRequest('http://localhost:3000/api/iot/devices?deviceId=device-1');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe('Internal server error');
    });
  });

  describe('POST', () => {
    it('should return 401 for unauthorized requests', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: {} });

      const request = new MockNextRequest('http://localhost:3000/api/iot/devices', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Device', type: 'TEMPERATURE' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.message).toBe('Unauthorized');
    });

    it('should register IoT device', async () => {
      const mockDevice = {
        id: 'device-1',
        name: 'Test Device',
        type: 'TEMPERATURE',
        organizationId: 'org-1',
      };
      const mockService = {
        registerDevice: jest.fn().mockResolvedValue(mockDevice),
      };
      (IoTService as jest.Mock).mockImplementation(() => mockService);

      const request = new MockNextRequest('http://localhost:3000/api/iot/devices', {
        method: 'POST',
        body: JSON.stringify({
          action: 'register',
          deviceId: 'device-1',
          deviceType: 'TEMPERATURE',
          name: 'Test Device',
          warehouseId: 'warehouse-1',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.name).toBe('Test Device');
    });

    it('should return 500 on server error', async () => {
      const mockService = {
        registerDevice: jest.fn().mockRejectedValue(new Error('Service error')),
      };
      (IoTService as jest.Mock).mockImplementation(() => mockService);

      const request = new MockNextRequest('http://localhost:3000/api/iot/devices', {
        method: 'POST',
        body: JSON.stringify({
          action: 'register',
          deviceId: 'device-1',
          deviceType: 'TEMPERATURE',
          name: 'Test Device',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe('Internal server error');
    });
  });
});

