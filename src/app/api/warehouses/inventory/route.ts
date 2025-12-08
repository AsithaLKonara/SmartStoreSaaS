import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const products = await prisma.product.findMany({
      where: { organizationId: session?.user?.organizationId },
      select: {
        id: true,
        name: true,
        sku: true,
        stockQuantity: true,
        lowStockThreshold: true,
        updatedAt: true,
        category: {
          select: { name: true },
        },
      },
    });

    // Transform data to match inventory interface
    const inventory = products.map(product => ({
      id: product.id,
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      quantity: product.stockQuantity,
      reservedQuantity: 0, // This would come from order reservations
      availableQuantity: product.stockQuantity,
      lowStockThreshold: product.lowStockThreshold,
      location: 'Main Warehouse', // This would come from warehouse assignment
      lastUpdated: product.updatedAt.toISOString(),
      status: product.stockQuantity === 0 
        ? 'out_of_stock' 
        : product.stockQuantity <= product.lowStockThreshold 
          ? 'low_stock' 
          : 'in_stock',
    }));

    return NextResponse.json(inventory);
  } catch (error) {
    console.error('Error fetching inventory:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
} 