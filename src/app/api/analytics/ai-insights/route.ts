import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface AIInsight {
  id: string;
  type: 'opportunity' | 'risk' | 'trend' | 'recommendation';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  confidence: number;
  action?: string;
  value?: number;
  trend?: 'up' | 'down' | 'stable';
}

function parseTimeRange(timeRange: string): { days: number; startDate: Date; endDate: Date } {
  const match = timeRange.match(/^(\d+)([dwmy])$/);
  if (!match) {
    // Default to 30 days
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
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '30d';
    const { startDate, endDate, days } = parseTimeRange(timeRange);
    
    const previousStartDate = new Date(startDate.getTime() - (endDate.getTime() - startDate.getTime()));

    // Fetch orders for current and previous periods
    const currentOrders = await prisma.order.findMany({
      where: {
        organizationId: session.user.organizationId,
        createdAt: { gte: startDate, lte: endDate },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        customer: true,
      },
    });

    const previousOrders = await prisma.order.findMany({
      where: {
        organizationId: session.user.organizationId,
        createdAt: { gte: previousStartDate, lt: startDate },
      },
    });

    const currentCustomers = await prisma.customer.findMany({
      where: {
        organizationId: session.user.organizationId,
        createdAt: { gte: startDate, lte: endDate },
      },
    });

    const currentProducts = await prisma.product.findMany({
      where: {
        organizationId: session.user.organizationId,
        isActive: true,
      },
    });

    // Calculate metrics
    const currentRevenue = currentOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
    const previousRevenue = previousOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
    const revenueChange = previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : (currentRevenue > 0 ? 100 : 0);
    
    const currentOrderCount = currentOrders.length;
    const previousOrderCount = previousOrders.length;
    const orderChange = previousOrderCount > 0 ? ((currentOrderCount - previousOrderCount) / previousOrderCount) * 100 : (currentOrderCount > 0 ? 100 : 0);

    // Calculate product performance
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

    // Generate AI Insights
    const insights: AIInsight[] = [];

    // Revenue trend insight
    if (Math.abs(revenueChange) > 5) {
      insights.push({
        id: 'revenue-trend',
        type: revenueChange > 0 ? 'trend' : 'risk',
        title: revenueChange > 0 ? 'Revenue Growth Detected' : 'Revenue Decline Detected',
        description: revenueChange > 0 
          ? `Revenue increased by ${revenueChange.toFixed(1)}% compared to the previous period.`
          : `Revenue decreased by ${Math.abs(revenueChange).toFixed(1)}% compared to the previous period.`,
        impact: Math.abs(revenueChange) > 20 ? 'high' : Math.abs(revenueChange) > 10 ? 'medium' : 'low',
        confidence: Math.min(85 + Math.abs(revenueChange), 95),
        value: currentRevenue,
        trend: revenueChange > 0 ? 'up' : 'down',
        action: revenueChange > 0 
          ? 'Consider scaling successful products or channels'
          : 'Review marketing strategies and customer engagement',
      });
    }

    // Order volume insight
    if (Math.abs(orderChange) > 10) {
      insights.push({
        id: 'order-volume',
        type: orderChange > 0 ? 'opportunity' : 'risk',
        title: orderChange > 0 ? 'High Order Volume Growth' : 'Order Volume Decline',
        description: orderChange > 0
          ? `Order count increased by ${orderChange.toFixed(1)}% with ${currentOrderCount} orders in this period.`
          : `Order count decreased by ${Math.abs(orderChange).toFixed(1)}% with ${currentOrderCount} orders in this period.`,
        impact: Math.abs(orderChange) > 30 ? 'high' : 'medium',
        confidence: 80,
        value: currentOrderCount,
        trend: orderChange > 0 ? 'up' : 'down',
      });
    }

    // Top product opportunity
    if (topProducts.length > 0 && topProducts[0].revenue > currentRevenue * 0.2) {
      insights.push({
        id: 'top-product',
        type: 'opportunity',
        title: 'Top Performing Product',
        description: `${topProducts[0].name} is generating ${((topProducts[0].revenue / currentRevenue) * 100).toFixed(1)}% of total revenue.`,
        impact: 'high',
        confidence: 90,
        value: topProducts[0].revenue,
        action: 'Consider increasing inventory and marketing for this product',
        trend: 'up',
      });
    }

    // Low inventory risk
    const lowStockProducts = currentProducts.filter(p => {
      const stock = (p.stock as number) || 0;
      return stock < 10 && stock > 0;
    });

    if (lowStockProducts.length > 0) {
      insights.push({
        id: 'low-stock',
        type: 'risk',
        title: 'Low Stock Alert',
        description: `${lowStockProducts.length} product${lowStockProducts.length > 1 ? 's' : ''} ${lowStockProducts.length > 1 ? 'are' : 'is'} running low on inventory.`,
        impact: lowStockProducts.length > 5 ? 'high' : 'medium',
        confidence: 95,
        action: 'Replenish inventory to avoid stockouts',
      });
    }

    // Customer growth opportunity
    if (currentCustomers.length > 0) {
      const avgOrderValue = currentRevenue / currentOrderCount;
      if (avgOrderValue > 100) {
        insights.push({
          id: 'high-value',
          type: 'opportunity',
          title: 'High Average Order Value',
          description: `Average order value is $${avgOrderValue.toFixed(2)}. This indicates strong customer purchasing behavior.`,
          impact: 'medium',
          confidence: 85,
          value: avgOrderValue,
          action: 'Focus on upselling and cross-selling opportunities',
          trend: 'up',
        });
      }
    }

    // Customer acquisition trend
    if (currentCustomers.length > 10) {
      insights.push({
        id: 'customer-growth',
        type: 'trend',
        title: 'Customer Acquisition Trend',
        description: `${currentCustomers.length} new customers acquired in this period.`,
        impact: currentCustomers.length > 50 ? 'high' : 'medium',
        confidence: 80,
        value: currentCustomers.length,
        action: 'Implement retention strategies for new customers',
        trend: 'up',
      });
    }

    // Revenue recommendation
    if (currentRevenue > 0 && revenueChange < 0 && Math.abs(revenueChange) > 5) {
      insights.push({
        id: 'revenue-recommendation',
        type: 'recommendation',
        title: 'Revenue Optimization Recommendation',
        description: 'Consider promotional campaigns or product bundling to boost revenue.',
        impact: 'high',
        confidence: 75,
        action: 'Launch targeted marketing campaigns for underperforming periods',
      });
    }

    // Ensure we have at least some insights
    if (insights.length === 0) {
      insights.push({
        id: 'baseline',
        type: 'trend',
        title: 'Business Operating Normally',
        description: 'All metrics are within expected ranges. Continue monitoring for opportunities.',
        impact: 'low',
        confidence: 70,
        trend: 'stable',
      });
    }

    return NextResponse.json({ insights });
  } catch (error) {
    console.error('Error fetching AI insights:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

