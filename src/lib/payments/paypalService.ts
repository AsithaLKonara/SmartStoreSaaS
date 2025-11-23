import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Use string literals for OrderStatus since Prisma enums might not be available
const OrderStatus = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED'
} as const;

interface PayPalConfig {
  clientId: string;
  clientSecret: string;
  environment: 'sandbox' | 'production';
}

export interface PayPalOrder {
  id: string; // Changed back to string since we need to return a valid order
  status: string;
  amount: {
    currency_code: string;
    value: string;
  };
  links: Array<{
    href: string;
    rel: string;
    method: string;
  }>;
}

export interface PayPalPayment {
  id: string;
  status: string;
  amount: {
    total: string;
    currency: string;
  };
  payer: {
    payment_method: string;
    payer_info: {
      email: string;
      first_name: string;
      last_name: string;
      payer_id: string;
    };
  };
}

// PayPal API response types
interface PayPalAPIResponse {
  id: string | null;
  status: string;
  links: Array<{
    href: string;
    rel: string;
    method: string;
  }>;
}

export class PayPalService {
  private config: PayPalConfig;
  private baseURL: string;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor() {
    this.config = {
      clientId: process.env.PAYPAL_CLIENT_ID!,
      clientSecret: process.env.PAYPAL_CLIENT_SECRET!,
      environment: (process.env.PAYPAL_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox',
    };
    
    this.baseURL = this.config.environment === 'sandbox' 
      ? 'https://api-m.sandbox.paypal.com'
      : 'https://api-m.paypal.com';
  }

  /**
   * Get access token for PayPal API
   */
  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const auth = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');
      
      const response = await fetch(`${this.baseURL}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });

      if (!response.ok) {
        throw new Error('Failed to get PayPal access token');
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      this.tokenExpiry = new Date(Date.now() + (data.expires_in * 1000));
      
      return this.accessToken!; // Use non-null assertion since we just set it
    } catch (error) {
      console.error('Error getting PayPal access token:', error);
      throw new Error('Failed to authenticate with PayPal');
    }
  }

  /**
   * Create a PayPal order
   */
  async createOrder(
    amount: number,
    currency: string = 'USD',
    orderId: string,
    returnUrl: string,
    cancelUrl: string
  ): Promise<PayPalOrder> {
    try {
      const accessToken = await this.getAccessToken();

      const orderData = {
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: orderId,
          amount: {
            currency_code: currency,
            value: amount.toFixed(2),
          },
          description: `Order #${orderId}`,
        }],
        application_context: {
          return_url: returnUrl,
          cancel_url: cancelUrl,
          brand_name: 'SmartStore AI',
          locale: 'en-US',
          landing_page: 'BILLING',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'PAY_NOW',
        },
      };

      const response = await fetch(`${this.baseURL}/v2/checkout/orders`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'PayPal-Request-Id': `${orderId}-${Date.now()}`,
        },
        body: JSON.stringify(orderData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`PayPal API error: ${error.message}`);
      }

      const order = await response.json() as PayPalAPIResponse;
      
      // Validate that we have a valid order ID
      if (!order.id || typeof order.id !== 'string') {
        throw new Error('PayPal order creation failed - invalid order ID returned');
      }

      // At this point, order.id is guaranteed to be a string
      const orderIdString = order.id;
      
      // Store PayPal order ID in database
      await prisma.order.updateMany({
        where: { id: orderId },
        data: { 
          metadata: {
            paypalOrderId: orderIdString,
          } as Record<string, unknown>,
        },
      });

      // Create a validated order object
      const validatedOrder: PayPalOrder = {
        id: orderIdString, // Use the validated string
        status: order.status,
        amount: {
          currency_code: currency,
          value: amount.toFixed(2),
        },
        links: order.links,
      };

      return validatedOrder;
    } catch (error) {
      console.error('Error creating PayPal order:', error);
      throw new Error('Failed to create PayPal order');
    }
  }

  /**
   * Capture a PayPal order
   */
  async captureOrder(paypalOrderId: string): Promise<PayPalPayment> {
    try {
      const accessToken = await this.getAccessToken();

      const response = await fetch(`${this.baseURL}/v2/checkout/orders/${paypalOrderId}/capture`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`PayPal capture error: ${error.message}`);
      }

      const captureData = await response.json();
      const payment = captureData.purchase_units[0].payments.captures[0];

      // Update order status in database
      await prisma.order.updateMany({
        where: { 
          metadata: {
            path: ['paypalOrderId'],
            equals: paypalOrderId,
          } as Record<string, unknown>,
        },
        data: {
          status: OrderStatus.CONFIRMED,
          metadata: {
            paypalPaymentId: payment.id,
          } as Record<string, unknown>,
        },
      });

      return {
        id: payment.id,
        status: payment.status,
        amount: {
          total: payment.amount.value,
          currency: payment.amount.currency_code,
        },
        payer: {
          payment_method: 'paypal',
          payer_info: {
            email: captureData.payer.email_address,
            first_name: captureData.payer.name.given_name,
            last_name: captureData.payer.name.surname,
            payer_id: captureData.payer.payer_id,
          },
        },
      };
    } catch (error) {
      console.error('Error capturing PayPal order:', error);
      throw new Error('Failed to capture PayPal payment');
    }
  }

  /**
   * Create a refund
   */
  async createRefund(
    paymentId: string,
    amount?: number,
    currency: string = 'USD',
    note?: string
  ): Promise<any> {
    try {
      const accessToken = await this.getAccessToken();

      const refundData: Record<string, unknown> = {
        note_to_payer: note || 'Refund processed',
      };

      if (amount) {
        refundData.amount = {
          value: amount.toFixed(2),
          currency_code: currency,
        };
      }

      const response = await fetch(`${this.baseURL}/v2/payments/captures/${paymentId}/refund`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(refundData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`PayPal refund error: ${error.message}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error creating PayPal refund:', error);
      throw new Error('Failed to create PayPal refund');
    }
  }

  /**
   * Get order details
   */
  async getOrder(paypalOrderId: string): Promise<any> {
    try {
      const accessToken = await this.getAccessToken();

      const response = await fetch(`${this.baseURL}/v2/checkout/orders/${paypalOrderId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to get PayPal order details');
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting PayPal order:', error);
      throw new Error('Failed to get PayPal order details');
    }
  }

  /**
   * Handle PayPal webhook events
   */
  async handleWebhook(headers: Record<string, string>, body: string): Promise<void> {
    try {
      // Verify webhook signature
      const isValid = await this.verifyWebhookSignature(headers, body);
      if (!isValid) {
        throw new Error('Invalid webhook signature');
      }

      const event = JSON.parse(body);

      switch (event.event_type) {
        case 'PAYMENT.CAPTURE.COMPLETED':
          await this.handlePaymentCaptured(event);
          break;
        case 'PAYMENT.CAPTURE.DENIED':
          await this.handlePaymentDenied(event);
          break;
        case 'PAYMENT.CAPTURE.REFUNDED':
          await this.handlePaymentRefunded(event);
          break;
        default:
          console.log(`Unhandled PayPal webhook event: ${event.event_type}`);
      }
    } catch (error) {
      console.error('Error handling PayPal webhook:', error);
      throw error;
    }
  }

  private async verifyWebhookSignature(headers: Record<string, string>, body: string): Promise<boolean> {
    try {
      const accessToken = await this.getAccessToken();

      const verificationData = {
        auth_algo: headers['paypal-auth-algo'],
        cert_id: headers['paypal-cert-id'],
        transmission_id: headers['paypal-transmission-id'],
        transmission_sig: headers['paypal-transmission-sig'],
        transmission_time: headers['paypal-transmission-time'],
        webhook_id: process.env.PAYPAL_WEBHOOK_ID!,
        webhook_event: JSON.parse(body),
      };

      const response = await fetch(`${this.baseURL}/v1/notifications/verify-webhook-signature`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(verificationData),
      });

      const result = await response.json();
      return result.verification_status === 'SUCCESS';
    } catch (error) {
      console.error('Error verifying PayPal webhook signature:', error);
      return false;
    }
  }

  private async handlePaymentCaptured(event: Record<string, unknown> & { resource?: { id?: string; supplementary_data?: { related_ids?: { order_id?: string } } } }): Promise<void> {
    const paymentId = event.resource.id;
    const orderId = event.resource.supplementary_data?.related_ids?.order_id;

    if (orderId) {
      await prisma.order.updateMany({
        where: { 
        metadata: {
          path: ['paypalOrderId'],
          equals: orderId,
        } as any,
      },
        data: {
          status: OrderStatus.CONFIRMED,
          metadata: {
          paypalPaymentId: paymentId,
        } as any,
        },
      });
    }

    console.log(`PayPal payment captured: ${paymentId}`);
  }

  private async handlePaymentDenied(event: Record<string, unknown> & { resource?: { id?: string; supplementary_data?: { related_ids?: { order_id?: string } } } }): Promise<void> {
    const orderId = event.resource.supplementary_data?.related_ids?.order_id;

    if (orderId) {
      await prisma.order.updateMany({
        where: { 
        metadata: {
          path: ['paypalOrderId'],
          equals: orderId,
        } as any,
      },
        data: {
          status: OrderStatus.CANCELLED,
        },
      });
    }

    console.log(`PayPal payment denied: ${event.resource.id}`);
  }

  private async handlePaymentRefunded(event: Record<string, unknown> & { resource?: { id?: string } }): Promise<void> {
    const paymentId = event.resource.id;
    
    // Update refund status in database
    console.log(`PayPal payment refunded: ${paymentId}`);
  }

  /**
   * Create subscription billing plan
   */
  async createBillingPlan(
    name: string,
    description: string,
    amount: number,
    currency: string = 'USD',
    interval: 'MONTH' | 'YEAR' = 'MONTH'
  ): Promise<any> {
    try {
      const accessToken = await this.getAccessToken();

      const planData = {
        product_id: await this.createProduct(name, description),
        name,
        description,
        billing_cycles: [{
          frequency: {
            interval_unit: interval,
            interval_count: 1,
          },
          tenure_type: 'REGULAR',
          sequence: 1,
          total_cycles: 0, // Infinite
          pricing_scheme: {
            fixed_price: {
              value: amount.toFixed(2),
              currency_code: currency,
            },
          },
        }],
        payment_preferences: {
          auto_bill_outstanding: true,
          setup_fee_failure_action: 'CONTINUE',
          payment_failure_threshold: 3,
        },
      };

      const response = await fetch(`${this.baseURL}/v1/billing/plans`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(planData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`PayPal plan creation error: ${error.message}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error creating PayPal billing plan:', error);
      throw new Error('Failed to create PayPal billing plan');
    }
  }

  private async createProduct(name: string, description: string): Promise<string> {
    const accessToken = await this.getAccessToken();

    const productData = {
      name,
      description,
      type: 'SERVICE',
      category: 'SOFTWARE',
    };

    const response = await fetch(`${this.baseURL}/v1/catalogs/products`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(productData),
    });

    const product = await response.json();
    return product.id;
  }
}

export const paypalService = new PayPalService();
