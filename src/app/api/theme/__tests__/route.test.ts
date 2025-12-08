import { GET, POST } from '../route';
import { prisma } from '@/lib/prisma';
import { ThemeService } from '@/lib/theme/themeService';
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
jest.mock('@/lib/theme/themeService', () => ({
  ThemeService: {
    getInstance: jest.fn(() => ({
      getDefaultConfig: jest.fn().mockReturnValue({ primaryColor: '#000000' }),
      getPresets: jest.fn().mockReturnValue([]),
      getPreset: jest.fn(),
      getSystemTheme: jest.fn().mockReturnValue({}),
      generateThemeCSS: jest.fn().mockReturnValue('body { color: #000; }'),
      applyTheme: jest.fn(),
      resetTheme: jest.fn(),
    })),
  },
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    userPreference: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  },
}));

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));

describe('/api/theme', () => {
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

      const request = new MockNextRequest('http://localhost:3000/api/theme');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return theme config', async () => {
      const mockUser = { id: 'user-1', email: 'test@example.com' };
      const mockTheme = { primaryColor: '#000000' };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.userPreference.findUnique as jest.Mock).mockResolvedValue({ themeConfig: JSON.stringify(mockTheme) });

      const request = new MockNextRequest('http://localhost:3000/api/theme?action=config');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.config).toBeDefined();
    });

    it('should return 500 on server error', async () => {
      (prisma.user.findUnique as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = new MockNextRequest('http://localhost:3000/api/theme?action=config');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });
  });

  describe('POST', () => {
    it('should return 401 for unauthorized requests', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(null);

      const request = new MockNextRequest('http://localhost:3000/api/theme', {
        method: 'POST',
        body: JSON.stringify({ primaryColor: '#000000' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should update theme settings', async () => {
      const mockUser = { id: 'user-1', email: 'test@example.com' };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.userPreference.upsert as jest.Mock).mockResolvedValue({ themeConfig: JSON.stringify({ primaryColor: '#FF0000' }) });

      const request = new MockNextRequest('http://localhost:3000/api/theme', {
        method: 'POST',
        body: JSON.stringify({ action: 'update-config', config: { primaryColor: '#FF0000' } }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should return 500 on server error', async () => {
      (prisma.user.findUnique as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = new MockNextRequest('http://localhost:3000/api/theme', {
        method: 'POST',
        body: JSON.stringify({ action: 'update-config', config: { primaryColor: '#000000' } }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });
  });
});

