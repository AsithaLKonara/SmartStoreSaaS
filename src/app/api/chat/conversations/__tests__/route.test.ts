import { GET } from '../route';
import { prisma } from '@/lib/prisma';
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
jest.mock('@/lib/prisma', () => ({
  prisma: {
    chatMessage: {
      groupBy: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
    },
    customer: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));

describe('/api/chat/conversations', () => {
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

      const request = new MockNextRequest('http://localhost:3000/api/chat/conversations');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.message).toBe('Unauthorized');
    });

    it('should return conversations list', async () => {
      const mockGrouped = [
        {
          customerId: 'customer-1',
          _count: { id: 5 },
          _max: { createdAt: new Date() },
        },
      ];
      const mockCustomer = {
        id: 'customer-1',
        name: 'Test Customer',
        email: 'test@example.com',
      };
      const mockLastMessage = {
        id: 'msg-1',
        content: 'Hello',
        createdAt: new Date(),
      };

      (prisma.chatMessage.groupBy as jest.Mock).mockResolvedValue(mockGrouped);
      (prisma.customer.findUnique as jest.Mock).mockResolvedValue(mockCustomer);
      (prisma.chatMessage.findFirst as jest.Mock).mockResolvedValue(mockLastMessage);
      (prisma.chatMessage.count as jest.Mock).mockResolvedValue(2);

      const request = new MockNextRequest('http://localhost:3000/api/chat/conversations');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.conversations).toBeDefined();
      expect(Array.isArray(data.conversations)).toBe(true);
      if (data.conversations.length > 0) {
        expect(data.conversations[0].customerName).toBe('Test Customer');
      }
    });

    it('should ensure organization data isolation', async () => {
      (prisma.chatMessage.groupBy as jest.Mock).mockResolvedValue([]);

      const request = new MockNextRequest('http://localhost:3000/api/chat/conversations');
      await GET(request);

      expect(prisma.chatMessage.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: 'org-1',
          }),
        })
      );
    });

    it('should return 500 on server error', async () => {
      (prisma.chatMessage.groupBy as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = new MockNextRequest('http://localhost:3000/api/chat/conversations');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe('Internal server error');
    });
  });
});

