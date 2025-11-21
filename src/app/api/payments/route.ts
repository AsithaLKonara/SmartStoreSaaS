import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const method = searchParams.get('method');
    const search = searchParams.get('search');

    const where: any = {
      organizationId: session.user.organizationId,
    };

    if (status) {
      where.status = status;
    }

    if (method) {
      where.method = method;
    }

    if (search) {
      where.OR = [
        { order: { orderNumber: { contains: search, mode: 'insensitive' } } },
        { order: { customer: { name: { contains: search, mode: 'insensitive' } } } },
        { order: { customer: { phone: { contains: search, mode: 'insensitive' } } } },
        { transactionId: { contains: search, mode: 'insensitive' } },
      ];
    }

    const payments = await prisma.payment.findMany({
      where,
      include: {
        order: {
          include: {
            customer: {
              select: {
                name: true,
                phone: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Transform the data to match the frontend interface
    const transformedPayments = payments.map(payment => ({
      id: payment.id,
      orderId: payment.orderId,
<<<<<<< HEAD
      orderNumber: payment.order?.orderNumber || '',
      customer: payment.order?.customer || null,
      amount: payment.amount,
      method: payment.method,
      status: payment.status,
      transactionId: (payment.metadata as any)?.transactionId || null,
      gateway: payment.gateway,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      paidAt: payment.order?.updatedAt || null,
=======
      orderNumber: payment.order?.orderNumber,
      customer: payment.order?.customer,
      amount: payment.amount,
      method: payment.method,
      status: payment.status,
      gateway: payment.gateway,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
>>>>>>> 08d9e1855dc7fd2c99e5d62def516239ff37a9a7
    }));

    return NextResponse.json({ payments: transformedPayments });
  } catch (error) {
    console.error('Error fetching payments:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await _request.json();
    const {
      orderId,
      amount,
      method,
      status,
      transactionId,
      gateway,
    } = body;

    // Validation
    if (!orderId || !amount || !method) {
      return NextResponse.json({ message: 'Order ID, amount, and method are required' }, { status: 400 });
    }

    // Check if order exists and belongs to organization
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        organizationId: session.user.organizationId,
      },
    });

    if (!order) {
      return NextResponse.json({ message: 'Order not found' }, { status: 404 });
    }

    // Check if payment already exists for this order
    const existingPayment = await prisma.payment.findFirst({
      where: {
        orderId,
        organizationId: session.user.organizationId,
      },
    });

    if (existingPayment) {
      return NextResponse.json({ message: 'Payment already exists for this order' }, { status: 400 });
    }

    // Create payment
    const payment = await prisma.payment.create({
      data: {
        orderId,
        amount,
        method,
        status: status || 'PENDING',
<<<<<<< HEAD
        metadata: {
          transactionId: transactionId || `TXN_${Date.now()}`,
        },
=======
>>>>>>> 08d9e1855dc7fd2c99e5d62def516239ff37a9a7
        gateway: gateway || method,
        organizationId: session.user.organizationId,
      },
      include: {
        order: {
          include: {
            customer: {
              select: {
                name: true,
                phone: true,
                email: true,
              },
            },
          },
        },
      },
    });

    // Update order payment status
    await prisma.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: status === 'PAID' ? 'PAID' : 'PENDING',
      },
    });

    return NextResponse.json({ payment }, { status: 201 });
  } catch (error) {
    console.error('Error creating payment:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
} 