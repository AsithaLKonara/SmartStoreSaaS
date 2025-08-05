import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';

export interface PaymentMethod {
  id: string;
  type: 'card' | 'bank_account' | 'paypal' | 'crypto';
  last4?: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
  metadata?: any;
}

export interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  paymentMethodId: string;
  customerId: string;
  orderId?: string;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface Subscription {
  id: string;
  customerId: string;
  planId: string;
  status: 'active' | 'canceled' | 'past_due' | 'unpaid';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  metadata?: any;
}

export interface PaymentGateway {
  name: string;
  isActive: boolean;
  config: any;
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

  async createPaymentIntent(amount: number, currency: string, customerId: string, metadata?: any): Promise<PaymentIntent> {
    const intent = await this.stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: currency.toLowerCase(),
      customer: customerId,
      metadata
    });

    const paymentIntent = await prisma.paymentIntent.create({
      data: {
        stripePaymentIntentId: intent.id,
        amount,
        currency,
        status: intent.status,
        customerId,
        metadata: {
          ...metadata,
          stripeIntentId: intent.id
        }
      }
    });

    return paymentIntent;
  }

  async confirmPayment(paymentIntentId: string, paymentMethodId: string): Promise<PaymentIntent> {
    const intent = await this.stripe.paymentIntents.confirm(paymentIntentId, {
      payment_method: paymentMethodId
    });

    const paymentIntent = await prisma.paymentIntent.update({
      where: { stripePaymentIntentId: paymentIntentId },
      data: { status: intent.status }
    });

    return paymentIntent;
  }

  async createCustomer(email: string, name?: string, metadata?: any): Promise<string> {
    const customer = await this.stripe.customers.create({
      email,
      name,
      metadata
    });

    await prisma.customer.update({
      where: { email },
      data: { stripeCustomerId: customer.id }
    });

    return customer.id;
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
        stripePaymentMethodId: paymentMethodId,
        customerId,
        type: paymentMethod.type as any,
        last4: paymentMethod.card?.last4,
        brand: paymentMethod.card?.brand,
        expiryMonth: paymentMethod.card?.exp_month,
        expiryYear: paymentMethod.card?.exp_year,
        isDefault,
        metadata: paymentMethod
      }
    });

    return savedPaymentMethod;
  }

  async createSubscription(customerId: string, priceId: string, metadata?: any): Promise<Subscription> {
    const subscription = await this.stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      metadata
    });

    const savedSubscription = await prisma.subscription.create({
      data: {
        stripeSubscriptionId: subscription.id,
        customerId,
        planId: priceId,
        status: subscription.status,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        metadata: subscription
      }
    });

    return savedSubscription;
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

    return savedSubscription;
  }

  async processRefund(paymentIntentId: string, amount?: number, reason?: string): Promise<any> {
    const refund = await this.stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: amount ? Math.round(amount * 100) : undefined,
      reason: reason as any
    });

    await prisma.refund.create({
      data: {
        stripeRefundId: refund.id,
        paymentIntentId,
        amount: refund.amount / 100,
        reason: refund.reason,
        status: refund.status
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

    const successfulPayments = payments.filter(p => p.status === 'succeeded');
    const failedPayments = payments.filter(p => p.status === 'failed');

    const totalRevenue = successfulPayments.reduce((sum, p) => sum + p.amount, 0);
    const averageOrderValue = successfulPayments.length > 0 ? totalRevenue / successfulPayments.length : 0;

    const paymentMethodDistribution: Record<string, number> = {};
    successfulPayments.forEach(payment => {
      const method = payment.paymentMethod?.type || 'unknown';
      paymentMethodDistribution[method] = (paymentMethodDistribution[method] || 0) + 1;
    });

    const revenueByPeriod: Record<string, number> = {};
    successfulPayments.forEach(payment => {
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
      // Detach from Stripe
      await this.stripe.paymentMethods.detach(paymentMethod.stripePaymentMethodId);

      // Delete from database
      await prisma.paymentMethod.delete({
        where: { id: paymentMethodId }
      });
    }
  }

  async createPaymentLink(amount: number, currency: string, description: string, metadata?: any): Promise<string> {
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

  async handleWebhook(event: any): Promise<void> {
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

  private async handlePaymentSuccess(paymentIntent: any): Promise<void> {
    await prisma.paymentIntent.update({
      where: { stripePaymentIntentId: paymentIntent.id },
      data: { status: paymentIntent.status }
    });

    // Update order status if linked
    if (paymentIntent.metadata?.orderId) {
      await prisma.order.update({
        where: { id: paymentIntent.metadata.orderId },
        data: { status: 'paid' }
      });
    }
  }

  private async handlePaymentFailure(paymentIntent: any): Promise<void> {
    await prisma.paymentIntent.update({
      where: { stripePaymentIntentId: paymentIntent.id },
      data: { status: paymentIntent.status }
    });

    // Update order status if linked
    if (paymentIntent.metadata?.orderId) {
      await prisma.order.update({
        where: { id: paymentIntent.metadata.orderId },
        data: { status: 'payment_failed' }
      });
    }
  }

  private async handleInvoicePaymentSuccess(invoice: any): Promise<void> {
    // Handle successful subscription payment
    await prisma.invoice.create({
      data: {
        stripeInvoiceId: invoice.id,
        customerId: invoice.customer,
        subscriptionId: invoice.subscription,
        amount: invoice.amount_paid / 100,
        status: invoice.status,
        metadata: invoice
      }
    });
  }

  private async handleInvoicePaymentFailure(invoice: any): Promise<void> {
    // Handle failed subscription payment
    await prisma.invoice.create({
      data: {
        stripeInvoiceId: invoice.id,
        customerId: invoice.customer,
        subscriptionId: invoice.subscription,
        amount: invoice.amount_due / 100,
        status: invoice.status,
        metadata: invoice
      }
    });
  }

  private async handleSubscriptionUpdate(subscription: any): Promise<void> {
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

  private async handleSubscriptionCancellation(subscription: any): Promise<void> {
    await prisma.subscription.update({
      where: { stripeSubscriptionId: subscription.id },
      data: {
        status: 'canceled',
        cancelAtPeriodEnd: true
      }
    });
  }
} 