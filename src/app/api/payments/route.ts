import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma, executePrismaQuery, validateOrganizationId } from '@/lib/prisma';
import { handleApiError, validateSession } from '@/lib/api-error-handler';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const sessionValidation = validateSession(session);
    if (!sessionValidation.valid) {
      return NextResponse.json({ message: sessionValidation.error || 'Unauthorized' }, { status: 401 });
    }
    
    const organizationId = validateOrganizationId(session?.user?.organizationId);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const method = searchParams.get('method');
    const search = searchParams.get('search');

    const where: {
      organizationId: string;
      status?: string;
      method?: string;
      OR?: Array<{
        order?: {
          orderNumber?: { contains: string; mode: 'insensitive' };
          customer?: {
            name?: { contains: string; mode: 'insensitive' };
            phone?: { contains: string; mode: 'insensitive' };
          };
        };
        transactionId?: { contains: string; mode: 'insensitive' };
      }>;
    } = {
      organizationId,
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

    const payments = await executePrismaQuery(() =>
      prisma.payment.findMany({
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
      })
    );

    // Transform the data to match the frontend interface
    const transformedPayments = payments.map(payment => ({
      id: payment.id,
      orderId: payment.orderId,
      orderNumber: payment.order?.orderNumber || '',
      customer: payment.order?.customer || null,
      amount: payment.amount,
      method: payment.method,
      status: payment.status,
      transactionId: (payment.metadata as Prisma.InputJsonValue & { transactionId?: string })?.transactionId || null,
      gateway: payment.gateway,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      paidAt: payment.order?.updatedAt || null,
    }));

    return NextResponse.json({ payments: transformedPayments });
  } catch (error) {
    const session = await getServerSession(authOptions).catch(() => null);
    return handleApiError(error, request, session);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const sessionValidation = validateSession(session);
    if (!sessionValidation.valid) {
      return NextResponse.json({ message: sessionValidation.error || 'Unauthorized' }, { status: 401 });
    }
    
    const organizationId = validateOrganizationId(session?.user?.organizationId);

    const body = await request.json();
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
    const order = await executePrismaQuery(() =>
      prisma.order.findFirst({
      where: {
        id: orderId,
          organizationId,
      },
      })
    );

    if (!order) {
      return NextResponse.json({ message: 'Order not found' }, { status: 404 });
    }

    // Check if payment already exists for this order
    const existingPayment = await executePrismaQuery(() =>
      prisma.payment.findFirst({
      where: {
        orderId,
          organizationId,
      },
      })
    );

    if (existingPayment) {
      return NextResponse.json({ message: 'Payment already exists for this order' }, { status: 400 });
    }

    // Create payment
    const payment = await executePrismaQuery(() =>
      prisma.payment.create({
      data: {
        orderId,
        amount,
        method,
        status: status || 'PENDING',
        metadata: {
          transactionId: transactionId || `TXN_${Date.now()}`,
        },
        gateway: gateway || method,
        organizationId,
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
      })
    );

    // Update order payment status
    await executePrismaQuery(() =>
      prisma.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: status === 'PAID' ? 'PAID' : 'PENDING',
      },
      })
    );

    return NextResponse.json({ payment }, { status: 201 });
  } catch (error) {
    const session = await getServerSession(authOptions).catch(() => null);
    return handleApiError(error, request, session);
  }
} 