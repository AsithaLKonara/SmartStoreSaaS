import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // Get orders that need delivery
    const orders = await prisma.order.findMany({
      where: {
        organizationId: session.user.organizationId,
        status: { in: ['CONFIRMED', 'PACKED', 'OUT_FOR_DELIVERY'] }
      },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
        shipments: {
          include: {
            courier: true,
          },
        },
      },
    });

    // Transform orders into delivery format
    const deliveries = orders.map(order => {
      const shipment = order.shipments?.[0];
      return {
        id: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customer?.name || 'Unknown',
        pickupAddress: 'Warehouse Address', // This would come from warehouse settings
        deliveryAddress: (order.metadata as any)?.shippingAddress || 'Address not available',
        status: order.status === 'CONFIRMED' ? 'ASSIGNED' : 
                order.status === 'PACKED' ? 'PICKED_UP' : 
                order.status === 'OUT_FOR_DELIVERY' ? 'IN_TRANSIT' : 'ASSIGNED',
        assignedCourierId: shipment?.courierId || null,
        assignedCourierName: shipment?.courier?.name || null,
        estimatedDeliveryTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
        actualDeliveryTime: order.status === 'DELIVERED' ? order.updatedAt.toISOString() : undefined,
        distance: Math.floor(Math.random() * 50) + 5, // Random distance 5-55 km
        earnings: Math.floor(Math.random() * 500) + 100, // Random earnings 100-600
        createdAt: order.createdAt.toISOString(),
      };
    });

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
        shipments: {
          create: {
            courierId,
            status: 'IN_TRANSIT',
            metadata: {
              estimatedDeliveryTime: estimatedDeliveryTime ? new Date(estimatedDeliveryTime).toISOString() : undefined,
            },
          },
        },
      },
      include: {
        customer: true,
        shipments: {
          include: {
            courier: true,
          },
        },
      },
    });

    return NextResponse.json({ message: 'Delivery assigned successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error assigning delivery:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
} 