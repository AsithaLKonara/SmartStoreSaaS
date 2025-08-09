import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateOrderNumber } from '@/lib/utils';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const paymentStatus = searchParams.get('paymentStatus');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    interface OrderWhereClause {
      organizationId: string;
      status?: string;
      paymentStatus?: string;
      OR?: Array<{
        orderNumber?: { contains: string; mode: 'insensitive' };
        customer?: { 
          name?: { contains: string; mode: 'insensitive' };
          email?: { contains: string; mode: 'insensitive' };
          phone?: { contains: string; mode: 'insensitive' };
        };
      }>;
    }

    const where: OrderWhereClause = {
      organizationId: session.user.organizationId,
    };

    if (status) {
      where.status = status;
    }

    if (paymentStatus) {
      where.paymentStatus = paymentStatus;
    }

    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
        { customer: { email: { contains: search, mode: 'insensitive' } } },
        { customer: { phone: { contains: search, mode: 'insensitive' } } },
      ];
    }

    // Get total count for pagination
    const total = await prisma.order.count({ where });

    const orders = await prisma.order.findMany({
      where,
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });

    return NextResponse.json({ 
      orders, 
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
    console.error('Error fetching orders:', error);
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
      customerId,
      items,
      status,
      paymentMethod,
      paymentStatus,
      notes,
    } = body;

    // Validation
    if (!customerId || !items || items.length === 0) {
      return NextResponse.json({ message: 'Customer and items are required' }, { status: 400 });
    }

    // Generate order number
    const orderNumber = generateOrderNumber();

    // Use transaction to ensure data consistency
    const order = await prisma.$transaction(async (tx) => {
      // Validate all products exist and calculate total within transaction
      let totalAmount = 0;
      const validatedItems = [];

      for (const item of items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          select: { id: true, price: true, stock: true, name: true }
        });
        
        if (!product) {
          throw new Error(`Product ${item.productId} not found`);
        }

        // Check stock availability
        if (product.stock < item.quantity) {
          throw new Error(`Insufficient stock for product ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}`);
        }

        const itemPrice = item.price || product.price;
        totalAmount += Number(itemPrice) * item.quantity;
        
        validatedItems.push({
          productId: item.productId,
          quantity: item.quantity,
          price: itemPrice,
        });
      }

      // Create order with validated items
      return await tx.order.create({
        data: {
          orderNumber,
          status: status || 'DRAFT',
          total: totalAmount,
          subtotal: totalAmount,
          currency: 'USD',
          notes,
          organizationId: session.user.organizationId,
          customerId,
          createdById: session.user.id,
          items: {
            create: validatedItems.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
              total: Number(item.price) * item.quantity,
            })),
          },
        },
        include: {
          customer: true,
          items: {
            include: {
              product: true,
            },
          },
        },
      });
    });

    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    console.error('Error creating order:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
} 