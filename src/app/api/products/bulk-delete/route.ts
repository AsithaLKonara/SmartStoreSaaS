import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function DELETE(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await _request.json();
    const { productIds } = body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json({ message: 'Product IDs are required' }, { status: 400 });
    }

    // Delete products and their variants
    const result = await prisma.$transaction(async (tx: any) => {
      // Delete variants first
      await tx.productVariant.deleteMany({
        where: {
          productId: { in: productIds },
<<<<<<< HEAD
          product: { 
            organizationId: session.user.organizationId || '',
          },
=======
>>>>>>> 08d9e1855dc7fd2c99e5d62def516239ff37a9a7
        },
      });

      // Delete products
      const deletedProducts = await tx.product.deleteMany({
        where: {
          id: { in: productIds },
          organizationId: session.user.organizationId || '',
        },
      });

      return deletedProducts;
    });

    return NextResponse.json({ 
      message: `${result.count} products deleted successfully` 
    });
  } catch (error) {
    console.error('Error deleting products:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
} 