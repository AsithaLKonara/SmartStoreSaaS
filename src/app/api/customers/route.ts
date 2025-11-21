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
    const search = searchParams.get('search');
    const tag = searchParams.get('tag');

    const where: any = {
      organizationId: session.user.organizationId,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (tag) {
      where.tags = { has: tag };
    }

    const customers = await prisma.customer.findMany({
      where,
      include: {
        orders: {
          select: {
            id: true,
            orderNumber: true,
            totalAmount: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate derived fields
    const customersWithStats = customers.map((customer: any) => {
      const totalSpent = customer.orders.reduce((sum: number, order: any) => sum + order.totalAmount, 0);
      const orderCount = customer.orders.length;
      const lastOrderDate = customer.orders.length > 0 ? customer.orders[0].createdAt : null;

      return {
        ...customer,
        totalSpent,
        orderCount,
        lastOrderDate,
      };
    });

    return NextResponse.json({ customers: customersWithStats });
  } catch (error) {
    console.error('Error fetching customers:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await _request.json();
    const {
      name,
      email,
      phone,
      tags,
    } = body;

    // Validation
    if (!name || !email || !phone) {
      return NextResponse.json({ message: 'Name, email, and phone are required' }, { status: 400 });
    }

    // Check if customer already exists
    const existingCustomer = await prisma.customer.findFirst({
      where: {
        OR: [
          { email },
          { phone },
        ],
        organizationId: session.user.organizationId,
      },
    });

    if (existingCustomer) {
      return NextResponse.json({ message: 'Customer with this email or phone already exists' }, { status: 400 });
    }

    // Create customer
    const customer = await prisma.customer.create({
      data: {
        name,
        email,
        phone,
        tags: tags || [],
        organizationId: session.user.organizationId,
      },
    });

    return NextResponse.json({ customer }, { status: 201 });
  } catch (error) {
    console.error('Error creating customer:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
} 