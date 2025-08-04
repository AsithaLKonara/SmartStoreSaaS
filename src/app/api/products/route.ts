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
    const categoryId = searchParams.get('categoryId');
    const search = searchParams.get('search');
    const stockFilter = searchParams.get('stockFilter');

    const where: any = {
      organizationId: session.user.organizationId,
    };

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (stockFilter) {
      switch (stockFilter) {
        case 'low':
          where.stockQuantity = { lte: where.lowStockThreshold };
          break;
        case 'out':
          where.stockQuantity = 0;
          break;
        case 'in':
          where.stockQuantity = { gt: where.lowStockThreshold };
          break;
      }
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        category: true,
        variants: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ products });
  } catch (error) {
    console.error('Error fetching products:', error);
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
    const {
      name,
      description,
      price,
      costPrice,
      sku,
      stockQuantity,
      lowStockThreshold,
      categoryId,
      isActive,
      images,
      variants,
    } = body;

    // Validation
    if (!name || !price || !costPrice || !sku || !categoryId) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }

    // Check if SKU already exists
    const existingProduct = await prisma.product.findFirst({
      where: {
        sku,
        organizationId: session.user.organizationId,
      },
    });

    if (existingProduct) {
      return NextResponse.json({ message: 'SKU already exists' }, { status: 400 });
    }

    // Create product with variants
    const product = await prisma.product.create({
      data: {
        name,
        description,
        price,
        costPrice,
        sku,
        stockQuantity,
        lowStockThreshold,
        isActive,
        images,
        organizationId: session.user.organizationId,
        categoryId,
        variants: {
          create: variants?.map((variant: any) => ({
            name: variant.name,
            price: variant.price,
            costPrice: variant.costPrice,
            stockQuantity: variant.stockQuantity,
            sku: variant.sku,
          })) || [],
        },
      },
      include: {
        category: true,
        variants: true,
      },
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
} 