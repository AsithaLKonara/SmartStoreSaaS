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
    const limit = parseInt(searchParams.get('limit') || '10');

    const orders = await prisma.order.findMany({
      where: {
        organizationId: session.user.organizationId,
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
    });

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
    console.error('Error fetching recent orders:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

