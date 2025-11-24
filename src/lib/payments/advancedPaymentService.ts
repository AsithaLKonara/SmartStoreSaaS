import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';

const prisma = new PrismaClient();

// Use string literals for OrderStatus since Prisma enums might not be available
const OrderStatus = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED'
} as const;

export interface PaymentMethod {
  id: string;
  type: string; // Changed from literal union to string to match Prisma model
  last4?: string | null; // Changed to allow null to match Prisma model
  brand?: string | null; // Changed to allow null to match Prisma model
  expiryMonth?: number | null; // Changed to allow null to match Prisma model
  expiryYear?: number | null; // Changed to allow null to match Prisma model
  isDefault: boolean;
  stripePaymentMethodId?: string | null; // Changed to allow null to match Prisma model
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  customerId: string;
}

export interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: string; // Changed from enum to string to match Prisma model
  paymentMethodId?: string; // Made optional to match Prisma model
  customerId: string;
  orderId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  stripePaymentIntentId?: string; // Added to match Prisma model
}

export interface Subscription {
  id: string;
  customerId: string;
  planId: string | null; // Changed to allow null to match Prisma model
  status: string; // Changed to string to match Prisma model
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  metadata?: Record<string, unknown>;
}

export interface PaymentGateway {
  name: string;
  isActive: boolean;
  config: Record<string, unknown>;
  supportedCurrencies: string[];
  supportedMethods: string[];
}

export interface PaymentAnalytics {
  totalRevenue: number;
  successfulPayments: number;
  failedPayments: number;
  averageOrderValue: number;
  paymentMethodDistribution: Record<string, number>;
  revenueByPeriod: Record<string, number>;
}

export class AdvancedPaymentService {
  private stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2023-10-16'
    });
  }

  async createPaymentIntent(data: {
    amount: number;
    currency: string;
    customerId: string;
    orderId?: string;
    paymentMethodId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<PaymentIntent> {
    const paymentIntent = await prisma.paymentIntent.create({
      data: {
        amount: data.amount,
        currency: data.currency,
        status: 'pending',
        customerId: data.customerId,
        orderId: data.orderId,
        paymentMethodId: data.paymentMethodId,
        metadata: data.metadata
      }
    });

    return {
      id: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: paymentIntent.status,
      paymentMethodId: paymentIntent.paymentMethodId || undefined,
      customerId: paymentIntent.customerId,
      orderId: paymentIntent.orderId || undefined,
      metadata: paymentIntent.metadata,
      createdAt: paymentIntent.createdAt,
      updatedAt: paymentIntent.updatedAt,
      stripePaymentIntentId: paymentIntent.stripePaymentIntentId || undefined
    };
  }

  async updatePaymentIntent(id: string, data: Partial<PaymentIntent>): Promise<PaymentIntent> {
    const paymentIntent = await prisma.paymentIntent.update({
      where: { id },
      data: {
        status: data.status,
        metadata: data.metadata,
        paymentMethodId: data.paymentMethodId,
        orderId: data.orderId
      }
    });

    return {
      id: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: paymentIntent.status,
      paymentMethodId: paymentIntent.paymentMethodId || undefined,
      customerId: paymentIntent.customerId,
      orderId: paymentIntent.orderId || undefined,
      metadata: paymentIntent.metadata,
      createdAt: paymentIntent.createdAt,
      updatedAt: paymentIntent.updatedAt,
      stripePaymentIntentId: paymentIntent.stripePaymentIntentId || undefined
    };
  }

  async confirmPayment(paymentIntentId: string, paymentMethodId: string): Promise<PaymentIntent> {
    const intent = await this.stripe.paymentIntents.confirm(paymentIntentId, {
      payment_method: paymentMethodId
    });

    const paymentIntent = await prisma.paymentIntent.update({
      where: { stripePaymentIntentId: paymentIntentId },
      data: { status: intent.status }
    });

    // Map Prisma object to PaymentIntent interface
    const mappedPaymentIntent: PaymentIntent = {
      id: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: paymentIntent.status,
      paymentMethodId: paymentIntent.paymentMethodId || undefined,
      customerId: paymentIntent.customerId,
      orderId: paymentIntent.orderId || undefined,
      metadata: paymentIntent.metadata,
      createdAt: paymentIntent.createdAt,
      updatedAt: paymentIntent.updatedAt
    };

    return mappedPaymentIntent;
  }

  async createCustomer(email: string, name?: string, metadata?: Record<string, unknown>): Promise<string> {
    const customer = await this.stripe.customers.create({
      email,
      name,
      metadata
    });

    // Note: Customer model doesn't have metadata field
    // Consider storing this information in a separate table or using tags
    // await prisma.customer.update({
    //   where: { id: customerId },
    //   data: {
    //     metadata: {
    //       stripeCustomerId
    //     }
    //   }
    // });

    return customer.id;
  }

  async findCustomerByEmail(email: string): Promise<Record<string, unknown> | null> {
    const customer = await prisma.customer.findFirst({
      where: { email }
    });

    if (!customer) {
      throw new Error(`Customer with email ${email} not found`);
    }

    return customer;
  }

  async updateCustomerStripeId(customerId: string, stripeCustomerId: string): Promise<void> {
    // Note: Customer model doesn't have metadata field
    // Consider storing this information in a separate table or using tags
    // await prisma.customer.update({
    //   where: { id: customerId },
    //   data: {
    //     metadata: {
    //       stripeCustomerId
    //     }
    //   }
    // });
  }

  async findCustomerByStripeId(stripeCustomerId: string): Promise<Record<string, unknown> | null> {
    // Note: Customer model doesn't have metadata field
    // Consider implementing this functionality when the field is available
    // For now, return null since we can't query by Stripe ID
    return null;
  }

  async addPaymentMethod(customerId: string, paymentMethodId: string, isDefault: boolean = false): Promise<PaymentMethod> {
    // Attach payment method to customer
    await this.stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId
    });

    if (isDefault) {
      await this.stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId
        }
      });
    }

    const paymentMethod = await this.stripe.paymentMethods.retrieve(paymentMethodId);

    const savedPaymentMethod = await prisma.paymentMethod.create({
      data: {
        customerId,
        type: paymentMethod.type as 'CASH_ON_DELIVERY' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'BANK_TRANSFER' | 'DIGITAL_WALLET' | 'PAYPAL' | 'STRIPE',
        last4: paymentMethod.card?.last4,
        brand: paymentMethod.card?.brand,
        expiryMonth: paymentMethod.card?.exp_month,
        expiryYear: paymentMethod.card?.exp_year,
        isDefault,
        metadata: {
          stripePaymentMethodId: paymentMethodId,
          stripePaymentMethod: paymentMethod as Record<string, unknown>
        }
      }
    });

    // Map Prisma object to PaymentMethod interface
    const mappedPaymentMethod: PaymentMethod = {
      id: savedPaymentMethod.id,
      type: savedPaymentMethod.type as 'card' | 'bank_account' | 'paypal' | 'crypto',
      last4: savedPaymentMethod.last4 || undefined,
      brand: savedPaymentMethod.brand || undefined,
      expiryMonth: savedPaymentMethod.expiryMonth || undefined,
      expiryYear: savedPaymentMethod.expiryYear || undefined,
      isDefault: savedPaymentMethod.isDefault,
      // stripePaymentMethodId stored in metadata
      // stripePaymentMethodId: savedPaymentMethod.stripePaymentMethodId || undefined,
      metadata: savedPaymentMethod.metadata,
      createdAt: savedPaymentMethod.createdAt,
      updatedAt: savedPaymentMethod.updatedAt,
      customerId: savedPaymentMethod.customerId
    };

    return mappedPaymentMethod;
  }

  async createSubscription(customerId: string, priceId: string, metadata?: Record<string, unknown>): Promise<Subscription> {
    const subscription = await this.stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      metadata
    });

    const savedSubscription = await prisma.subscription.create({
      data: {
        stripeSubscriptionId: subscription.id,
        customerId,
        status: subscription.status,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        metadata: subscription as Record<string, unknown> // Convert Stripe Response to JSON
      }
    });

    // Map Prisma object to Subscription interface
    const mappedSubscription: Subscription = {
      id: savedSubscription.id,
      customerId: savedSubscription.customerId,
      planId: 'default-plan', // Default plan ID since Prisma model doesn't have this field
      status: savedSubscription.status as string,
      currentPeriodStart: savedSubscription.currentPeriodStart,
      currentPeriodEnd: savedSubscription.currentPeriodEnd,
      cancelAtPeriodEnd: savedSubscription.cancelAtPeriodEnd,
      metadata: savedSubscription.metadata
    };

    return mappedSubscription;
  }

  async cancelSubscription(subscriptionId: string, cancelAtPeriodEnd: boolean = true): Promise<Subscription> {
    const subscription = await this.stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: cancelAtPeriodEnd
    });

    const savedSubscription = await prisma.subscription.update({
      where: { stripeSubscriptionId: subscriptionId },
      data: {
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancel_at_period_end
      }
    });

    // Add planId if missing (required by Subscription type)
    return {
      ...savedSubscription,
      planId: ((savedSubscription.metadata as Record<string, unknown> & { planId?: string })?.planId) || '',
    };
  }

  async processRefund(paymentIntentId: string, amount?: number, reason?: string): Promise<Record<string, unknown>> {
    const paymentIntent = await prisma.paymentIntent.findUnique({
      where: { id: paymentIntentId }
    });

    if (!paymentIntent) {
      throw new Error(`Payment intent with id ${paymentIntentId} not found`);
    }

    const refund = await this.stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: amount ? Math.round(amount * 100) : undefined,
      reason: reason as 'duplicate' | 'fraudulent' | 'requested_by_customer' | undefined
    });

    // Note: Refund model may not exist in Prisma schema, using Payment model instead
    // await prisma.refund.create({
    await prisma.payment.create({
      data: {
        amount: (refund.amount || 0) / 100, // Handle null case
        status: (refund.status || 'pending') as 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REFUNDED' | 'CANCELLED',
        method: 'refund',
        currency: 'USD',
        organizationId: (paymentIntent.metadata as Record<string, unknown> & { organizationId?: string })?.organizationId || '',
        metadata: {
          paymentIntentId: paymentIntent.id,
          reason: refund.reason || 'requested_by_customer',
          stripeRefundId: refund.id,
        } as Record<string, unknown>,
      }
    });

    return refund;
  }

  async getPaymentAnalytics(organizationId: string, startDate: Date, endDate: Date): Promise<PaymentAnalytics> {
    const payments = await prisma.paymentIntent.findMany({
      where: {
        customer: { organizationId },
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      include: { paymentMethod: true }
    });

    const successfulPayments = payments.filter((p) => p.status === 'succeeded');
    const failedPayments = payments.filter((p) => p.status === 'failed');

    const totalRevenue = successfulPayments.reduce((sum: number, p) => sum + p.amount, 0);
    const averageOrderValue = successfulPayments.length > 0 ? totalRevenue / successfulPayments.length : 0;

    const paymentMethodDistribution: Record<string, number> = {};
    successfulPayments.forEach((payment) => {
      const method = payment.paymentMethod?.type || 'unknown';
      paymentMethodDistribution[method] = (paymentMethodDistribution[method] || 0) + 1;
    });

    const revenueByPeriod: Record<string, number> = {};
    successfulPayments.forEach((payment) => {
      const date = payment.createdAt.toISOString().split('T')[0];
      revenueByPeriod[date] = (revenueByPeriod[date] || 0) + payment.amount;
    });

    return {
      totalRevenue,
      successfulPayments: successfulPayments.length,
      failedPayments: failedPayments.length,
      averageOrderValue,
      paymentMethodDistribution,
      revenueByPeriod
    };
  }

  async getPaymentIntent(id: string): Promise<PaymentIntent> {
    const paymentIntent = await prisma.paymentIntent.findUnique({
      where: { id }
    });

    if (!paymentIntent) {
      throw new Error(`Payment intent with id ${id} not found`);
    }

    return {
      id: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: paymentIntent.status,
      paymentMethodId: paymentIntent.paymentMethodId || undefined,
      customerId: paymentIntent.customerId,
      orderId: paymentIntent.orderId || undefined,
      metadata: paymentIntent.metadata,
      createdAt: paymentIntent.createdAt,
      updatedAt: paymentIntent.updatedAt,
      stripePaymentIntentId: paymentIntent.stripePaymentIntentId || undefined
    };
  }

  async getCustomerPaymentMethods(customerId: string): Promise<PaymentMethod[]> {
    return await prisma.paymentMethod.findMany({
      where: { customerId },
      orderBy: { isDefault: 'desc' }
    });
  }

  async setDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<void> {
    // Update Stripe customer
    await this.stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId
      }
    });

    // Update database
    await prisma.paymentMethod.updateMany({
      where: { customerId },
      data: { isDefault: false }
    });

    await prisma.paymentMethod.update({
      where: { id: paymentMethodId },
      data: { isDefault: true }
    });
  }

  async deletePaymentMethod(paymentMethodId: string): Promise<void> {
    const paymentMethod = await prisma.paymentMethod.findUnique({
      where: { id: paymentMethodId }
    });

    if (paymentMethod) {
      // Detach from Stripe only if stripePaymentMethodId exists in metadata
      const stripePaymentMethodId = (paymentMethod.metadata as Record<string, unknown> & { stripePaymentMethodId?: string })?.stripePaymentMethodId;
      if (stripePaymentMethodId) {
      await this.stripe.paymentMethods.detach(stripePaymentMethodId);
      }

      // Delete from database
      await prisma.paymentMethod.delete({
        where: { id: paymentMethodId }
      });
    }
  }

  async createPaymentLink(amount: number, currency: string, description: string, metadata?: Record<string, unknown>): Promise<string> {
    const paymentLink = await this.stripe.paymentLinks.create({
      line_items: [{
        price_data: {
          currency: currency.toLowerCase(),
          product_data: {
            name: description
          },
          unit_amount: Math.round(amount * 100)
        },
        quantity: 1
      }],
      metadata
    });

    return paymentLink.url;
  }

  async handleWebhook(event: { type: string; data: { object: Record<string, unknown> } }): Promise<void> {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentSuccess(event.data.object);
        break;
      case 'payment_intent.payment_failed':
        await this.handlePaymentFailure(event.data.object);
        break;
      case 'invoice.payment_succeeded':
        await this.handleInvoicePaymentSuccess(event.data.object);
        break;
      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailure(event.data.object);
        break;
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdate(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionCancellation(event.data.object);
        break;
    }
  }

  private async handlePaymentSuccess(paymentIntent: { id: string; status: string; metadata?: { orderId?: string } }): Promise<void> {
    await prisma.paymentIntent.update({
      where: { stripePaymentIntentId: paymentIntent.id },
      data: { status: paymentIntent.status }
    });

    // Update order status if linked
    if (paymentIntent.metadata?.orderId) {
      await prisma.order.update({
        where: { id: paymentIntent.metadata.orderId },
        data: { status: OrderStatus.CONFIRMED }
      });
    }
  }

  private async handlePaymentFailure(paymentIntent: { id: string; status: string; metadata?: { orderId?: string } }): Promise<void> {
    await prisma.paymentIntent.update({
      where: { stripePaymentIntentId: paymentIntent.id },
      data: { status: paymentIntent.status }
    });

    // Update order status if linked
    if (paymentIntent.metadata?.orderId) {
      await prisma.order.update({
        where: { id: paymentIntent.metadata.orderId },
        data: { status: OrderStatus.CANCELLED }
      });
    }
  }

  private async handleInvoicePaymentSuccess(invoice: { customer: string; subscription: string; amount_paid: number; status: string; id: string; [key: string]: unknown }): Promise<void> {
    // Handle successful subscription payment
    await prisma.invoice.create({
      data: {
        customerId: invoice.customer,
        subscriptionId: invoice.subscription,
        amount: invoice.amount_paid / 100,
        status: invoice.status,
        metadata: {
          stripeInvoiceId: invoice.id,
          ...invoice,
        } as Record<string, unknown>
      }
    });
  }

  private async handleInvoicePaymentFailure(invoice: { customer: string; subscription: string; amount_due: number; status: string; id: string; [key: string]: unknown }): Promise<void> {
    // Handle failed subscription payment
    await prisma.invoice.create({
      data: {
        customerId: invoice.customer,
        subscriptionId: invoice.subscription,
        amount: invoice.amount_due / 100,
        status: invoice.status,
        metadata: {
          stripeInvoiceId: invoice.id,
          ...invoice,
        } as Record<string, unknown>
      }
    });
  }

  private async handleSubscriptionUpdate(subscription: { id: string; status: string; current_period_start: number; current_period_end: number; cancel_at_period_end: boolean }): Promise<void> {
    await prisma.subscription.update({
      where: { stripeSubscriptionId: subscription.id },
      data: {
        status: subscription.status,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end
      }
    });
  }

  private async handleSubscriptionCancellation(subscription: { id: string }): Promise<void> {
    await prisma.subscription.update({
      where: { stripeSubscriptionId: subscription.id },
      data: {
        status: 'canceled',
        cancelAtPeriodEnd: true
      }
    });
  }
} 