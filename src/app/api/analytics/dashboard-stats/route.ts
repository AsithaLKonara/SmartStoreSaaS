import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { Session } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma, executePrismaQuery, validateOrganizationId } from '@/lib/prisma';
import { handleApiError, validateSession } from '@/lib/api-error-handler';

export async function GET(request: NextRequest) {
  try {
    const session = (await getServerSession(authOptions)) as Session | null;
    const sessionValidation = validateSession(session);
    if (!sessionValidation.valid) {
      return NextResponse.json({ message: sessionValidation.error || 'Unauthorized' }, { status: 401 });
    }
    
    const organizationId = validateOrganizationId(session?.user?.organizationId);

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    // Current period data (last 30 days)
    const [currentOrders, currentCustomers, previousOrders, previousCustomers] = await Promise.all([
      executePrismaQuery(() =>
        prisma.order.findMany({
      where: {
            organizationId,
        createdAt: { gte: thirtyDaysAgo },
      },
        })
      ),
      executePrismaQuery(() =>
        prisma.customer.findMany({
      where: {
            organizationId,
        createdAt: { gte: thirtyDaysAgo },
      },
        })
      ),
      executePrismaQuery(() =>
        prisma.order.findMany({
      where: {
            organizationId,
        createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
      },
        })
      ),
      executePrismaQuery(() =>
        prisma.customer.findMany({
      where: {
            organizationId,
        createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
      },
        })
      ),
    ]);

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

    // Get total products and customers count
    const [totalProducts, totalCustomers] = await Promise.all([
      executePrismaQuery(() =>
        prisma.product.count({
      where: {
            organizationId,
        isActive: true,
      },
        })
      ),
      executePrismaQuery(() =>
        prisma.customer.count({
          where: { organizationId },
        })
      ),
    ]);

    // Product change is based on active products (simplified)
    const productChange = 0; // For now, we don't track product changes over time

    return NextResponse.json({
      totalRevenue: Math.round(currentRevenue * 100) / 100,
      totalOrders: currentOrderCount,
      totalCustomers,
      totalProducts,
      revenueChange: Math.round(revenueChange * 10) / 10,
      ordersChange: Math.round(orderChange * 10) / 10,
      customersChange: Math.round(customerChange * 10) / 10,
      productsChange: productChange,
    });
  } catch (error) {
    const session = (await getServerSession(authOptions).catch(() => null)) as Session | null;
    return handleApiError(error, request, session);
  }
}

