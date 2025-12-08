import { POST } from '../route';
import { getServerSession } from 'next-auth';
import { CustomModelService } from '@/lib/ai/ml/customModelService';

// Mock NextRequest
class MockNextRequest {
  url: string;
  method: string;
  body: string;
  
  constructor(url: string, init?: { method?: string; body?: unknown }) {
    this.url = url;
    this.method = init?.method || 'POST';
    this.body = typeof init?.body === 'string' ? init.body : JSON.stringify(init?.body || {});
  }
  
  async json() {
    return JSON.parse(this.body);
  }
}

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));

jest.mock('@/lib/ai/ml/customModelService', () => ({
  CustomModelService: jest.fn().mockImplementation(() => ({
    predict: jest.fn(),
  })),
}));

describe('/api/ai/ml/predict', () => {
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

  describe('POST', () => {
    it('should return 401 for unauthorized requests', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: {} });

      const request = new MockNextRequest('http://localhost:3000/api/ai/ml/predict', {
        method: 'POST',
        body: JSON.stringify({ modelId: 'model-1', input: {} }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.message).toBe('Unauthorized');
    });

    it('should return 400 for missing required fields', async () => {
      const request = new MockNextRequest('http://localhost:3000/api/ai/ml/predict', {
        method: 'POST',
        body: JSON.stringify({ modelId: 'model-1' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toBe('Missing required fields: modelId and input');
    });

    it('should make prediction successfully', async () => {
      const mockService = {
        predict: jest.fn().mockResolvedValue({ prediction: 0.85 }),
      };
      (CustomModelService as jest.Mock).mockImplementation(() => mockService);

      const request = new MockNextRequest('http://localhost:3000/api/ai/ml/predict', {
        method: 'POST',
        body: JSON.stringify({ modelId: 'model-1', input: { feature1: 1, feature2: 2 } }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.prediction).toBeDefined();
    });

    it('should return 500 on server error', async () => {
      const mockService = {
        predict: jest.fn().mockRejectedValue(new Error('Model error')),
      };
      (CustomModelService as jest.Mock).mockImplementation(() => mockService);

      const request = new MockNextRequest('http://localhost:3000/api/ai/ml/predict', {
        method: 'POST',
        body: JSON.stringify({ modelId: 'model-1', input: {} }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe('Internal server error');
    });
  });
});

