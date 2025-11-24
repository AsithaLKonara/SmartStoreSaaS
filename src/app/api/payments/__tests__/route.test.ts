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
    this.body = init?.body || '{}';
  }
  
  async json() {
    return JSON.parse(this.body);
  }
}

// Mock dependencies
jest.mock('@/lib/prisma', () => ({
  prisma: {
    payment: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    order: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));

describe('/api/payments', () => {
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

      const request = new MockNextRequest('http://localhost:3000/api/payments');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.message).toBe('Unauthorized');
    });

    it('should return payments list', async () => {
      const mockPayments = [
        {
          id: 'payment-1',
          orderId: 'order-1',
          amount: 100,
          method: 'CARD',
          status: 'PAID',
          gateway: 'stripe',
          order: {
            orderNumber: 'ORD-001',
            customer: { name: 'Test Customer', email: 'test@example.com' },
          },
          metadata: { transactionId: 'TXN-123' },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      (prisma.payment.findMany as jest.Mock).mockResolvedValue(mockPayments);

      const request = new MockNextRequest('http://localhost:3000/api/payments');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.payments).toBeDefined();
      expect(data.payments[0].orderNumber).toBe('ORD-001');
    });

    it('should filter payments by status', async () => {
      (prisma.payment.findMany as jest.Mock).mockResolvedValue([]);

      const request = new MockNextRequest('http://localhost:3000/api/payments?status=PAID');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(prisma.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'PAID' }),
        })
      );
    });

    it('should filter payments by method', async () => {
      (prisma.payment.findMany as jest.Mock).mockResolvedValue([]);

      const request = new MockNextRequest('http://localhost:3000/api/payments?method=CARD');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(prisma.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ method: 'CARD' }),
        })
      );
    });

    it('should search payments', async () => {
      (prisma.payment.findMany as jest.Mock).mockResolvedValue([]);

      const request = new MockNextRequest('http://localhost:3000/api/payments?search=ORD-001');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(prisma.payment.findMany).toHaveBeenCalled();
    });
  });

  describe('POST', () => {
    it('should return 401 for unauthorized requests', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: {} });

      const request = new MockNextRequest('http://localhost:3000/api/payments', {
        method: 'POST',
        body: JSON.stringify({ orderId: 'order-1', amount: 100, method: 'CARD' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.message).toBe('Unauthorized');
    });

    it('should return 400 for missing required fields', async () => {
      const request = new MockNextRequest('http://localhost:3000/api/payments', {
        method: 'POST',
        body: JSON.stringify({ orderId: 'order-1' }), // Missing amount and method
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toBe('Order ID, amount, and method are required');
    });

    it('should return 404 for non-existent order', async () => {
      (prisma.order.findFirst as jest.Mock).mockResolvedValue(null);

      const request = new MockNextRequest('http://localhost:3000/api/payments', {
        method: 'POST',
        body: JSON.stringify({ orderId: 'non-existent', amount: 100, method: 'CARD' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.message).toBe('Order not found');
    });

    it('should return 400 if payment already exists', async () => {
      const mockOrder = { id: 'order-1', organizationId: 'org-1' };
      (prisma.order.findFirst as jest.Mock).mockResolvedValue(mockOrder);
      (prisma.payment.findFirst as jest.Mock).mockResolvedValue({ id: 'existing-payment' });

      const request = new MockNextRequest('http://localhost:3000/api/payments', {
        method: 'POST',
        body: JSON.stringify({ orderId: 'order-1', amount: 100, method: 'CARD' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toBe('Payment already exists for this order');
    });

    it('should create payment successfully', async () => {
      const mockOrder = { id: 'order-1', organizationId: 'org-1' };
      const mockPayment = {
        id: 'payment-1',
        orderId: 'order-1',
        amount: 100,
        method: 'CARD',
        status: 'PENDING',
        gateway: 'stripe',
        order: {
          customer: { name: 'Test Customer', email: 'test@example.com' },
        },
      };

      (prisma.order.findFirst as jest.Mock).mockResolvedValue(mockOrder);
      (prisma.payment.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.payment.create as jest.Mock).mockResolvedValue(mockPayment);
      (prisma.order.update as jest.Mock).mockResolvedValue({});

      const request = new MockNextRequest('http://localhost:3000/api/payments', {
        method: 'POST',
        body: JSON.stringify({
          orderId: 'order-1',
          amount: 100,
          method: 'CARD',
          status: 'PAID',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.payment).toBeDefined();
      expect(prisma.payment.create).toHaveBeenCalled();
      expect(prisma.order.update).toHaveBeenCalled();
    });

    it('should ensure organization data isolation', async () => {
      (prisma.payment.findMany as jest.Mock).mockResolvedValue([]);

      const request = new MockNextRequest('http://localhost:3000/api/payments');
      await GET(request);

      expect(prisma.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: 'org-1',
          }),
        })
      );
    });

    it('should return 500 on server error', async () => {
      (prisma.payment.findMany as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = new MockNextRequest('http://localhost:3000/api/payments');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe('Internal server error');
    });
  });
});

