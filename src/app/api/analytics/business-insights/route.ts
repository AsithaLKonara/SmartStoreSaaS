import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface BusinessInsights {
  salesInsights?: {
    totalRevenue?: number;
    totalOrders?: number;
    topProducts?: Array<{ id: string; name: string; revenue: number }>;
  };
  customerInsights?: {
    totalCustomers?: number;
    averageCLV?: number;
    segments?: Array<{ id: string; name: string; customerCount: number }>;
  };
  recommendations?: string[];
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
    const { startDate, endDate } = parseTimeRange(timeRange);

    // Fetch orders for the period
    const orders = await prisma.order.findMany({
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

    // Fetch all customers for CLV calculation
    const allCustomers = await prisma.customer.findMany({
      where: {
        organizationId: session.user.organizationId,
      },
      include: {
        orders: {
          where: {
            createdAt: { lte: endDate },
          },
        },
      },
    });

    // Fetch products
    const products = await prisma.product.findMany({
      where: {
        organizationId: session.user.organizationId,
        isActive: true,
      },
    });

    // Calculate sales insights
    const totalRevenue = orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
    const totalOrders = orders.length;

    // Calculate top products by revenue
    const productRevenue = new Map<string, { id: string; name: string; revenue: number }>();
    
    orders.forEach((order) => {
      (order.items || []).forEach((item) => {
        const productId = item.productId || '';
        const existing = productRevenue.get(productId) || { 
          id: productId,
          name: (item.product?.name as string) || 'Unknown', 
          revenue: 0,
        };
        existing.revenue += (item.price || 0) * (item.quantity || 0);
        productRevenue.set(productId, existing);
      });
    });

    const topProducts = Array.from(productRevenue.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
      .map(p => ({
        id: p.id,
        name: p.name,
        revenue: Math.round(p.revenue * 100) / 100,
      }));

    // Calculate customer insights
    const totalCustomers = allCustomers.length;
    
    // Calculate average Customer Lifetime Value (CLV)
    const customerLTVs = allCustomers.map((customer) => {
      const customerOrders = customer.orders || [];
      const lifetimeValue = customerOrders.reduce(
        (sum, order) => sum + (order.totalAmount || 0),
        0
      );
      return lifetimeValue;
    });

    const averageCLV = customerLTVs.length > 0
      ? customerLTVs.reduce((sum, ltv) => sum + ltv, 0) / customerLTVs.length
      : 0;

    // Calculate customer segments
    const segmentMap = new Map<string, number>();
    
    allCustomers.forEach((customer) => {
      const customerOrders = customer.orders || [];
      const customerRevenue = customerOrders.reduce(
        (sum, order) => sum + (order.totalAmount || 0),
        0
      );

      let segment = 'Low Value';
      if (customerRevenue >= 500) segment = 'High Value';
      else if (customerRevenue >= 100) segment = 'Medium Value';
      
      segmentMap.set(segment, (segmentMap.get(segment) || 0) + 1);
    });

    const segments = Array.from(segmentMap.entries()).map(([name, customerCount]) => ({
      id: name.toLowerCase().replace(/\s+/g, '-'),
      name,
      customerCount,
    }));

    // Generate recommendations
    const recommendations: string[] = [];

    // Revenue recommendations
    if (totalOrders > 0) {
      const avgOrderValue = totalRevenue / totalOrders;
      if (avgOrderValue < 50) {
        recommendations.push('Consider upselling strategies to increase average order value');
      }
    }

    if (topProducts.length > 0) {
      const topProductRevenue = topProducts[0].revenue;
      const topProductPercentage = (topProductRevenue / totalRevenue) * 100;
      if (topProductPercentage > 40) {
        recommendations.push('Diversify product portfolio - top product represents significant revenue concentration');
      } else {
        recommendations.push(`Focus marketing efforts on top performer: ${topProducts[0].name}`);
      }
    }

    // Customer recommendations
    if (averageCLV > 0) {
      if (averageCLV < 100) {
        recommendations.push('Implement customer retention strategies to increase lifetime value');
      }
    }

    if (segments.length > 0) {
      const highValueCount = segments.find(s => s.name === 'High Value')?.customerCount || 0;
      const totalSegmentCount = segments.reduce((sum, s) => sum + s.customerCount, 0);
      const highValuePercentage = totalSegmentCount > 0 
        ? (highValueCount / totalSegmentCount) * 100 
        : 0;
      
      if (highValuePercentage < 10) {
        recommendations.push('Focus on converting medium-value customers to high-value through targeted campaigns');
      }
    }

    // Inventory recommendations
    const lowStockProducts = products.filter(p => {
      const stock = p.stockQuantity || 0;
      return stock > 0 && stock < 10;
    });

    if (lowStockProducts.length > 0) {
      recommendations.push(`Replenish inventory for ${lowStockProducts.length} low-stock product${lowStockProducts.length > 1 ? 's' : ''}`);
    }

    // Order volume recommendations
    if (totalOrders < 10) {
      recommendations.push('Consider promotional campaigns to increase order volume');
    } else if (totalOrders > 100) {
      recommendations.push('Scale operations to handle increased order volume efficiently');
    }

    // Ensure we have at least one recommendation
    if (recommendations.length === 0) {
      recommendations.push('Continue monitoring key metrics and optimize based on performance trends');
    }

    // Build response
    const businessInsights: BusinessInsights = {
      salesInsights: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalOrders,
        topProducts: topProducts.length > 0 ? topProducts : undefined,
      },
      customerInsights: {
        totalCustomers,
        averageCLV: Math.round(averageCLV * 100) / 100,
        segments: segments.length > 0 ? segments : undefined,
      },
      recommendations: recommendations.length > 0 ? recommendations : undefined,
    };

    return NextResponse.json(businessInsights);
  } catch (error) {
    console.error('Error fetching business insights:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

