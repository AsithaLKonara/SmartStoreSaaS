import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    // Current period data (last 30 days)
    const currentOrders = await prisma.order.findMany({
      where: {
        organizationId: session.user.organizationId,
        createdAt: { gte: thirtyDaysAgo },
      },
    });

    const currentCustomers = await prisma.customer.findMany({
      where: {
        organizationId: session.user.organizationId,
        createdAt: { gte: thirtyDaysAgo },
      },
    });

    // Previous period data (30-60 days ago)
    const previousOrders = await prisma.order.findMany({
      where: {
        organizationId: session.user.organizationId,
        createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
      },
    });

    const previousCustomers = await prisma.customer.findMany({
      where: {
        organizationId: session.user.organizationId,
        createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
      },
    });

    // Calculate metrics
    const currentRevenue = currentOrders.reduce((sum, order) => sum + order.totalAmount, 0);
    const previousRevenue = previousOrders.reduce((sum, order) => sum + order.totalAmount, 0);
    const revenueChange = previousRevenue > 0 
      ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 
      : (currentRevenue > 0 ? 100 : 0);

    const currentOrderCount = currentOrders.length;
    const previousOrderCount = previousOrders.length;
    const orderChange = previousOrderCount > 0 
      ? ((currentOrderCount - previousOrderCount) / previousOrderCount) * 100 
      : (currentOrderCount > 0 ? 100 : 0);

    const currentCustomerCount = currentCustomers.length;
    const previousCustomerCount = previousCustomers.length;
    const customerChange = previousCustomerCount > 0 
      ? ((currentCustomerCount - previousCustomerCount) / previousCustomerCount) * 100 
      : (currentCustomerCount > 0 ? 100 : 0);

    // Get total products count
    const totalProducts = await prisma.product.count({
      where: {
        organizationId: session.user.organizationId,
        isActive: true,
      },
    });

    // Product change is based on active products (simplified)
    const productChange = 0; // For now, we don't track product changes over time

    return NextResponse.json({
      totalRevenue: Math.round(currentRevenue * 100) / 100,
      totalOrders: currentOrderCount,
      totalCustomers: await prisma.customer.count({
        where: { organizationId: session.user.organizationId },
      }),
      totalProducts,
      revenueChange: Math.round(revenueChange * 10) / 10,
      ordersChange: Math.round(orderChange * 10) / 10,
      customersChange: Math.round(customerChange * 10) / 10,
      productsChange: productChange,
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

