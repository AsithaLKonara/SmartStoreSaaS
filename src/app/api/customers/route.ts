import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma, executePrismaQuery, validateOrganizationId } from '@/lib/prisma';
import { handleApiError, validateSession } from '@/lib/api-error-handler';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const sessionValidation = validateSession(session);
    if (!sessionValidation.valid) {
      return NextResponse.json({ message: sessionValidation.error || 'Unauthorized' }, { status: 401 });
    }
    
    const organizationId = validateOrganizationId(session?.user?.organizationId);

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const tag = searchParams.get('tag');

    const where: {
      organizationId: string;
      OR?: Array<{ name?: { contains: string; mode: 'insensitive' }; email?: { contains: string; mode: 'insensitive' }; phone?: { contains: string; mode: 'insensitive' } }>;
      tags?: { has: string };
    } = {
      organizationId,
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

    const customers = await executePrismaQuery(() =>
      prisma.customer.findMany({
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
      })
    );

    // Calculate derived fields
    const customersWithStats = customers.map((customer) => {
      const totalSpent = customer.orders.reduce((sum: number, order) => sum + order.totalAmount, 0);
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
    const session = await getServerSession(authOptions).catch(() => null);
    return handleApiError(error, request, session);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const sessionValidation = validateSession(session);
    if (!sessionValidation.valid) {
      return NextResponse.json({ message: sessionValidation.error || 'Unauthorized' }, { status: 401 });
    }
    
    const organizationId = validateOrganizationId(session?.user?.organizationId);

    const body = await request.json();
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
    const existingCustomer = await executePrismaQuery(() =>
      prisma.customer.findFirst({
      where: {
        OR: [
          { email },
          { phone },
        ],
          organizationId,
      },
      })
    );

    if (existingCustomer) {
      return NextResponse.json({ message: 'Customer with this email or phone already exists' }, { status: 400 });
    }

    // Create customer
    const customer = await executePrismaQuery(() =>
      prisma.customer.create({
      data: {
        name,
        email,
        phone,
        tags: tags || [],
          organizationId,
      },
      })
    );

    return NextResponse.json({ customer }, { status: 201 });
  } catch (error) {
    const session = await getServerSession(authOptions).catch(() => null);
    return handleApiError(error, request, session);
  }
} 