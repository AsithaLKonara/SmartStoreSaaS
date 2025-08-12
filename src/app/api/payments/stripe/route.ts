import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { stripeService } from '@/lib/payments/stripeService';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
        return await createRefund(data, session.user.id);
      
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

async function createPaymentIntent(data: any, userId: string) {
  const { amount, currency, orderId, metadata } = data;
  
  // Get or create Stripe customer
  let customer = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true, email: true, name: true },
  });

  let stripeCustomerId = customer?.stripeCustomerId;
  
  if (!stripeCustomerId) {
    stripeCustomerId = await stripeService.createCustomer(
      customer?.email || '',
      customer?.name || '',
      { userId }
    );
    
    await prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId },
    });
  }

  const paymentIntent = await stripeService.createPaymentIntent(
    amount,
    currency,
    stripeCustomerId,
    { ...metadata, orderId, userId }
  );

  // Update order with payment intent ID
  if (orderId) {
    await prisma.order.update({
      where: { id: orderId },
      data: { stripePaymentIntentId: paymentIntent.id },
    });
  }

  return NextResponse.json(paymentIntent);
}

async function createCustomer(data: any, userId: string) {
  const { email, name } = data;
  
  const customerId = await stripeService.createCustomer(email, name, { userId });
  
  await prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customerId },
  });

  return NextResponse.json({ customerId });
}

async function getPaymentMethods(data: any, userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true },
  });

  if (!user?.stripeCustomerId) {
    return NextResponse.json({ paymentMethods: [] });
  }

  const paymentMethods = await stripeService.getPaymentMethods(user.stripeCustomerId);
  return NextResponse.json({ paymentMethods });
}

async function createSubscription(data: any, userId: string) {
  const { priceId, metadata } = data;
  
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true },
  });

  if (!user?.stripeCustomerId) {
    throw new Error('Customer not found');
  }

  const subscription = await stripeService.createSubscription(
    user.stripeCustomerId,
    priceId,
    { ...metadata, userId }
  );

  return NextResponse.json(subscription);
}

async function cancelSubscription(data: any, userId: string) {
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

async function createRefund(data: any, userId: string) {
  const { paymentIntentId, amount, reason } = data;
  
  // Verify user owns this payment
  const order = await prisma.order.findFirst({
    where: {
      stripePaymentIntentId: paymentIntentId,
      organizationId: userId, // Assuming organization ownership
    },
  });

  if (!order) {
    return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
  }

  const refund = await stripeService.createRefund(paymentIntentId, amount, reason);
  return NextResponse.json(refund);
}

async function getSubscriptionPlans() {
  const plans = await stripeService.getSubscriptionPlans();
  return NextResponse.json({ plans });
}

async function createSetupIntent(data: any, userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true },
  });

  if (!user?.stripeCustomerId) {
    throw new Error('Customer not found');
  }

  const setupIntent = await stripeService.createSetupIntent(user.stripeCustomerId);
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
