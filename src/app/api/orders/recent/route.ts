import { NextRequest, NextResponse } from 'next/server';
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
    const limit = parseInt(searchParams.get('limit') || '10');

    const orders = await executePrismaQuery(() =>
      prisma.order.findMany({
      where: {
          organizationId,
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      })
    );

    // Format orders for dashboard display
    const formattedOrders = orders.map(order => ({
      id: order.id,
      orderNumber: order.orderNumber,
      customer: order.customer?.name || 'Unknown Customer',
      amount: order.totalAmount,
      status: order.status.toLowerCase(),
      date: order.createdAt.toISOString(),
    }));

    return NextResponse.json(formattedOrders);
  } catch (error) {
    const session = await getServerSession(authOptions).catch(() => null);
    return handleApiError(error, request, session);
  }
}

