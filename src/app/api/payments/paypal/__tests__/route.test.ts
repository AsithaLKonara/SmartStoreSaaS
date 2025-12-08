import { POST } from '../route';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { paypalService } from '@/lib/payments/paypalService';

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
    user: {
      findUnique: jest.fn(),
    },
    order: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    payment: {
      findFirst: jest.fn(),
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

jest.mock('@/lib/payments/paypalService', () => ({
  paypalService: {
    createOrder: jest.fn(),
    captureOrder: jest.fn(),
    getOrder: jest.fn(),
    createRefund: jest.fn(),
    createBillingPlan: jest.fn(),
  },
}));

describe('/api/payments/paypal', () => {
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
      (getServerSession as jest.Mock).mockResolvedValue(null);

      const request = new MockNextRequest('http://localhost:3000/api/payments/paypal', {
        method: 'POST',
        body: JSON.stringify({ action: 'create-order' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should create PayPal order', async () => {
      const mockOrder = { id: 'paypal_order_123', status: 'CREATED' };
      // Route checks organizationId: userId (user-1), so order must have organizationId: 'user-1'
      (prisma.order.findFirst as jest.Mock).mockResolvedValue({ id: 'order-1', organizationId: 'user-1' });
      (paypalService.createOrder as jest.Mock).mockResolvedValue(mockOrder);

      const request = new MockNextRequest('http://localhost:3000/api/payments/paypal', {
        method: 'POST',
        body: JSON.stringify({
          action: 'create-order',
          amount: 1000,
          currency: 'USD',
          orderId: 'order-1',
          returnUrl: 'https://example.com/return',
          cancelUrl: 'https://example.com/cancel',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe('paypal_order_123');
      expect(paypalService.createOrder).toHaveBeenCalled();
    });

    it('should capture PayPal order', async () => {
      const mockOrder = { id: 'paypal_order_123', status: 'COMPLETED' };
      (paypalService.captureOrder as jest.Mock).mockResolvedValue(mockOrder);
      // Route checks organizationId: userId and metadata path
      (prisma.order.findFirst as jest.Mock).mockResolvedValue({ 
        id: 'order-1', 
        organizationId: 'user-1',
        metadata: { paypalOrderId: 'paypal_order_123' }
      });

      const request = new MockNextRequest('http://localhost:3000/api/payments/paypal', {
        method: 'POST',
        body: JSON.stringify({
          action: 'capture-order',
          paypalOrderId: 'paypal_order_123',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('COMPLETED');
    });

    it('should get PayPal order', async () => {
      const mockOrder = { id: 'paypal_order_123', status: 'APPROVED' };
      (paypalService.getOrder as jest.Mock).mockResolvedValue(mockOrder);
      (prisma.order.findFirst as jest.Mock).mockResolvedValue({ 
        id: 'order-1', 
        organizationId: 'user-1',
        metadata: { paypalOrderId: 'paypal_order_123' }
      });

      const request = new MockNextRequest('http://localhost:3000/api/payments/paypal', {
        method: 'POST',
        body: JSON.stringify({
          action: 'get-order',
          paypalOrderId: 'paypal_order_123',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe('paypal_order_123');
    });

    it('should create refund', async () => {
      const mockRefund = { id: 'refund_123', status: 'COMPLETED' };
      (prisma.order.findFirst as jest.Mock).mockResolvedValue({ 
        id: 'order-1',
        organizationId: 'user-1',
        metadata: { paypalPaymentId: 'payment_123' }
      });
      (paypalService.createRefund as jest.Mock).mockResolvedValue(mockRefund);

      const request = new MockNextRequest('http://localhost:3000/api/payments/paypal', {
        method: 'POST',
        body: JSON.stringify({
          action: 'create-refund',
          paymentId: 'payment_123',
          amount: 500,
          currency: 'USD',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe('refund_123');
    });

    it('should return 404 for non-existent order on refund', async () => {
      (prisma.order.findFirst as jest.Mock).mockResolvedValue(null);

      const request = new MockNextRequest('http://localhost:3000/api/payments/paypal', {
        method: 'POST',
        body: JSON.stringify({
          action: 'create-refund',
          paymentId: 'non-existent',
          amount: 500,
          currency: 'USD',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Payment not found');
    });

    it('should create billing plan', async () => {
      const mockPlan = { id: 'plan_123', status: 'ACTIVE' };
      (paypalService.createBillingPlan as jest.Mock).mockResolvedValue(mockPlan);

      const request = new MockNextRequest('http://localhost:3000/api/payments/paypal', {
        method: 'POST',
        body: JSON.stringify({
          action: 'create-billing-plan',
          name: 'Monthly Plan',
          description: 'Monthly subscription plan',
          amount: 1000,
          currency: 'USD',
          interval: 'month',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe('plan_123');
    });

    it('should return 400 for invalid action', async () => {
      const request = new MockNextRequest('http://localhost:3000/api/payments/paypal', {
        method: 'POST',
        body: JSON.stringify({ action: 'invalid-action' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid action');
    });

    it('should return 500 on server error', async () => {
      // Mock order found, but PayPal service throws error
      (prisma.order.findFirst as jest.Mock).mockResolvedValue({ id: 'order-1', organizationId: 'user-1' });
      (paypalService.createOrder as jest.Mock).mockRejectedValue(new Error('PayPal API error'));

      const request = new MockNextRequest('http://localhost:3000/api/payments/paypal', {
        method: 'POST',
        body: JSON.stringify({
          action: 'create-order',
          amount: 1000,
          currency: 'USD',
          orderId: 'order-1',
          returnUrl: 'https://example.com/return',
          cancelUrl: 'https://example.com/cancel',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });
  });
});

