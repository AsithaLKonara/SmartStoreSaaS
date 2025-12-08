import { GET, POST } from '../route';
import { prisma } from '@/lib/prisma';
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
jest.mock('@/lib/prisma', () => ({
  prisma: {
    expense: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  },
}));

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));

describe('/api/expenses', () => {
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

      const request = new MockNextRequest('http://localhost:3000/api/expenses');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.message).toBe('Unauthorized');
    });

    it('should return expenses list', async () => {
      const mockExpenses = [
        { id: 'expense-1', description: 'Office Supplies', amount: 100, organizationId: 'org-1' },
      ];
      (prisma.expense.findMany as jest.Mock).mockResolvedValue(mockExpenses);

      const request = new MockNextRequest('http://localhost:3000/api/expenses');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data[0].description).toBe('Office Supplies');
    });

    it('should ensure organization data isolation', async () => {
      (prisma.expense.findMany as jest.Mock).mockResolvedValue([]);

      const request = new MockNextRequest('http://localhost:3000/api/expenses');
      await GET(request);

      expect(prisma.expense.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org-1' },
        })
      );
    });

    it('should return 500 on server error', async () => {
      (prisma.expense.findMany as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = new MockNextRequest('http://localhost:3000/api/expenses');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe('Internal server error');
    });
  });

  describe('POST', () => {
    it('should return 401 for unauthorized requests', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: {} });

      const request = new MockNextRequest('http://localhost:3000/api/expenses', {
        method: 'POST',
        body: JSON.stringify({ description: 'Test Expense', amount: 50 }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.message).toBe('Unauthorized');
    });

    it('should return 400 for missing required fields', async () => {
      const request = new MockNextRequest('http://localhost:3000/api/expenses', {
        method: 'POST',
        body: JSON.stringify({ description: 'Test Expense' }), // Missing amount
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toBe('Description and amount are required');
    });

    it('should create expense successfully', async () => {
      const mockExpense = {
        id: 'expense-1',
        description: 'Test Expense',
        amount: 50,
        organizationId: 'org-1',
        date: new Date(),
        metadata: {},
      };
      (prisma.expense.create as jest.Mock).mockResolvedValue(mockExpense);

      const request = new MockNextRequest('http://localhost:3000/api/expenses', {
        method: 'POST',
        body: JSON.stringify({
          description: 'Test Expense',
          amount: 50,
          category: 'Office',
          type: 'OPERATIONAL',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.description).toBe('Test Expense');
      expect(data.amount).toBe(50);
    });

    it('should return 500 on server error', async () => {
      (prisma.expense.create as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = new MockNextRequest('http://localhost:3000/api/expenses', {
        method: 'POST',
        body: JSON.stringify({
          description: 'Test Expense',
          amount: 50,
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe('Internal server error');
    });
  });
});

