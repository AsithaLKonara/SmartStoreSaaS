import { prisma } from '@/lib/prisma';

export interface BIDashboardConfig {
  name: string;
  widgets: BIWidget[];
  filters?: BIFilter[];
  refreshInterval?: number;
}

export interface BIWidget {
  id: string;
  type: 'chart' | 'table' | 'metric' | 'kpi';
  title: string;
  dataSource: string;
  config: Record<string, unknown>;
}

export interface BIFilter {
  field: string;
  operator: 'eq' | 'gt' | 'lt' | 'between' | 'in';
  value: unknown;
}

export interface BIQuery {
  dimensions: string[];
  measures: string[];
  filters?: BIFilter[];
  groupBy?: string[];
  orderBy?: { field: string; direction: 'asc' | 'desc' }[];
  limit?: number;
}

export interface SalesForecast {
  historical: Record<string, number>;
  forecast: Record<string, number>;
  confidence: number;
}

export class BIService {
  async executeQuery(
    organizationId: string,
    query: BIQuery
  ): Promise<{ data: Array<Record<string, unknown>>; total?: number }> {
    // Build Prisma query based on BI query
    const where: Record<string, unknown> = {
      organizationId,
    };

    // Apply filters
    if (query.filters) {
      query.filters.forEach(filter => {
        switch (filter.operator) {
          case 'eq':
            where[filter.field] = filter.value;
            break;
          case 'gt':
            where[filter.field] = { gt: filter.value };
            break;
          case 'lt':
            where[filter.field] = { lt: filter.value };
            break;
          case 'between':
            where[filter.field] = {
              gte: filter.value[0],
              lte: filter.value[1],
            };
            break;
          case 'in':
            where[filter.field] = { in: filter.value };
            break;
        }
      });
    }

    // Execute query based on data source
    if (query.dimensions.includes('order') || query.measures.includes('revenue')) {
      return await this.queryOrders(organizationId, where, query);
    } else if (query.dimensions.includes('product') || query.measures.includes('quantity')) {
      return await this.queryProducts(organizationId, where, query);
    } else if (query.dimensions.includes('customer')) {
      return await this.queryCustomers(organizationId, where, query);
    }

    return { data: [] };
  }

  private async queryOrders(
    organizationId: string,
    where: Record<string, unknown>,
    query: BIQuery
  ): Promise<{ data: Array<Record<string, unknown>>; total: number }> {
    const orders = await prisma.order.findMany({
      where,
      include: {
        items: {
          include: {
            product: true,
          },
        },
        customer: true,
      },
    });

    // Aggregate data
    const aggregated = this.aggregateData(orders, query.measures, query.groupBy);

    return {
      data: aggregated,
      total: orders.length,
    };
  }

  private async queryProducts(
    organizationId: string,
    where: Record<string, unknown>,
    query: BIQuery
  ): Promise<{ data: Array<Record<string, unknown>>; total: number }> {
    const products = await prisma.product.findMany({
      where,
      include: {
        orderItems: true,
        category: true,
      },
    });

    const aggregated = this.aggregateData(products, query.measures, query.groupBy);

    return {
      data: aggregated,
      total: products.length,
    };
  }

  private async queryCustomers(
    organizationId: string,
    where: Record<string, unknown>,
    query: BIQuery
  ): Promise<{ data: Array<Record<string, unknown>>; total: number }> {
    const customers = await prisma.customer.findMany({
      where,
      include: {
        orders: true,
      },
    });

    const aggregated = this.aggregateData(customers, query.measures, query.groupBy);

    return {
      data: aggregated,
      total: customers.length,
    };
  }

  private aggregateData(
    data: Array<Record<string, unknown>>,
    measures: string[],
    groupBy?: string[]
  ): Array<Record<string, unknown>> {
    if (!groupBy || groupBy.length === 0) {
      // Simple aggregation
      const result: Record<string, unknown> = {};
      measures.forEach(measure => {
        switch (measure) {
          case 'revenue':
            result.revenue = data.reduce((sum, item) => {
              return sum + (item.totalAmount || item.price || 0);
            }, 0);
            break;
          case 'quantity':
            result.quantity = data.reduce((sum, item) => {
              return sum + (item.quantity || item.stockQuantity || 1);
            }, 0);
            break;
          case 'count':
            result.count = data.length;
            break;
        }
      });
      return [result];
    }

    // Group by dimensions
    const grouped = new Map<string, Record<string, unknown>>();

    data.forEach(item => {
      const key = groupBy.map(field => item[field] || 'unknown').join('|');
      
      if (!grouped.has(key)) {
        grouped.set(key, {
          ...groupBy.reduce((acc, field) => {
            acc[field] = item[field];
            return acc;
          }, {} as Record<string, unknown>),
          revenue: 0,
          quantity: 0,
          count: 0,
        });
      }

      const group = grouped.get(key);
      group.revenue += item.totalAmount || item.price || 0;
      group.quantity += item.quantity || item.stockQuantity || 1;
      group.count += 1;
    });

    return Array.from(grouped.values());
  }

  async getSalesForecast(
    organizationId: string,
    days: number = 30
  ): Promise<SalesForecast> {
    // Get historical sales data
    const orders = await prisma.order.findMany({
      where: {
        organizationId,
        createdAt: {
          gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // Last 90 days
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Simple time series forecast
    const dailySales = this.groupByDay(orders);
    const forecast = this.calculateForecast(dailySales, days);

    return {
      historical: dailySales,
      forecast,
      confidence: 0.75,
    };
  }

  async getCustomerSegmentation(
    organizationId: string
  ): Promise<Array<Record<string, unknown>>> {
    const customers = await prisma.customer.findMany({
      where: { organizationId },
      include: {
        orders: true,
      },
    });

    const segments = customers.map(customer => {
      const totalSpent = customer.orders.reduce((sum, order) => sum + order.totalAmount, 0);
      const orderCount = customer.orders.length;
      const avgOrderValue = orderCount > 0 ? totalSpent / orderCount : 0;

      let segment = 'new';
      if (totalSpent > 1000 && orderCount > 5) {
        segment = 'vip';
      } else if (totalSpent > 500 || orderCount > 3) {
        segment = 'regular';
      } else if (totalSpent > 0) {
        segment = 'casual';
      }

      return {
        customerId: customer.id,
        customerName: customer.name,
        segment,
        totalSpent,
        orderCount,
        avgOrderValue,
      };
    });

    return {
      segments: {
        vip: segments.filter(s => s.segment === 'vip'),
        regular: segments.filter(s => s.segment === 'regular'),
        casual: segments.filter(s => s.segment === 'casual'),
        new: segments.filter(s => s.segment === 'new'),
      },
      summary: {
        total: segments.length,
        vip: segments.filter(s => s.segment === 'vip').length,
        regular: segments.filter(s => s.segment === 'regular').length,
        casual: segments.filter(s => s.segment === 'casual').length,
        new: segments.filter(s => s.segment === 'new').length,
      },
    };
  }

  private groupByDay(orders: Array<{ createdAt: Date; totalAmount?: number }>): Record<string, number> {
    const daily: Record<string, number> = {};

    orders.forEach(order => {
      const date = order.createdAt.toISOString().split('T')[0];
      daily[date] = (daily[date] || 0) + order.totalAmount;
    });

    return daily;
  }

  private calculateForecast(
    historical: Record<string, number>,
    days: number
  ): Record<string, number> {
    const values = Object.values(historical);
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;

    // Simple moving average forecast
    const forecast: Record<string, number> = {};
    const today = new Date();

    for (let i = 1; i <= days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      forecast[dateStr] = avg * (1 + Math.sin(i * 0.1) * 0.1); // Add some variation
    }

    return forecast;
  }
}

