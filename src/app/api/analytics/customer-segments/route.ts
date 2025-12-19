import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface CustomerSegment {
  id: string;
  name: string;
  count: number;
  value: number;
  churnRisk: number;
  growthRate: number;
}

function parseTimeRange(timeRange: string): { days: number; startDate: Date; endDate: Date } {
  const match = timeRange.match(/^(\d+)([dwmy])$/);
  if (!match) {
    const days = 30;
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
    return { days, startDate, endDate };
  }

  const value = parseInt(match[1]);
  const unit = match[2];
  
  let days = 30;
  if (unit === 'd') days = value;
  else if (unit === 'w') days = value * 7;
  else if (unit === 'm') days = value * 30;
  else if (unit === 'y') days = value * 365;

  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
  
  return { days, startDate, endDate };
}

export async function GET(request: NextRequest) {
  try {
    const session = (await getServerSession(authOptions)) as { user?: { organizationId?: string | null } | null; } | null;
    if (!session || !session.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '30d';
    const { startDate, endDate, days: _days } = parseTimeRange(timeRange);
    
    const previousStartDate = new Date(startDate.getTime() - (endDate.getTime() - startDate.getTime()));
    const now = new Date();

    // Fetch all customers
    const allCustomers = await prisma.customer.findMany({
      where: {
        organizationId: session.user.organizationId,
      },
      include: {
        orders: {
          include: {
            items: true,
          },
        },
      },
    });

    // Fetch orders for time range
    const periodOrders = await prisma.order.findMany({
      where: {
        organizationId: session.user.organizationId,
        createdAt: { gte: startDate, lte: endDate },
      },
      include: {
        customer: true,
        items: true,
      },
    });

    // Fetch previous period orders for growth calculation
    const previousPeriodOrders = await prisma.order.findMany({
      where: {
        organizationId: session.user.organizationId,
        createdAt: { gte: previousStartDate, lt: startDate },
      },
    });

    // Calculate customer metrics
    const customerMetrics = new Map<string, {
      totalRevenue: number;
      orderCount: number;
      firstOrderDate: Date | null;
      lastOrderDate: Date | null;
      avgOrderValue: number;
    }>();

    allCustomers.forEach((customer) => {
      const customerOrders = customer.orders || [];
      const periodCustomerOrders = periodOrders.filter(
        order => order.customerId === customer.id
      );
      
      const totalRevenue = periodCustomerOrders.reduce(
        (sum, order) => sum + (order.totalAmount || 0),
        0
      );
      
      const orderDates = customerOrders
        .map(order => order.createdAt)
        .filter(date => date !== null)
        .sort((a, b) => (a as Date).getTime() - (b as Date).getTime());

      const firstOrderDate = orderDates.length > 0 ? orderDates[0] as Date : null;
      const lastOrderDate = orderDates.length > 0 ? orderDates[orderDates.length - 1] as Date : null;
      
      customerMetrics.set(customer.id, {
        totalRevenue,
        orderCount: periodCustomerOrders.length,
        firstOrderDate,
        lastOrderDate,
        avgOrderValue: periodCustomerOrders.length > 0 
          ? totalRevenue / periodCustomerOrders.length 
          : 0,
      });
    });

    // Calculate segment statistics
    const segments: CustomerSegment[] = [];
    
    // High Value Customers (>$500 in period)
    const highValueCustomers = Array.from(customerMetrics.entries())
      .filter(([_, metrics]) => metrics.totalRevenue >= 500);
    
    if (highValueCustomers.length > 0) {
      const highValueRevenue = highValueCustomers.reduce(
        (sum, [_, metrics]) => sum + metrics.totalRevenue,
        0
      );
      const previousHighValueCount = previousPeriodOrders
        .filter(order => {
          const metrics = customerMetrics.get(order.customerId || '');
          return metrics && metrics.totalRevenue >= 500;
        }).length;
      
      const growthRate = previousHighValueCount > 0
        ? ((highValueCustomers.length - previousHighValueCount) / previousHighValueCount) * 100
        : highValueCustomers.length > 0 ? 100 : 0;
      
      // Calculate churn risk (customers with last order > 60 days ago)
      const daysSinceLastOrder = highValueCustomers.map(([_, metrics]) => {
        if (!metrics.lastOrderDate) return Infinity;
        return (now.getTime() - metrics.lastOrderDate.getTime()) / (1000 * 60 * 60 * 24);
      });
      const churnRiskCount = daysSinceLastOrder.filter(days => days > 60).length;
      const churnRisk = highValueCustomers.length > 0 
        ? (churnRiskCount / highValueCustomers.length) * 100 
        : 0;

      segments.push({
        id: 'high-value',
        name: 'High Value',
        count: highValueCustomers.length,
        value: Math.round(highValueRevenue * 100) / 100,
        churnRisk: Math.round(churnRisk * 10) / 10,
        growthRate: Math.round(growthRate * 10) / 10,
      });
    }

    // Medium Value Customers ($100-$500 in period)
    const mediumValueCustomers = Array.from(customerMetrics.entries())
      .filter(([_, metrics]) => metrics.totalRevenue >= 100 && metrics.totalRevenue < 500);
    
    if (mediumValueCustomers.length > 0) {
      const mediumValueRevenue = mediumValueCustomers.reduce(
        (sum, [_, metrics]) => sum + metrics.totalRevenue,
        0
      );
      const previousMediumValueCount = previousPeriodOrders
        .filter(order => {
          const metrics = customerMetrics.get(order.customerId || '');
          return metrics && metrics.totalRevenue >= 100 && metrics.totalRevenue < 500;
        }).length;
      
      const growthRate = previousMediumValueCount > 0
        ? ((mediumValueCustomers.length - previousMediumValueCount) / previousMediumValueCount) * 100
        : mediumValueCustomers.length > 0 ? 100 : 0;
      
      const daysSinceLastOrder = mediumValueCustomers.map(([_, metrics]) => {
        if (!metrics.lastOrderDate) return Infinity;
        return (now.getTime() - metrics.lastOrderDate.getTime()) / (1000 * 60 * 60 * 24);
      });
      const churnRiskCount = daysSinceLastOrder.filter(days => days > 45).length;
      const churnRisk = mediumValueCustomers.length > 0 
        ? (churnRiskCount / mediumValueCustomers.length) * 100 
        : 0;

      segments.push({
        id: 'medium-value',
        name: 'Medium Value',
        count: mediumValueCustomers.length,
        value: Math.round(mediumValueRevenue * 100) / 100,
        churnRisk: Math.round(churnRisk * 10) / 10,
        growthRate: Math.round(growthRate * 10) / 10,
      });
    }

    // Low Value Customers (<$100 in period)
    const lowValueCustomers = Array.from(customerMetrics.entries())
      .filter(([_, metrics]) => metrics.totalRevenue > 0 && metrics.totalRevenue < 100);
    
    if (lowValueCustomers.length > 0) {
      const lowValueRevenue = lowValueCustomers.reduce(
        (sum, [_, metrics]) => sum + metrics.totalRevenue,
        0
      );
      const previousLowValueCount = previousPeriodOrders
        .filter(order => {
          const metrics = customerMetrics.get(order.customerId || '');
          return metrics && metrics.totalRevenue > 0 && metrics.totalRevenue < 100;
        }).length;
      
      const growthRate = previousLowValueCount > 0
        ? ((lowValueCustomers.length - previousLowValueCount) / previousLowValueCount) * 100
        : lowValueCustomers.length > 0 ? 100 : 0;
      
      const daysSinceLastOrder = lowValueCustomers.map(([_, metrics]) => {
        if (!metrics.lastOrderDate) return Infinity;
        return (now.getTime() - metrics.lastOrderDate.getTime()) / (1000 * 60 * 60 * 24);
      });
      const churnRiskCount = daysSinceLastOrder.filter(days => days > 30).length;
      const churnRisk = lowValueCustomers.length > 0 
        ? (churnRiskCount / lowValueCustomers.length) * 100 
        : 0;

      segments.push({
        id: 'low-value',
        name: 'Low Value',
        count: lowValueCustomers.length,
        value: Math.round(lowValueRevenue * 100) / 100,
        churnRisk: Math.round(churnRisk * 10) / 10,
        growthRate: Math.round(growthRate * 10) / 10,
      });
    }

    // New Customers (first order in period)
    const newCustomers = Array.from(customerMetrics.entries())
      .filter(([_, metrics]) => {
        if (!metrics.firstOrderDate) return false;
        return metrics.firstOrderDate >= startDate && metrics.firstOrderDate <= endDate;
      });
    
    if (newCustomers.length > 0) {
      const newCustomerRevenue = newCustomers.reduce(
        (sum, [_, metrics]) => sum + metrics.totalRevenue,
        0
      );
      
      // New customers have no previous period, so calculate growth from previous new customers
      const previousNewCustomers = allCustomers.filter(customer => {
        const metrics = customerMetrics.get(customer.id);
        if (!metrics || !metrics.firstOrderDate) return false;
        return metrics.firstOrderDate >= previousStartDate && metrics.firstOrderDate < startDate;
      }).length;
      
      const growthRate = previousNewCustomers > 0
        ? ((newCustomers.length - previousNewCustomers) / previousNewCustomers) * 100
        : newCustomers.length > 0 ? 100 : 0;

      segments.push({
        id: 'new',
        name: 'New Customers',
        count: newCustomers.length,
        value: Math.round(newCustomerRevenue * 100) / 100,
        churnRisk: 30, // New customers have higher initial churn risk
        growthRate: Math.round(growthRate * 10) / 10,
      });
    }

    // At Risk Customers (last order > 45 days ago but had previous activity)
    const atRiskCustomers = Array.from(customerMetrics.entries())
      .filter(([_, metrics]) => {
        if (!metrics.lastOrderDate) return false;
        const daysSinceLastOrder = (now.getTime() - metrics.lastOrderDate.getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceLastOrder > 45 && metrics.orderCount > 0;
      });
    
    if (atRiskCustomers.length > 0) {
      const atRiskRevenue = atRiskCustomers.reduce(
        (sum, [_, metrics]) => sum + metrics.totalRevenue,
        0
      );
      
      const previousAtRiskCount = Array.from(customerMetrics.entries())
        .filter(([_, metrics]) => {
          if (!metrics.lastOrderDate) return false;
          const daysSinceLastOrder = (startDate.getTime() - metrics.lastOrderDate.getTime()) / (1000 * 60 * 60 * 24);
          return daysSinceLastOrder > 45 && metrics.orderCount > 0;
        }).length;
      
      const growthRate = previousAtRiskCount > 0
        ? ((atRiskCustomers.length - previousAtRiskCount) / previousAtRiskCount) * 100
        : atRiskCustomers.length > 0 ? 100 : 0;

      segments.push({
        id: 'at-risk',
        name: 'At Risk',
        count: atRiskCustomers.length,
        value: Math.round(atRiskRevenue * 100) / 100,
        churnRisk: 75, // High churn risk for inactive customers
        growthRate: Math.round(growthRate * 10) / 10,
      });
    }

    // Ensure we have at least one segment
    if (segments.length === 0) {
      segments.push({
        id: 'all',
        name: 'All Customers',
        count: allCustomers.length,
        value: 0,
        churnRisk: 0,
        growthRate: 0,
      });
    }

    return NextResponse.json({ segments });
  } catch (error) {
    console.error('Error fetching customer segments:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

