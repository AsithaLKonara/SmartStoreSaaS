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
        status: { in: ['CONFIRMED', 'PACKED', 'SHIPPED'] }
      },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
        courier: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Transform orders into delivery format
    const deliveries = orders.map(order => ({
      id: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customer.name,
      pickupAddress: 'Warehouse Address', // This would come from warehouse settings
      deliveryAddress: order.shippingAddress,
      status: order.status === 'CONFIRMED' ? 'ASSIGNED' : 
              order.status === 'PACKED' ? 'PICKED_UP' : 
              order.status === 'SHIPPED' ? 'IN_TRANSIT' : 'ASSIGNED',
      assignedCourierId: order.courierId,
      assignedCourierName: order.courier?.name,
      estimatedDeliveryTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
      actualDeliveryTime: order.status === 'DELIVERED' ? order.updatedAt.toISOString() : undefined,
      distance: Math.floor(Math.random() * 50) + 5, // Random distance 5-55 km
      earnings: Math.floor(Math.random() * 500) + 100, // Random earnings 100-600
      createdAt: order.createdAt.toISOString(),
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
    const updatedOrder = await prisma.order.update({
      where: { 
        id: orderId,
        organizationId: session.user.organizationId,
      },
      data: {
        courierId,
        status: 'SHIPPED',
        estimatedDeliveryTime: estimatedDeliveryTime ? new Date(estimatedDeliveryTime) : undefined,
      },
      include: {
        customer: true,
        courier: true,
      },
    });

    return NextResponse.json(updatedOrder, { status: 200 });
  } catch (error) {
    console.error('Error assigning delivery:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
} 