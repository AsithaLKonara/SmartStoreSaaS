import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AdvancedPaymentService } from '@/lib/payments/advancedPaymentService';

const paymentService = new AdvancedPaymentService();

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const customerId = searchParams.get('customerId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    switch (action) {
      case 'analytics':
        const user = await prisma.user.findUnique({
          where: { email: session.user.email },
          include: { organization: true }
        });
        
        if (!user?.organizationId) {
          return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        const analytics = await paymentService.getPaymentAnalytics(
          user.organizationId,
          startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
          endDate ? new Date(endDate) : new Date()
        );
        return NextResponse.json({ analytics });

      case 'payment-methods':
        if (!customerId) {
          return NextResponse.json({ error: 'Customer ID required' }, { status: 400 });
        }
        const paymentMethods = await paymentService.getCustomerPaymentMethods(customerId);
        return NextResponse.json({ paymentMethods });

      case 'subscriptions':
        if (!customerId) {
          return NextResponse.json({ error: 'Customer ID required' }, { status: 400 });
        }
        const subscriptions = await prisma.subscription.findMany({
          where: { customerId },
          include: { customer: true }
        });
        return NextResponse.json({ subscriptions });

      case 'payment-intents':
        const paymentIntents = await prisma.paymentIntent.findMany({
          where: { customerId },
          include: { customer: true, paymentMethod: true },
          orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json({ paymentIntents });

      case 'invoices':
        const invoices = await prisma.invoice.findMany({
          where: { customerId },
          include: { customer: true, subscription: true },
          orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json({ invoices });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Advanced Payment API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      case 'create-payment-intent':
        const paymentIntent = await paymentService.createPaymentIntent(
          data.amount,
          data.currency,
          data.customerId,
          data.metadata
        );
        return NextResponse.json({ paymentIntent });

      case 'confirm-payment':
        const confirmedPayment = await paymentService.confirmPayment(
          data.paymentIntentId,
          data.paymentMethodId
        );
        return NextResponse.json({ payment: confirmedPayment });

      case 'create-customer':
        const customerId = await paymentService.createCustomer(
          data.email,
          data.name,
          data.metadata
        );
        return NextResponse.json({ customerId });

      case 'add-payment-method':
        const paymentMethod = await paymentService.addPaymentMethod(
          data.customerId,
          data.paymentMethodId,
          data.isDefault
        );
        return NextResponse.json({ paymentMethod });

      case 'create-subscription':
        const subscription = await paymentService.createSubscription(
          data.customerId,
          data.priceId,
          data.metadata
        );
        return NextResponse.json({ subscription });

      case 'cancel-subscription':
        const canceledSubscription = await paymentService.cancelSubscription(
          data.subscriptionId,
          data.cancelAtPeriodEnd
        );
        return NextResponse.json({ subscription: canceledSubscription });

      case 'process-refund':
        const refund = await paymentService.processRefund(
          data.paymentIntentId,
          data.amount,
          data.reason
        );
        return NextResponse.json({ refund });

      case 'set-default-payment-method':
        await paymentService.setDefaultPaymentMethod(
          data.customerId,
          data.paymentMethodId
        );
        return NextResponse.json({ success: true });

      case 'delete-payment-method':
        await paymentService.deletePaymentMethod(data.paymentMethodId);
        return NextResponse.json({ success: true });

      case 'create-payment-link':
        const paymentLink = await paymentService.createPaymentLink(
          data.amount,
          data.currency,
          data.description,
          data.metadata
        );
        return NextResponse.json({ paymentLink });

      case 'webhook':
        // Handle Stripe webhook
        const signature = request.headers.get('stripe-signature');
        if (!signature) {
          return NextResponse.json({ error: 'No signature' }, { status: 400 });
        }

        const event = JSON.parse(await request.text());
        await paymentService.handleWebhook(event);
        return NextResponse.json({ received: true });

      case 'bulk-refund':
        const { paymentIntentIds, reason } = data;
        const refunds = [];
        for (const paymentIntentId of paymentIntentIds) {
          const refund = await paymentService.processRefund(paymentIntentId, undefined, reason);
          refunds.push(refund);
        }
        return NextResponse.json({ refunds });

      case 'update-subscription':
        const updatedSubscription = await prisma.subscription.update({
          where: { id: data.subscriptionId },
          data: {
            metadata: data.metadata
          }
        });
        return NextResponse.json({ subscription: updatedSubscription });

      case 'create-invoice':
        const invoice = await prisma.invoice.create({
          data: {
            customerId: data.customerId,
            subscriptionId: data.subscriptionId,
            amount: data.amount,
            currency: data.currency,
            status: 'draft',
            dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
            metadata: data.metadata
          }
        });
        return NextResponse.json({ invoice });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Advanced Payment API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 