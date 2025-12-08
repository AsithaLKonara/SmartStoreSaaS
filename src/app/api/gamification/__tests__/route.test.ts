import { GET, POST } from '../route';
import { GamificationService } from '@/lib/gamification/gamificationService';
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
jest.mock('@/lib/gamification/gamificationService', () => ({
  GamificationService: jest.fn().mockImplementation(() => ({
    getUserAchievements: jest.fn(),
    getLeaderboard: jest.fn(),
    checkAndUnlockAchievements: jest.fn(),
    redeemReward: jest.fn(),
  })),
}));

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));

describe('/api/gamification', () => {
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

      const request = new MockNextRequest('http://localhost:3000/api/gamification');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.message).toBe('Unauthorized');
    });

    it('should return achievements when type=achievements', async () => {
      const mockAchievements = [{ id: 'ach-1', name: 'First Purchase' }];
      const mockService = {
        getUserAchievements: jest.fn().mockResolvedValue(mockAchievements),
      };
      (GamificationService as jest.Mock).mockImplementation(() => mockService);

      const request = new MockNextRequest('http://localhost:3000/api/gamification?type=achievements');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockAchievements);
    });

    it('should return leaderboard when type=leaderboard', async () => {
      const mockLeaderboard = [{ userId: 'user-1', points: 100 }];
      const mockService = {
        getLeaderboard: jest.fn().mockResolvedValue(mockLeaderboard),
      };
      (GamificationService as jest.Mock).mockImplementation(() => mockService);

      const request = new MockNextRequest('http://localhost:3000/api/gamification?type=leaderboard&period=all-time&leaderboardType=points');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockLeaderboard);
    });

    it('should return 400 for missing organizationId on leaderboard', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

      const request = new MockNextRequest('http://localhost:3000/api/gamification?type=leaderboard');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toBe('Organization not found');
    });

    it('should return 400 for invalid type', async () => {
      const request = new MockNextRequest('http://localhost:3000/api/gamification?type=invalid');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toBe('Invalid type parameter');
    });

    it('should return 500 on server error', async () => {
      const mockService = {
        getUserAchievements: jest.fn().mockRejectedValue(new Error('Service error')),
      };
      (GamificationService as jest.Mock).mockImplementation(() => mockService);

      const request = new MockNextRequest('http://localhost:3000/api/gamification?type=achievements');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe('Internal server error');
    });
  });

  describe('POST', () => {
    it('should return 401 for unauthorized requests', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(null);

      const request = new MockNextRequest('http://localhost:3000/api/gamification', {
        method: 'POST',
        body: JSON.stringify({ action: 'check' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.message).toBe('Unauthorized');
    });

    it('should check and unlock achievements', async () => {
      const mockUnlocked = ['ach-1', 'ach-2'];
      const mockService = {
        checkAndUnlockAchievements: jest.fn().mockResolvedValue(mockUnlocked),
      };
      (GamificationService as jest.Mock).mockImplementation(() => mockService);

      const request = new MockNextRequest('http://localhost:3000/api/gamification', {
        method: 'POST',
        body: JSON.stringify({
          action: 'check',
          eventType: 'purchase',
          eventData: { amount: 100 },
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.unlocked).toEqual(mockUnlocked);
    });

    it('should redeem reward', async () => {
      const mockResult = { success: true, rewardId: 'reward-1' };
      const mockService = {
        redeemReward: jest.fn().mockResolvedValue(mockResult),
      };
      (GamificationService as jest.Mock).mockImplementation(() => mockService);

      const request = new MockNextRequest('http://localhost:3000/api/gamification', {
        method: 'POST',
        body: JSON.stringify({
          action: 'redeem',
          rewardId: 'reward-1',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockResult);
    });

    it('should return 400 for invalid action', async () => {
      const request = new MockNextRequest('http://localhost:3000/api/gamification', {
        method: 'POST',
        body: JSON.stringify({ action: 'invalid' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toBe('Invalid action');
    });

    it('should return 500 on server error', async () => {
      const mockService = {
        checkAndUnlockAchievements: jest.fn().mockRejectedValue(new Error('Service error')),
      };
      (GamificationService as jest.Mock).mockImplementation(() => mockService);

      const request = new MockNextRequest('http://localhost:3000/api/gamification', {
        method: 'POST',
        body: JSON.stringify({
          action: 'check',
          eventType: 'purchase',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe('Internal server error');
    });
  });
});

