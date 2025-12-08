import { GET, POST } from '../route';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { AdvancedPaymentService } from '@/lib/payments/advancedPaymentService';

// Mock NextRequest
class MockNextRequest {
  url: string;
  method: string;
  body: string;
  headers: Headers;
  
  constructor(url: string, init?: { method?: string; body?: unknown; headers?: HeadersInit }) {
    this.url = url;
    this.method = init?.method || 'GET';
    this.body = typeof init?.body === 'string' ? init.body : JSON.stringify(init?.body || {});
    this.headers = new Headers(init?.headers || {});
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
    subscription: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    paymentIntent: {
      findMany: jest.fn(),
    },
    invoice: {
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

// Create a mock service instance inside the factory to avoid hoisting issues
let mockServiceInstance: ReturnType<typeof createMockService>;

const createMockService = () => ({
  getPaymentAnalytics: jest.fn(),
  getCustomerPaymentMethods: jest.fn(),
  createPaymentIntent: jest.fn(),
  confirmPayment: jest.fn(),
  createCustomer: jest.fn(),
  addPaymentMethod: jest.fn(),
  createSubscription: jest.fn(),
  cancelSubscription: jest.fn(),
  processRefund: jest.fn(),
  setDefaultPaymentMethod: jest.fn(),
  deletePaymentMethod: jest.fn(),
  createPaymentLink: jest.fn(),
  handleWebhook: jest.fn(),
  bulkRefund: jest.fn(),
  updateSubscription: jest.fn(),
  createInvoice: jest.fn(),
});

jest.mock('@/lib/payments/advancedPaymentService', () => {
  // Create mocks inside factory
  const mockService = {
    getPaymentAnalytics: jest.fn(),
    getCustomerPaymentMethods: jest.fn(),
    createPaymentIntent: jest.fn(),
    confirmPayment: jest.fn(),
    createCustomer: jest.fn(),
    addPaymentMethod: jest.fn(),
    createSubscription: jest.fn(),
    cancelSubscription: jest.fn(),
    processRefund: jest.fn(),
    setDefaultPaymentMethod: jest.fn(),
    deletePaymentMethod: jest.fn(),
    createPaymentLink: jest.fn(),
    handleWebhook: jest.fn(),
    bulkRefund: jest.fn(),
    updateSubscription: jest.fn(),
    createInvoice: jest.fn(),
  };
  
  // Store reference globally so tests can access it
  (global as any).__mockAdvancedPaymentService = mockService;
  
  return {
    AdvancedPaymentService: jest.fn().mockImplementation(() => mockService),
  };
});

describe('/api/payments/advanced', () => {
  const mockSession = {
    user: {
      id: 'user-1',
      email: 'test@example.com',
      organizationId: 'org-1',
    },
  };

  // Get the mock service instance
  const getMockService = () => (global as any).__mockAdvancedPaymentService;

  beforeEach(() => {
    jest.clearAllMocks();
    (getServerSession as jest.Mock).mockResolvedValue(mockSession);
    // Clear all mock functions
    const mockService = getMockService();
    if (mockService) {
      Object.values(mockService).forEach((mockFn) => {
        if (jest.isMockFunction(mockFn)) {
          mockFn.mockClear();
        }
      });
    }
  });

  describe('GET', () => {
    it('should return 401 for unauthorized requests', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(null);

      const request = new MockNextRequest('http://localhost:3000/api/payments/advanced');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return payment analytics', async () => {
      const mockUser = { email: 'test@example.com', organizationId: 'org-1', organization: { id: 'org-1' } };
      const mockAnalytics = { totalRevenue: 10000, totalTransactions: 100 };
      getMockService().getPaymentAnalytics.mockResolvedValue(mockAnalytics);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const request = new MockNextRequest('http://localhost:3000/api/payments/advanced?action=analytics');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.analytics).toBeDefined();
      expect(data.analytics.totalRevenue).toBe(10000);
    });

    it('should return payment methods', async () => {
      const mockMethods = [{ id: 'pm_123', type: 'card' }];
      getMockService().getCustomerPaymentMethods.mockResolvedValue(mockMethods);

      const request = new MockNextRequest('http://localhost:3000/api/payments/advanced?action=payment-methods&customerId=cus_123');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.paymentMethods).toEqual(mockMethods);
    });

    it('should return 400 for missing customerId on payment-methods', async () => {
      const request = new MockNextRequest('http://localhost:3000/api/payments/advanced?action=payment-methods');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Customer ID required');
    });

    it('should return subscriptions', async () => {
      const mockSubscriptions = [{ id: 'sub_123', status: 'active' }];
      (prisma.subscription.findMany as jest.Mock).mockResolvedValue(mockSubscriptions);

      const request = new MockNextRequest('http://localhost:3000/api/payments/advanced?action=subscriptions&customerId=cus_123');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.subscriptions).toEqual(mockSubscriptions);
    });

    it('should return payment intents', async () => {
      const mockIntents = [{ id: 'pi_123', status: 'succeeded' }];
      (prisma.paymentIntent.findMany as jest.Mock).mockResolvedValue(mockIntents);

      const request = new MockNextRequest('http://localhost:3000/api/payments/advanced?action=payment-intents&customerId=cus_123');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.paymentIntents).toEqual(mockIntents);
    });

    it('should return invoices', async () => {
      const mockInvoices = [{ id: 'inv_123', status: 'paid' }];
      (prisma.invoice.findMany as jest.Mock).mockResolvedValue(mockInvoices);

      const request = new MockNextRequest('http://localhost:3000/api/payments/advanced?action=invoices&customerId=cus_123');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.invoices).toEqual(mockInvoices);
    });

    it('should return 400 for invalid action', async () => {
      const request = new MockNextRequest('http://localhost:3000/api/payments/advanced?action=invalid');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid action');
    });
  });

  describe('POST', () => {
    it('should return 401 for unauthorized requests', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(null);

      const request = new MockNextRequest('http://localhost:3000/api/payments/advanced', {
        method: 'POST',
        body: JSON.stringify({ action: 'create-payment-intent' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should create payment intent', async () => {
      const mockIntent = { id: 'pi_123', status: 'requires_payment_method' };
      getMockService().createPaymentIntent.mockResolvedValue(mockIntent);

      const request = new MockNextRequest('http://localhost:3000/api/payments/advanced', {
        method: 'POST',
        body: JSON.stringify({
          action: 'create-payment-intent',
          amount: 1000,
          currency: 'usd',
          customerId: 'cus_123',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.paymentIntent).toEqual(mockIntent);
    });

    it('should confirm payment', async () => {
      const mockPayment = { id: 'pay_123', status: 'succeeded' };
      getMockService().confirmPayment.mockResolvedValue(mockPayment);

      const request = new MockNextRequest('http://localhost:3000/api/payments/advanced', {
        method: 'POST',
        body: JSON.stringify({
          action: 'confirm-payment',
          paymentIntentId: 'pi_123',
          paymentMethodId: 'pm_123',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.payment).toEqual(mockPayment);
    });

    it('should create customer', async () => {
      getMockService().createCustomer.mockResolvedValue('cus_123');

      const request = new MockNextRequest('http://localhost:3000/api/payments/advanced', {
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

    it('should add payment method', async () => {
      const mockMethod = { id: 'pm_123', type: 'card' };
      getMockService().addPaymentMethod.mockResolvedValue(mockMethod);

      const request = new MockNextRequest('http://localhost:3000/api/payments/advanced', {
        method: 'POST',
        body: JSON.stringify({
          action: 'add-payment-method',
          customerId: 'cus_123',
          paymentMethodId: 'pm_123',
          isDefault: true,
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.paymentMethod).toEqual(mockMethod);
    });

    it('should create subscription', async () => {
      const mockSubscription = { id: 'sub_123', status: 'active' };
      getMockService().createSubscription.mockResolvedValue(mockSubscription);

      const request = new MockNextRequest('http://localhost:3000/api/payments/advanced', {
        method: 'POST',
        body: JSON.stringify({
          action: 'create-subscription',
          customerId: 'cus_123',
          priceId: 'price_123',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.subscription).toEqual(mockSubscription);
    });

    it('should cancel subscription', async () => {
      const mockSubscription = { id: 'sub_123', status: 'canceled' };
      getMockService().cancelSubscription.mockResolvedValue(mockSubscription);

      const request = new MockNextRequest('http://localhost:3000/api/payments/advanced', {
        method: 'POST',
        body: JSON.stringify({
          action: 'cancel-subscription',
          subscriptionId: 'sub_123',
          cancelAtPeriodEnd: false,
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.subscription.status).toBe('canceled');
    });

    it('should process refund', async () => {
      const mockRefund = { id: 'refund_123', status: 'succeeded' };
      getMockService().processRefund.mockResolvedValue(mockRefund);

      const request = new MockNextRequest('http://localhost:3000/api/payments/advanced', {
        method: 'POST',
        body: JSON.stringify({
          action: 'process-refund',
          paymentIntentId: 'pi_123',
          amount: 500,
          reason: 'requested_by_customer',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.refund).toEqual(mockRefund);
    });

    it('should set default payment method', async () => {
      getMockService().setDefaultPaymentMethod.mockResolvedValue(undefined);

      const request = new MockNextRequest('http://localhost:3000/api/payments/advanced', {
        method: 'POST',
        body: JSON.stringify({
          action: 'set-default-payment-method',
          customerId: 'cus_123',
          paymentMethodId: 'pm_123',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should delete payment method', async () => {
      getMockService().deletePaymentMethod.mockResolvedValue(undefined);

      const request = new MockNextRequest('http://localhost:3000/api/payments/advanced', {
        method: 'POST',
        body: JSON.stringify({
          action: 'delete-payment-method',
          paymentMethodId: 'pm_123',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should create payment link', async () => {
      const mockLink = { id: 'link_123', url: 'https://checkout.stripe.com/link_123' };
      getMockService().createPaymentLink.mockResolvedValue(mockLink);

      const request = new MockNextRequest('http://localhost:3000/api/payments/advanced', {
        method: 'POST',
        body: JSON.stringify({
          action: 'create-payment-link',
          amount: 1000,
          currency: 'usd',
          description: 'Test payment',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.paymentLink).toEqual(mockLink);
    });

    it('should handle webhook', async () => {
      getMockService().handleWebhook.mockResolvedValue(undefined);

      const headers = new Headers();
      headers.set('stripe-signature', 'signature_123');
      
      // The route expects action: 'webhook' in body, then reads raw text
      const request = new MockNextRequest('http://localhost:3000/api/payments/advanced', {
        method: 'POST',
        body: JSON.stringify({ action: 'webhook' }),
        headers: headers,
      });
      // Override the text() method to return the webhook event
      (request as any).text = jest.fn().mockResolvedValue('{"type":"payment_intent.succeeded"}');
      
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.received).toBe(true);
    });

    it('should return 400 for missing signature on webhook', async () => {
      const request = new MockNextRequest('http://localhost:3000/api/payments/advanced', {
        method: 'POST',
        body: JSON.stringify({
          action: 'webhook',
          type: 'payment_intent.succeeded',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('No signature');
    });

    it('should process bulk refund', async () => {
      const mockRefunds = [
        { id: 'refund_1', status: 'succeeded' },
        { id: 'refund_2', status: 'succeeded' },
      ];
      getMockService().processRefund
        .mockResolvedValueOnce(mockRefunds[0])
        .mockResolvedValueOnce(mockRefunds[1]);

      const request = new MockNextRequest('http://localhost:3000/api/payments/advanced', {
        method: 'POST',
        body: JSON.stringify({
          action: 'bulk-refund',
          paymentIntentIds: ['pi_1', 'pi_2'],
          reason: 'requested_by_customer',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.refunds).toHaveLength(2);
    });

    it('should update subscription', async () => {
      const mockSubscription = { id: 'sub_123', metadata: { key: 'value' } };
      (prisma.subscription.update as jest.Mock).mockResolvedValue(mockSubscription);

      const request = new MockNextRequest('http://localhost:3000/api/payments/advanced', {
        method: 'POST',
        body: JSON.stringify({
          action: 'update-subscription',
          subscriptionId: 'sub_123',
          metadata: { key: 'value' },
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.subscription).toEqual(mockSubscription);
    });

    it('should create invoice', async () => {
      const mockInvoice = { id: 'inv_123', status: 'draft' };
      (prisma.invoice.create as jest.Mock).mockResolvedValue(mockInvoice);

      const request = new MockNextRequest('http://localhost:3000/api/payments/advanced', {
        method: 'POST',
        body: JSON.stringify({
          action: 'create-invoice',
          customerId: 'cus_123',
          amount: 1000,
          currency: 'usd',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.invoice).toEqual(mockInvoice);
    });

    it('should return 400 for invalid action', async () => {
      const request = new MockNextRequest('http://localhost:3000/api/payments/advanced', {
        method: 'POST',
        body: JSON.stringify({ action: 'invalid-action' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid action');
    });

    it('should return 500 on server error', async () => {
      getMockService().createPaymentIntent.mockRejectedValue(new Error('Service error'));

      const request = new MockNextRequest('http://localhost:3000/api/payments/advanced', {
        method: 'POST',
        body: JSON.stringify({
          action: 'create-payment-intent',
          amount: 1000,
          currency: 'usd',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });
  });
});
