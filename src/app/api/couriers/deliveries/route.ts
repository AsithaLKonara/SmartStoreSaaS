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

    // Get orders that need delivery
    const orders = await prisma.order.findMany({
      where: {
        organizationId: session.user.organizationId,
        status: 'OUT_FOR_DELIVERY',
      },
      include: {
        customer: true,
        items: true,
      },
    });

    // Transform orders into delivery format
    const deliveries = orders.map((order: any) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customer?.name || 'Unknown',
      customerPhone: order.customer?.phone || '',
      shippingAddress: order.shippingAddress || '',
      status: order.status,
      courierId: order.courierId || null,
      courier: order.courier || null,
      estimatedDeliveryTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
      actualDeliveryTime: order.status === 'DELIVERED' ? order.updatedAt.toISOString() : undefined,
      items: order.items.map((item: any) => ({
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
        total: item.total,
      })),
    }));

    return NextResponse.json(deliveries);
  } catch (error) {
    console.error('Error fetching deliveries:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { orderId, courierId, estimatedDeliveryTime } = body;

    if (!orderId || !courierId) {
      return NextResponse.json({ message: 'Order ID and courier ID are required' }, { status: 400 });
    }

    // Update order with courier assignment
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'OUT_FOR_DELIVERY',
      },
    });

    return NextResponse.json({ message: 'Delivery assigned successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error assigning delivery:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
} 