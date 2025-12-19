import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { Session } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma, executePrismaQuery, validateOrganizationId } from '@/lib/prisma';
import { handleApiError, validateSession } from '@/lib/api-error-handler';
import { PaymentStatus } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const session = (await getServerSession(authOptions)) as Session | null;
    const sessionValidation = validateSession(session);
    if (!sessionValidation.valid) {
      return NextResponse.json({ message: sessionValidation.error || 'Unauthorized' }, { status: 401 });
    }
    
    const organizationId = validateOrganizationId(session?.user?.organizationId);

    const { searchParams } = new URL(request.url);
    const range = parseInt(searchParams.get('range') || '30');

    const now = new Date();
    const startDate = new Date(now.getTime() - range * 24 * 60 * 60 * 1000);
    const previousStartDate = new Date(startDate.getTime() - range * 24 * 60 * 60 * 1000);

    // Current period data
    const currentOrders = await executePrismaQuery(() =>
      prisma.order.findMany({
      where: {
          organizationId,
        createdAt: { gte: startDate },
      },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
      },
      })
    );

    const currentCustomers = await executePrismaQuery(() =>
      prisma.customer.findMany({
      where: {
          organizationId,
        createdAt: { gte: startDate },
      },
      })
    );

    const currentProducts = await executePrismaQuery(() =>
      prisma.product.findMany({
      where: {
          organizationId,
        isActive: true,
      },
      })
    );

    // Previous period data for comparison
    const previousOrders = await executePrismaQuery(() =>
      prisma.order.findMany({
      where: {
          organizationId,
        createdAt: { gte: previousStartDate, lt: startDate },
      },
      })
    );

    const previousCustomers = await executePrismaQuery(() =>
      prisma.customer.findMany({
      where: {
          organizationId,
        createdAt: { gte: previousStartDate, lt: startDate },
      },
      })
    );

    // Calculate metrics
    const currentRevenue = currentOrders.reduce((sum: number, order) => sum + (order.totalAmount || 0), 0);
    const previousRevenue = previousOrders.reduce((sum: number, order) => sum + (order.totalAmount || 0), 0);
    const revenueChange = previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : 0;

    const currentOrderCount = currentOrders.length;
    const previousOrderCount = previousOrders.length;
    const orderChange = previousOrderCount > 0 ? ((currentOrderCount - previousOrderCount) / previousOrderCount) * 100 : 0;

    const currentCustomerCount = currentCustomers.length;
    const previousCustomerCount = previousCustomers.length;
    const customerChange = previousCustomerCount > 0 ? ((currentCustomerCount - previousCustomerCount) / previousCustomerCount) * 100 : 0;

    const currentProductCount = currentProducts.length;
    const productChange = 0;

    // Sales by day
    const salesByDay = [];
    for (let i = 0; i < range; i++) {
      const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const dayStart = new Date(date.setHours(0, 0, 0, 0));
      const dayEnd = new Date(date.setHours(23, 59, 59, 999));

      const dayOrders = currentOrders.filter((order) => 
        order.createdAt >= dayStart && order.createdAt <= dayEnd
      );

      salesByDay.push({
        date: dayStart.toISOString(),
        revenue: dayOrders.reduce((sum: number, order) => sum + (order.totalAmount || 0), 0),
        orders: dayOrders.length,
      });
    }

    // Top products
    const productRevenue = new Map<string, { name: string; revenue: number; orders: number }>();
    
    currentOrders.forEach((order) => {
      (order.items || []).forEach((item) => {
        const productId = item.productId || '';
        const existing = productRevenue.get(productId) || { 
          name: (item.product?.name as string) || 'Unknown', 
          revenue: 0, 
          orders: 0 
        };
        
        existing.revenue += (item.price || 0) * (item.quantity || 0);
        existing.orders += 1;
        
        productRevenue.set(productId, existing);
      });
    });

    const topProducts = Array.from(productRevenue.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Top customers
    const customerRevenue = new Map<string, { name: string; revenue: number; orders: number }>();
    
    currentOrders.forEach((order) => {
      const customerId = order.customerId || '';
      const existing = customerRevenue.get(customerId) || { 
        name: (order.customer?.name as string) || 'Unknown', 
        revenue: 0, 
        orders: 0 
      };
      
      existing.revenue += (order.totalAmount || 0);
      existing.orders += 1;
      
      customerRevenue.set(customerId, existing);
    });

    const topCustomers = Array.from(customerRevenue.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Payment methods
    const payments = await executePrismaQuery(() =>
      prisma.payment.findMany({
      where: {
          organizationId,
        createdAt: { gte: startDate },
        status: PaymentStatus.COMPLETED,
      },
      })
    );

    const paymentMethods = new Map<string, number>();
    payments.forEach((payment) => {
      const method = (payment.method as string) || 'unknown';
      paymentMethods.set(method, (paymentMethods.get(method) || 0) + (payment.amount || 0));
    });

    const totalPaymentAmount = Array.from(paymentMethods.values()).reduce((sum, amount) => sum + amount, 0);
    
    const paymentMethodsData = Array.from(paymentMethods.entries()).map(([method, amount]) => ({
      method,
      amount,
      percentage: totalPaymentAmount > 0 ? (amount / totalPaymentAmount) * 100 : 0,
    }));

    const analytics = {
      revenue: {
        total: currentRevenue,
        change: Math.round(revenueChange * 10) / 10,
        trend: revenueChange >= 0 ? 'up' as const : 'down' as const,
      },
      orders: {
        total: currentOrderCount,
        change: Math.round(orderChange * 10) / 10,
        trend: orderChange >= 0 ? 'up' as const : 'down' as const,
      },
      customers: {
        total: currentCustomerCount,
        change: Math.round(customerChange * 10) / 10,
        trend: customerChange >= 0 ? 'up' as const : 'down' as const,
      },
      products: {
        total: currentProductCount,
        change: Math.round(productChange * 10) / 10,
        trend: productChange >= 0 ? 'up' as const : 'down' as const,
      },
      salesByDay,
      topProducts,
      topCustomers,
      paymentMethods: paymentMethodsData,
    };

    return NextResponse.json(analytics);
  } catch (error) {
    const session = (await getServerSession(authOptions).catch(() => null)) as Session | null;
    return handleApiError(error, request, session);
  }
} 