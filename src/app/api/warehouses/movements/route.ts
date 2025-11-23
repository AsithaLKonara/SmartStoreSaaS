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

    // Get movements filtered by organization through products
    const movements = await prisma.inventoryMovement.findMany({
      where: {
        product: {
          organizationId: session.user.organizationId,
        },
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            organizationId: true,
          },
        },
        warehouse: {
          select: {
            id: true,
            name: true,
          },
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // Format movements for response
    const formattedMovements = movements.map(movement => ({
      id: movement.id,
      productId: movement.productId,
      productName: movement.product.name,
      type: movement.type,
      quantity: movement.quantity,
      fromLocation: movement.fromLocation || (movement.warehouse?.name || 'Unknown'),
      toLocation: movement.toLocation || 'Unknown',
      reason: movement.reason || 'Manual adjustment',
      date: movement.createdAt.toISOString(),
      user: movement.createdBy?.name || 'System',
      warehouse: movement.warehouse?.name,
      orderNumber: movement.order?.orderNumber,
    }));

    return NextResponse.json(formattedMovements);
  } catch (error) {
    console.error('Error fetching movements:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId || !session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await _request.json();
    const { productId, warehouseId, type, quantity, fromLocation, toLocation, reason, orderId } = body;

    if (!productId || !type || !quantity || !reason) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }

    // Verify product belongs to organization
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product || product.organizationId !== session.user.organizationId) {
      return NextResponse.json({ message: 'Product not found' }, { status: 404 });
    }

    // Update product stock based on movement type
    let newStockQuantity = product.stockQuantity;
    if (type === 'in') {
      newStockQuantity += quantity;
    } else if (type === 'out') {
      if (newStockQuantity < quantity) {
        return NextResponse.json({ message: 'Insufficient stock' }, { status: 400 });
      }
      newStockQuantity -= quantity;
    }

    // Update product stock and create movement record in a transaction
    const [updatedProduct, movement] = await prisma.$transaction([
      prisma.product.update({
        where: { id: productId },
        data: { stockQuantity: newStockQuantity },
      }),
      prisma.inventoryMovement.create({
        data: {
          productId,
          warehouseId: warehouseId || null,
          type,
          quantity,
          fromLocation: fromLocation || null,
          toLocation: toLocation || null,
          reason,
          orderId: orderId || null,
          createdById: session.user.id,
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
            },
          },
          warehouse: {
            select: {
              id: true,
              name: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
    ]);

    return NextResponse.json({
      id: movement.id,
      productId: movement.productId,
      productName: movement.product.name,
      type: movement.type,
      quantity: movement.quantity,
      fromLocation: movement.fromLocation || movement.warehouse?.name || 'Unknown',
      toLocation: movement.toLocation || 'Unknown',
      reason: movement.reason,
      date: movement.createdAt.toISOString(),
      user: movement.createdBy?.name || 'System',
      warehouse: movement.warehouse?.name,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating movement:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
} 