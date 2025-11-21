import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PaymentStatus } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const range = parseInt(searchParams.get('range') || '30');

    const now = new Date();
    const startDate = new Date(now.getTime() - range * 24 * 60 * 60 * 1000);
    const previousStartDate = new Date(startDate.getTime() - range * 24 * 60 * 60 * 1000);

    // Current period data
    const currentOrders = await prisma.order.findMany({
      where: {
        organizationId: session.user.organizationId,
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
    });

    const currentCustomers = await prisma.customer.findMany({
      where: {
        organizationId: session.user.organizationId,
        createdAt: { gte: startDate },
      },
    });

    const currentProducts = await prisma.product.findMany({
      where: {
        organizationId: session.user.organizationId,
        isActive: true,
      },
    });

    // Previous period data for comparison
    const previousOrders = await prisma.order.findMany({
      where: {
        organizationId: session.user.organizationId,
        createdAt: { gte: previousStartDate, lt: startDate },
      },
    });

    const previousCustomers = await prisma.customer.findMany({
      where: {
        organizationId: session.user.organizationId,
        createdAt: { gte: previousStartDate, lt: startDate },
      },
    });

    // Calculate metrics
    const currentRevenue = currentOrders.reduce((sum: number, order: any) => sum + order.totalAmount, 0);
    const previousRevenue = previousOrders.reduce((sum: number, order: any) => sum + order.totalAmount, 0);
    const revenueChange = previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : 0;

    const currentOrderCount = currentOrders.length;
    const previousOrderCount = previousOrders.length;
    const orderChange = previousOrderCount > 0 ? ((currentOrderCount - previousOrderCount) / previousOrderCount) * 100 : 0;

    const currentCustomerCount = currentCustomers.length;
    const previousCustomerCount = previousCustomers.length;
    const customerChange = previousCustomerCount > 0 ? ((currentCustomerCount - previousCustomerCount) / previousCustomerCount) * 100 : 0;

    const currentProductCount = currentProducts.length;
    const previousProductCount = currentProductCount; // For simplicity, assuming no change in product count
    const productChange = 0;

    // Sales by day
    const salesByDay = [];
    for (let i = 0; i < range; i++) {
      const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const dayStart = new Date(date.setHours(0, 0, 0, 0));
      const dayEnd = new Date(date.setHours(23, 59, 59, 999));

      const dayOrders = currentOrders.filter((order: any) => 
        order.createdAt >= dayStart && order.createdAt <= dayEnd
      );

      salesByDay.push({
        date: dayStart.toISOString(),
        revenue: dayOrders.reduce((sum: number, order: any) => sum + order.totalAmount, 0),
        orders: dayOrders.length,
      });
    }

    // Top products
    const productRevenue = new Map<string, { name: string; revenue: number; orders: number }>();
    
    currentOrders.forEach((order: any) => {
      order.items.forEach((item: any) => {
        const productId = item.productId;
        const existing = productRevenue.get(productId) || { 
          name: item.product.name, 
          revenue: 0, 
          orders: 0 
        };
        
        existing.revenue += item.price * item.quantity;
        existing.orders += 1;
        
        productRevenue.set(productId, existing);
      });
    });

    const topProducts = Array.from(productRevenue.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Top customers
    const customerRevenue = new Map<string, { name: string; revenue: number; orders: number }>();
    
    currentOrders.forEach((order: any) => {
      const customerId = order.customerId;
      const existing = customerRevenue.get(customerId) || { 
        name: order.customer.name, 
        revenue: 0, 
        orders: 0 
      };
      
      existing.revenue += order.totalAmount;
      existing.orders += 1;
      
      customerRevenue.set(customerId, existing);
    });

    const topCustomers = Array.from(customerRevenue.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Payment methods
    const payments = await prisma.payment.findMany({
      where: {
        organizationId: session.user.organizationId,
        createdAt: { gte: startDate },
<<<<<<< HEAD
        status: PaymentStatus.COMPLETED,
=======
        status: 'COMPLETED',
>>>>>>> 08d9e1855dc7fd2c99e5d62def516239ff37a9a7
      },
    });

    const paymentMethods = new Map<string, number>();
    payments.forEach((payment: any) => {
      const method = payment.method;
      paymentMethods.set(method, (paymentMethods.get(method) || 0) + payment.amount);
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
    console.error('Error fetching analytics:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
} 