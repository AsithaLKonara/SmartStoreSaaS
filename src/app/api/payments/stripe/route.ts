import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { stripeService } from '@/lib/payments/stripeService';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    const { action, ...data } = await request.json();

    switch (action) {
      case 'create-payment-intent':
        return await createPaymentIntent(data, session.user.id);
      
      case 'create-customer':
        return await createCustomer(data, session.user.id);
      
      case 'get-payment-methods':
        return await getPaymentMethods(data, session.user.id);
      
      case 'create-subscription':
        return await createSubscription(data, session.user.id);
      
      case 'cancel-subscription':
        return await cancelSubscription(data, session.user.id);
      
      case 'create-refund':
        return await createRefund(data, session.user.id, organizationId);
      
      case 'get-subscription-plans':
        return await getSubscriptionPlans();
      
      case 'create-setup-intent':
        return await createSetupIntent(data, session.user.id);
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Stripe API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

interface PaymentIntentData {
  amount: number;
  currency: string;
  orderId?: string;
  metadata?: Record<string, unknown>;
}

async function createPaymentIntent(data: PaymentIntentData, userId: string) {
  const { amount, currency, orderId, metadata } = data;
  
  // Get or create Stripe customer
  const customer = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });

  // Get Stripe customer ID from user preferences
  const userPref = await prisma.userPreference.findUnique({
    where: { userId },
  });
  let stripeCustomerId = (userPref?.notifications as Prisma.InputJsonValue & { stripeCustomerId?: string })?.stripeCustomerId;
  
  if (!stripeCustomerId) {
    stripeCustomerId = await stripeService.createCustomer(
      customer?.email || '',
      customer?.name || '',
      { userId }
    );
    
    // Store Stripe customer ID in user preferences metadata
    await prisma.userPreference.upsert({
      where: { userId },
      update: {
        notifications: {
          stripeCustomerId,
        } as Prisma.InputJsonValue,
      },
      create: {
        userId,
        notifications: {
          stripeCustomerId,
        } as Prisma.InputJsonValue,
      },
    });
  }

  const paymentIntent = await stripeService.createPaymentIntent(
    amount,
    currency,
    stripeCustomerId,
    { ...metadata, ...(orderId ? { orderId } : {}), userId }
  );

  // Update order with payment intent ID
  if (orderId) {
    await prisma.order.update({
      where: { id: orderId },
      data: { 
        metadata: {
          stripePaymentIntentId: paymentIntent.id,
        },
      },
    });
  }

  return NextResponse.json(paymentIntent);
}

interface CustomerData {
  email: string;
  name: string;
}

async function createCustomer(data: CustomerData, userId: string) {
  const { email, name } = data;
  
  const customerId = await stripeService.createCustomer(email, name, { userId });
  
  // Store Stripe customer ID in user preferences metadata
  await prisma.userPreference.upsert({
    where: { userId },
    update: {
      notifications: {
        stripeCustomerId: customerId,
      } as Prisma.InputJsonValue,
    },
    create: {
      userId,
      notifications: {
        stripeCustomerId: customerId,
      } as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json({ customerId });
}

async function getPaymentMethods(_data: unknown, userId: string) {
  const userPref = await prisma.userPreference.findUnique({
    where: { userId },
  });

  const stripeCustomerId = (userPref?.notifications as Prisma.InputJsonValue & { stripeCustomerId?: string })?.stripeCustomerId;
  if (!stripeCustomerId) {
    return NextResponse.json({ paymentMethods: [] });
  }

  const paymentMethods = await stripeService.getPaymentMethods(stripeCustomerId);
  return NextResponse.json({ paymentMethods });
}

interface SubscriptionData {
  priceId: string;
  metadata?: Record<string, unknown>;
}

async function createSubscription(data: SubscriptionData, userId: string) {
  const { priceId, metadata } = data;
  
  const userPref = await prisma.userPreference.findUnique({
    where: { userId },
  });

  const stripeCustomerId = (userPref?.notifications as Prisma.InputJsonValue & { stripeCustomerId?: string })?.stripeCustomerId;
  if (!stripeCustomerId) {
    throw new Error('Customer not found');
  }

  const subscription = await stripeService.createSubscription(
      stripeCustomerId,
    priceId,
    { ...metadata, userId }
  );

  return NextResponse.json(subscription);
}

interface CancelSubscriptionData {
  subscriptionId: string;
}

async function cancelSubscription(data: CancelSubscriptionData, userId: string) {
  const { subscriptionId } = data;
  
  // Verify user owns this subscription
  const subscription = await prisma.subscription.findFirst({
    where: {
      stripeSubscriptionId: subscriptionId,
      customer: { id: userId },
    },
  });

  if (!subscription) {
    return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
  }

  const canceledSubscription = await stripeService.cancelSubscription(subscriptionId);
  return NextResponse.json(canceledSubscription);
}

interface RefundData {
  paymentIntentId: string;
  amount?: number;
  reason?: string;
}

async function createRefund(data: RefundData, userId: string, organizationId: string) {
  const { paymentIntentId, amount, reason } = data;
  
  // Verify user owns this payment
  const order = await prisma.order.findFirst({
    where: {
      metadata: {
        path: ['stripePaymentIntentId'],
        equals: paymentIntentId,
      } as { path: string[]; equals: string },
      organizationId: organizationId,
    },
  });

  if (!order) {
    return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
  }

  const refundReason = reason as 'duplicate' | 'fraudulent' | 'requested_by_customer' | undefined;
  const refund = await stripeService.createRefund(paymentIntentId, amount, refundReason);
  return NextResponse.json(refund);
}

async function getSubscriptionPlans() {
  const plans = await stripeService.getSubscriptionPlans();
  return NextResponse.json({ plans });
}

async function createSetupIntent(_data: unknown, userId: string) {
  const userPref = await prisma.userPreference.findUnique({
    where: { userId },
  });
  const stripeCustomerId = (userPref?.notifications as Prisma.InputJsonValue & { stripeCustomerId?: string })?.stripeCustomerId;
  if (!stripeCustomerId) {
    throw new Error('Customer not found');
  }
  const setupIntent = await stripeService.createSetupIntent(stripeCustomerId);
  return NextResponse.json(setupIntent);
}

// Webhook endpoint
export async function PUT(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    await stripeService.handleWebhook(body, signature);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    return NextResponse.json({ error: 'Webhook failed' }, { status: 400 });
  }
}
