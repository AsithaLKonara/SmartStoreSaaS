import { POST, PUT } from '../route';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { stripeService } from '@/lib/payments/stripeService';

// Mock NextRequest
class MockNextRequest {
  url: string;
  method: string;
  body: string;
  headers: Map<string, string>;
  
  constructor(url: string, init?: any) {
    this.url = url;
    this.method = init?.method || 'GET';
    this.body = init?.body || '{}';
    this.headers = new Map();
    if (init?.headers) {
      Object.entries(init.headers).forEach(([key, value]) => {
        this.headers.set(key, value as string);
      });
    }
  }
  
  async json() {
    return JSON.parse(this.body);
  }
  
  async text() {
    return this.body;
  }
}

// Mock dependencies
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    userPreference: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    order: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    subscription: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));

jest.mock('@/lib/payments/stripeService', () => ({
  stripeService: {
    createCustomer: jest.fn(),
    createPaymentIntent: jest.fn(),
    getPaymentMethods: jest.fn(),
    createSubscription: jest.fn(),
    cancelSubscription: jest.fn(),
    createRefund: jest.fn(),
    getSubscriptionPlans: jest.fn(),
    createSetupIntent: jest.fn(),
    handleWebhook: jest.fn(),
  },
}));

describe('/api/payments/stripe', () => {
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

      const request = new MockNextRequest('http://localhost:3000/api/payments/stripe', {
        method: 'POST',
        body: JSON.stringify({ action: 'create-payment-intent' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should create payment intent', async () => {
      const mockUser = { email: 'test@example.com', name: 'Test User' };
      const mockPaymentIntent = { id: 'pi_123', client_secret: 'secret_123' };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.userPreference.findUnique as jest.Mock).mockResolvedValue(null);
      (stripeService.createCustomer as jest.Mock).mockResolvedValue('cus_123');
      (stripeService.createPaymentIntent as jest.Mock).mockResolvedValue(mockPaymentIntent);
      (prisma.order.update as jest.Mock).mockResolvedValue({});

      const request = new MockNextRequest('http://localhost:3000/api/payments/stripe', {
        method: 'POST',
        body: JSON.stringify({
          action: 'create-payment-intent',
          amount: 1000,
          currency: 'usd',
          orderId: 'order-1',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe('pi_123');
      expect(stripeService.createPaymentIntent).toHaveBeenCalled();
    });

    it('should create customer', async () => {
      (stripeService.createCustomer as jest.Mock).mockResolvedValue('cus_123');
      (prisma.userPreference.upsert as jest.Mock).mockResolvedValue({});

      const request = new MockNextRequest('http://localhost:3000/api/payments/stripe', {
        method: 'POST',
        body: JSON.stringify({
          action: 'create-customer',
          email: 'test@example.com',
          name: 'Test User',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.customerId).toBe('cus_123');
    });

    it('should get payment methods', async () => {
      const mockMethods = [{ id: 'pm_123', type: 'card' }];
      (prisma.userPreference.findUnique as jest.Mock).mockResolvedValue({
        notifications: { stripeCustomerId: 'cus_123' },
      });
      (stripeService.getPaymentMethods as jest.Mock).mockResolvedValue(mockMethods);

      const request = new MockNextRequest('http://localhost:3000/api/payments/stripe', {
        method: 'POST',
        body: JSON.stringify({ action: 'get-payment-methods' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.paymentMethods).toEqual(mockMethods);
    });

    it('should return empty array if no customer', async () => {
      (prisma.userPreference.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new MockNextRequest('http://localhost:3000/api/payments/stripe', {
        method: 'POST',
        body: JSON.stringify({ action: 'get-payment-methods' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.paymentMethods).toEqual([]);
    });

    it('should create subscription', async () => {
      (prisma.userPreference.findUnique as jest.Mock).mockResolvedValue({
        notifications: { stripeCustomerId: 'cus_123' },
      });
      (stripeService.createSubscription as jest.Mock).mockResolvedValue({ id: 'sub_123' });

      const request = new MockNextRequest('http://localhost:3000/api/payments/stripe', {
        method: 'POST',
        body: JSON.stringify({
          action: 'create-subscription',
          priceId: 'price_123',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe('sub_123');
    });

    it('should cancel subscription', async () => {
      (prisma.subscription.findFirst as jest.Mock).mockResolvedValue({ id: 'sub_123' });
      (stripeService.cancelSubscription as jest.Mock).mockResolvedValue({ id: 'sub_123', status: 'canceled' });

      const request = new MockNextRequest('http://localhost:3000/api/payments/stripe', {
        method: 'POST',
        body: JSON.stringify({
          action: 'cancel-subscription',
          subscriptionId: 'sub_123',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('canceled');
    });

    it('should return 404 for non-existent subscription', async () => {
      (prisma.subscription.findFirst as jest.Mock).mockResolvedValue(null);

      const request = new MockNextRequest('http://localhost:3000/api/payments/stripe', {
        method: 'POST',
        body: JSON.stringify({
          action: 'cancel-subscription',
          subscriptionId: 'non-existent',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Subscription not found');
    });

    it('should create refund', async () => {
      (prisma.order.findFirst as jest.Mock).mockResolvedValue({ id: 'order-1' });
      (stripeService.createRefund as jest.Mock).mockResolvedValue({ id: 'refund_123' });

      const request = new MockNextRequest('http://localhost:3000/api/payments/stripe', {
        method: 'POST',
        body: JSON.stringify({
          action: 'create-refund',
          paymentIntentId: 'pi_123',
          amount: 500,
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe('refund_123');
    });

    it('should return 404 for non-existent payment', async () => {
      (prisma.order.findFirst as jest.Mock).mockResolvedValue(null);

      const request = new MockNextRequest('http://localhost:3000/api/payments/stripe', {
        method: 'POST',
        body: JSON.stringify({
          action: 'create-refund',
          paymentIntentId: 'non-existent',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Payment not found');
    });

    it('should get subscription plans', async () => {
      const mockPlans = [{ id: 'plan_1', name: 'Basic' }];
      (stripeService.getSubscriptionPlans as jest.Mock).mockResolvedValue(mockPlans);

      const request = new MockNextRequest('http://localhost:3000/api/payments/stripe', {
        method: 'POST',
        body: JSON.stringify({ action: 'get-subscription-plans' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.plans).toEqual(mockPlans);
    });

    it('should return 400 for invalid action', async () => {
      const request = new MockNextRequest('http://localhost:3000/api/payments/stripe', {
        method: 'POST',
        body: JSON.stringify({ action: 'invalid-action' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid action');
    });

    it('should return 500 on server error', async () => {
      (prisma.user.findUnique as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = new MockNextRequest('http://localhost:3000/api/payments/stripe', {
        method: 'POST',
        body: JSON.stringify({ action: 'create-payment-intent' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });
  });

  describe('PUT (Webhook)', () => {
    it('should return 400 for missing signature', async () => {
      const request = new MockNextRequest('http://localhost:3000/api/payments/stripe', {
        method: 'PUT',
        body: 'webhook body',
      });
      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing signature');
    });

    it('should handle webhook successfully', async () => {
      (stripeService.handleWebhook as jest.Mock).mockResolvedValue({});

      const request = new MockNextRequest('http://localhost:3000/api/payments/stripe', {
        method: 'PUT',
        body: 'webhook body',
        headers: { 'stripe-signature': 'signature_123' },
      });
      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.received).toBe(true);
      expect(stripeService.handleWebhook).toHaveBeenCalled();
    });
  });
});

