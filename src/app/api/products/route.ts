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
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    interface WhereClause {
      organizationId: string;
      categoryId?: string;
      OR?: Array<{
        name?: { contains: string; mode: 'insensitive' };
        sku?: { contains: string; mode: 'insensitive' };
        description?: { contains: string; mode: 'insensitive' };
      }>;
      AND?: Array<{
        stockQuantity?: { lte?: number; gt?: number } | number;
        lowStockThreshold?: { lte?: number; gt?: number };
      }>;
      stockQuantity?: { lte?: number; gt?: number } | number;
    }

    const where: WhereClause = {
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
          // Use raw query to compare stock with minStock threshold
          where.AND = [
            {
              stockQuantity: { lte: 100 } // Default low stock threshold
            }
          ];
          break;
        case 'out':
          where.stockQuantity = 0;
          break;
        case 'in':
          where.stockQuantity = { gt: 0 };
          break;
      }
    }

    // Get total count for pagination
    const total = await prisma.product.count({ where });

    const products = await prisma.product.findMany({
      where,
      include: {
        category: true,
        variants: true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });

    return NextResponse.json({ 
      products, 
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: skip + limit < total,
        hasPrev: page > 1,
      }
    });
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
    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const product = await prisma.product.create({
      data: {
        name,
        slug,
        description: description || null,
        price: parseFloat(price),
        costPrice: costPrice ? parseFloat(costPrice) : null,
        sku: sku || null,
        stockQuantity: stockQuantity ? parseInt(stockQuantity) : 0,
        lowStockThreshold: lowStockThreshold ? parseInt(lowStockThreshold) : 0,
        isActive: isActive !== false,
        images: images || [],
        organizationId: session.user.organizationId,
        createdById: session.user.id,
        variants: {
          create: variants?.map((variant: { name: string; price?: string | number; costPrice?: string | number; stockQuantity?: string | number; sku?: string }) => ({
            name: variant.name,
            price: variant.price ? parseFloat(variant.price) : null,
            costPrice: variant.costPrice ? parseFloat(variant.costPrice) : null,
            stockQuantity: variant.stockQuantity ? parseInt(variant.stockQuantity) : 0,
            sku: variant.sku || null,
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