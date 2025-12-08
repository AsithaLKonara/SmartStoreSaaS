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
    trainModel: jest.fn(),
  })),
}));

describe('/api/ai/ml/train', () => {
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

      const request = new MockNextRequest('http://localhost:3000/api/ai/ml/train', {
        method: 'POST',
        body: JSON.stringify({
          modelType: 'regression',
          trainingData: [],
          features: ['feature1'],
          targetVariable: 'target',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.message).toBe('Unauthorized');
    });

    it('should return 400 for missing required fields', async () => {
      const request = new MockNextRequest('http://localhost:3000/api/ai/ml/train', {
        method: 'POST',
        body: JSON.stringify({ modelType: 'regression' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toBe('Missing required fields');
    });

    it('should train model successfully', async () => {
      const mockService = {
        trainModel: jest.fn().mockResolvedValue({ modelId: 'model-1', accuracy: 0.95 }),
      };
      (CustomModelService as jest.Mock).mockImplementation(() => mockService);

      const request = new MockNextRequest('http://localhost:3000/api/ai/ml/train', {
        method: 'POST',
        body: JSON.stringify({
          modelType: 'regression',
          trainingData: [{ feature1: 1, target: 2 }],
          features: ['feature1'],
          targetVariable: 'target',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.modelId).toBe('model-1');
    });

    it('should return 500 on server error', async () => {
      const mockService = {
        trainModel: jest.fn().mockRejectedValue(new Error('Training error')),
      };
      (CustomModelService as jest.Mock).mockImplementation(() => mockService);

      const request = new MockNextRequest('http://localhost:3000/api/ai/ml/train', {
        method: 'POST',
        body: JSON.stringify({
          modelType: 'regression',
          trainingData: [],
          features: ['feature1'],
          targetVariable: 'target',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe('Internal server error');
    });
  });
});

