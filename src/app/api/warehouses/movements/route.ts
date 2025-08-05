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

    // For now, we'll simulate inventory movements based on order activities
    // In a real implementation, this would come from a dedicated movements table
    const orderActivities = await prisma.orderActivity.findMany({
      where: {
        order: { organizationId: session.user.organizationId },
        type: { in: ['CREATED', 'CONFIRMED', 'PACKED', 'SHIPPED'] },
      },
      include: {
        order: {
          include: {
            items: {
              include: {
                product: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Transform order activities into inventory movements
    const movements = orderActivities.map(activity => ({
      id: activity.id,
      productId: activity.order.items[0]?.productId || '',
      productName: activity.order.items[0]?.product.name || 'Unknown Product',
      type: activity.type === 'CREATED' ? 'out' : 'transfer' as any,
      quantity: activity.order.items[0]?.quantity || 0,
      fromLocation: 'Main Warehouse',
      toLocation: activity.type === 'SHIPPED' ? 'Out for Delivery' : 'Processing',
      reason: `Order ${activity.type.toLowerCase()}: ${activity.order.orderNumber}`,
      date: activity.createdAt.toISOString(),
      user: session.user.name || 'System',
    }));

    return NextResponse.json(movements);
  } catch (error) {
    console.error('Error fetching movements:', error);
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
    const { productId, type, quantity, fromLocation, toLocation, reason } = body;

    if (!productId || !type || !quantity || !reason) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }

    // Update product stock based on movement type
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return NextResponse.json({ message: 'Product not found' }, { status: 404 });
    }

    let newStockQuantity = product.stockQuantity;
    if (type === 'in') {
      newStockQuantity += quantity;
    } else if (type === 'out') {
      if (newStockQuantity < quantity) {
        return NextResponse.json({ message: 'Insufficient stock' }, { status: 400 });
      }
      newStockQuantity -= quantity;
    }

    // Update product stock
    await prisma.product.update({
      where: { id: productId },
      data: { stockQuantity: newStockQuantity },
    });

    // Create movement record (in a real implementation, this would be a separate table)
    const movement = {
      id: `movement_${Date.now()}`,
      productId,
      productName: product.name,
      type,
      quantity,
      fromLocation: fromLocation || 'Main Warehouse',
      toLocation: toLocation || 'Main Warehouse',
      reason,
      date: new Date().toISOString(),
      user: session.user.name || 'System',
    };

    return NextResponse.json(movement, { status: 201 });
  } catch (error) {
    console.error('Error creating movement:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
} 