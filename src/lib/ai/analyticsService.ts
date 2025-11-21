import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';
import { formatCurrency } from '@/lib/utils';

interface SalesForecast {
  period: string;
  predictedSales: number;
  confidence: number;
  factors: string[];
}

interface CustomerSegment {
  id: string;
  name: string;
  criteria: string;
  customerCount: number;
  averageValue: number;
  churnRisk: number;
}

interface InventoryForecast {
  productId: string;
  productName: string;
  currentStock: number;
  predictedDemand: number;
  recommendedReorder: number;
  reorderDate: Date;
}

interface SeasonalData {
  month: string;
  averageSales: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  seasonalFactor: number;
}

interface CourierMetrics {
  courierId: string;
  courierName: string;
  deliverySuccessRate: number;
  averageDeliveryTime: number;
  customerSatisfaction: number;
  totalDeliveries: number;
}

export class AIAnalyticsService {
  private openai: OpenAI | null = null;

  constructor() {
    // OpenAI client will be initialized lazily when needed
  }

  private getOpenAIClient(): OpenAI {
    if (!this.openai) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY environment variable is not set');
      }
      this.openai = new OpenAI({ apiKey });
    }
    return this.openai;
  }

  // Customer Analytics
  async calculateCustomerLifetimeValue(customerId: string, organizationId: string): Promise<number> {
    try {
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        include: {
          orders: {
            where: { organizationId },
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!customer || customer.orders.length === 0) return 0;

      const totalSpent = customer.orders.reduce((sum, order) => sum + order.totalAmount, 0);
      const averageOrderValue = totalSpent / customer.orders.length;
      const purchaseFrequency = customer.orders.length / 12; // orders per month
      const customerLifespan = 24; // estimated months

      const clv = averageOrderValue * purchaseFrequency * customerLifespan;
      return Math.round(clv * 100) / 100;
    } catch (error) {
      console.error('Error calculating CLV:', error);
      return 0;
    }
  }

  async predictCustomerChurn(customerId: string, organizationId: string): Promise<number> {
    try {
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        include: {
          orders: {
            where: { organizationId },
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!customer) return 0.5;

<<<<<<< HEAD
      // Get last order date from orders
      const lastOrder = customer.orders.length > 0 
        ? customer.orders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]
        : null;
      const lastOrderDate = lastOrder?.createdAt;

      const daysSinceLastOrder = lastOrderDate
        ? Math.floor((Date.now() - lastOrderDate.getTime()) / (1000 * 60 * 60 * 24))
=======
      // Calculate last order date from orders
      const lastOrder = customer.orders[0]; // orders are ordered by createdAt desc
      const daysSinceLastOrder = lastOrder
        ? Math.floor((Date.now() - new Date(lastOrder.createdAt).getTime()) / (1000 * 60 * 60 * 24))
>>>>>>> 08d9e1855dc7fd2c99e5d62def516239ff37a9a7
        : 365;

      const orderFrequency = customer.orders.length / 12; // orders per month
      const totalSpent = customer.orders.reduce((sum, order) => sum + order.totalAmount, 0);
      const averageOrderValue = totalSpent / Math.max(customer.orders.length, 1);

      // Simple churn prediction model
      let churnRisk = 0.1; // Base risk

      if (daysSinceLastOrder > 90) churnRisk += 0.3;
      if (daysSinceLastOrder > 180) churnRisk += 0.3;
      if (orderFrequency < 0.5) churnRisk += 0.2;
      if (averageOrderValue < 50) churnRisk += 0.1;

      return Math.min(churnRisk, 1);
    } catch (error) {
      console.error('Error predicting churn:', error);
      return 0.5;
    }
  }

  async segmentCustomers(organizationId: string): Promise<CustomerSegment[]> {
    try {
      const customers = await prisma.customer.findMany({
        where: { organizationId },
        include: {
          orders: {
            where: { organizationId },
          },
        },
      });

      const segments: CustomerSegment[] = [
        {
          id: 'high-value',
          name: 'High Value Customers',
          criteria: 'Total spent > $1000',
          customerCount: customers.filter(c => {
            const total = c.orders.reduce((sum, o) => sum + o.totalAmount, 0);
            return total > 1000;
          }).length,
          averageValue: customers
            .filter(c => {
              const total = c.orders.reduce((sum, o) => sum + o.totalAmount, 0);
              return total > 1000;
            })
            .reduce((sum, c) => sum + c.orders.reduce((s, o) => s + o.totalAmount, 0), 0) / Math.max(customers.filter(c => {
              const total = c.orders.reduce((sum, o) => sum + o.totalAmount, 0);
              return total > 1000;
            }).length, 1),
          churnRisk: 0.1,
        },
        {
          id: 'regular',
          name: 'Regular Customers',
          criteria: 'Total spent $100-$1000, multiple orders',
<<<<<<< HEAD
          customerCount: customers.filter(c => {
            const total = c.orders.reduce((sum, o) => sum + o.totalAmount, 0);
            return total >= 100 && total <= 1000 && c.orders.length > 1;
          }).length,
          averageValue: customers
            .filter(c => {
              const total = c.orders.reduce((sum, o) => sum + o.totalAmount, 0);
              return total >= 100 && total <= 1000 && c.orders.length > 1;
            })
            .reduce((sum, c) => sum + c.orders.reduce((s, o) => s + o.totalAmount, 0), 0) / Math.max(customers.filter(c => {
              const total = c.orders.reduce((sum, o) => sum + o.totalAmount, 0);
              return total >= 100 && total <= 1000 && c.orders.length > 1;
            }).length, 1),
=======
          customerCount: customers.filter(c => c.totalSpent >= 100 && c.totalSpent <= 1000 && c.orders.length > 1).length,
          averageValue: customers.filter(c => c.totalSpent >= 100 && c.totalSpent <= 1000 && c.orders.length > 1).reduce((sum, c) => sum + c.totalSpent, 0) / Math.max(customers.filter(c => c.totalSpent >= 100 && c.totalSpent <= 1000 && c.orders.length > 1).length, 1),
>>>>>>> 08d9e1855dc7fd2c99e5d62def516239ff37a9a7
          churnRisk: 0.3,
        },
        {
          id: 'new',
          name: 'New Customers',
          criteria: 'First-time buyers',
          customerCount: customers.filter(c => c.orders.length === 1).length,
<<<<<<< HEAD
          averageValue: customers
            .filter(c => c.orders.length === 1)
            .reduce((sum, c) => sum + c.orders.reduce((s, o) => s + o.totalAmount, 0), 0) / Math.max(customers.filter(c => c.orders.length === 1).length, 1),
=======
          averageValue: customers.filter(c => c.orders.length === 1).reduce((sum, c) => sum + c.totalSpent, 0) / Math.max(customers.filter(c => c.orders.length === 1).length, 1),
>>>>>>> 08d9e1855dc7fd2c99e5d62def516239ff37a9a7
          churnRisk: 0.6,
        },
        {
          id: 'at-risk',
          name: 'At Risk Customers',
          criteria: 'No orders in last 90 days',
          customerCount: customers.filter(c => {
<<<<<<< HEAD
            if (c.orders.length === 0) return true;
            const lastOrder = c.orders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
            const daysSinceLastOrder = Math.floor((Date.now() - lastOrder.createdAt.getTime()) / (1000 * 60 * 60 * 24));
=======
            if (!c.orders || c.orders.length === 0) return true;
            const lastOrder = c.orders[0]; // Assuming orders are sorted by date
            const daysSinceLastOrder = Math.floor((Date.now() - new Date(lastOrder.createdAt).getTime()) / (1000 * 60 * 60 * 24));
>>>>>>> 08d9e1855dc7fd2c99e5d62def516239ff37a9a7
            return daysSinceLastOrder > 90;
          }).length,
          averageValue: 0,
          churnRisk: 0.8,
        },
      ];

      return segments;
    } catch (error) {
      console.error('Error segmenting customers:', error);
      return [];
    }
  }

  // Sales Analytics
  async forecastSales(timeframe: string, organizationId: string): Promise<SalesForecast[]> {
    try {
      const orders = await prisma.order.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });

      const salesData = orders.map(order => ({
        date: order.createdAt,
        amount: order.totalAmount,
      }));

      const prompt = `
        Analyze this sales data and forecast future sales for ${timeframe}:
        ${JSON.stringify(salesData)}
        
        Return JSON array with:
        - period: string (e.g., "Next Week", "Next Month")
        - predictedSales: number
        - confidence: number (0-1)
        - factors: string[] (factors affecting prediction)
      `;

      const response = await this.getOpenAIClient().chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      });

      const result = JSON.parse(response.choices[0].message.content || '[]');
      return result;
    } catch (error) {
      console.error('Error forecasting sales:', error);
      return [];
    }
  }

  async analyzeSeasonalTrends(organizationId: string): Promise<SeasonalData[]> {
    try {
      const orders = await prisma.order.findMany({
        where: { organizationId },
        select: {
          totalAmount: true,
          createdAt: true,
        },
      });

      // Group by month
      const monthlyData = orders.reduce((acc, order) => {
        const month = new Date(order.createdAt).toLocaleString('default', { month: 'long' });
        if (!acc[month]) {
          acc[month] = { total: 0, count: 0 };
        }
        acc[month].total += order.totalAmount;
        acc[month].count += 1;
        return acc;
      }, {} as Record<string, { total: number; count: number }>);

      const seasonalData: SeasonalData[] = Object.entries(monthlyData).map(([month, data]) => ({
        month,
        averageSales: data.total / data.count,
        trend: 'stable' as const,
        seasonalFactor: data.total / Math.max(...Object.values(monthlyData).map(d => d.total)),
      }));

      return seasonalData;
    } catch (error) {
      console.error('Error analyzing seasonal trends:', error);
      return [];
    }
  }

  async identifyTopPerformers(organizationId: string): Promise<any[]> {
    try {
      const products = await prisma.product.findMany({
        where: { organizationId },
        include: {
          _count: {
            select: {
              orderItems: true,
            },
          },
        },
      });

      const topProducts = products
        .map(product => ({
          id: product.id,
          name: product.name,
          sales: product._count.orderItems,
          revenue: product.price * product._count.orderItems,
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      return topProducts;
    } catch (error) {
      console.error('Error identifying top performers:', error);
      return [];
    }
  }

  // Operational Analytics
  async optimizeDeliveryRoutes(organizationId: string): Promise<any[]> {
    try {
      const orders = await prisma.order.findMany({
        where: {
          organizationId,
          status: { in: ['CONFIRMED', 'PACKED'] },
        },
        include: {
          customer: true,
        },
      });

      // Simple route optimization - group by area
      const routes = orders.reduce((acc, order) => {
<<<<<<< HEAD
        // Get address from Order metadata or shippingAddress
        const address = (order.metadata as any)?.shippingAddress || (order.metadata as any)?.address || '';
        const area = address ? address.split(',')[1]?.trim() || 'Unknown' : 'Unknown';
=======
        const area = order.customer.address ? order.customer.address.split(',')[1]?.trim() || 'Unknown' : 'Unknown';
>>>>>>> 08d9e1855dc7fd2c99e5d62def516239ff37a9a7
        if (!acc[area]) {
          acc[area] = [];
        }
        acc[area].push(order);
        return acc;
      }, {} as Record<string, any[]>);

      return Object.entries(routes).map(([area, orders]) => ({
        area,
        orderCount: orders.length,
        totalValue: orders.reduce((sum, order) => sum + order.totalAmount, 0),
        orders: orders.map(order => ({
          id: order.id,
          orderNumber: order.orderNumber,
          customerName: order.customer.name,
          address: (order.metadata as any)?.shippingAddress || (order.metadata as any)?.address || '',
        })),
      }));
    } catch (error) {
      console.error('Error optimizing delivery routes:', error);
      return [];
    }
  }

  async analyzeCourierPerformance(organizationId: string): Promise<CourierMetrics[]> {
    try {
      // Get shipments via orders (Shipment doesn't have organizationId directly)
      const orders = await prisma.order.findMany({
        where: { organizationId },
        select: { id: true },
      });
      const orderIds = orders.map(o => o.id);
      
      const shipments = await prisma.shipment.findMany({
        where: { orderId: { in: orderIds } },
        include: {
          order: true,
        },
      });

      const courierMetrics = shipments.reduce((acc, shipment) => {
        const courierId = shipment.courierId;
        if (!courierId) return acc; // Skip shipments without courier
        
        if (!acc[courierId]) {
          // Fetch courier name if available
          const courierName = courierId || 'Unknown'; // TODO: Fetch from CourierDelivery or metadata
          acc[courierId] = {
            courierId,
<<<<<<< HEAD
            courierName,
=======
            courierName: shipment.courier?.name || 'Unknown',
>>>>>>> 08d9e1855dc7fd2c99e5d62def516239ff37a9a7
            deliveries: [],
            successfulDeliveries: 0,
            totalDeliveryTime: 0,
          };
        }

        acc[courierId].deliveries.push(shipment);
        if (shipment.status === 'DELIVERED') {
          acc[courierId].successfulDeliveries++;
        }

        if (shipment.deliveredAt && shipment.shippedAt) {
          const deliveryTime = new Date(shipment.deliveredAt).getTime() - new Date(shipment.shippedAt).getTime();
          acc[courierId].totalDeliveryTime += deliveryTime;
        }

        return acc;
      }, {} as Record<string, any>);

      return Object.values(courierMetrics).map((courier: any) => ({
        courierId: courier.courierId,
        courierName: courier.courierName,
        deliverySuccessRate: courier.successfulDeliveries / courier.deliveries.length,
        averageDeliveryTime: courier.totalDeliveryTime / Math.max(courier.successfulDeliveries, 1) / (1000 * 60 * 60), // hours
        customerSatisfaction: 0.85, // Placeholder - would come from ratings
        totalDeliveries: courier.deliveries.length,
      }));
    } catch (error) {
      console.error('Error analyzing courier performance:', error);
      return [];
    }
  }

  async predictInventoryNeeds(organizationId: string): Promise<InventoryForecast[]> {
    try {
      const products = await prisma.product.findMany({
        where: { organizationId },
        include: {
          orderItems: {
            where: {
              order: {
                createdAt: {
                  gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
                },
              },
            },
          },
        },
      });

      const forecasts: InventoryForecast[] = products.map(product => {
        const monthlyDemand = product.orderItems.reduce((sum, item) => sum + item.quantity, 0);
        const predictedDemand = Math.ceil(monthlyDemand * 1.2); // 20% buffer
        const recommendedReorder = Math.max(predictedDemand - product.stockQuantity, 0);
        const reorderDate = new Date(Date.now() + (product.stockQuantity / monthlyDemand) * 30 * 24 * 60 * 60 * 1000);

        return {
          productId: product.id,
          productName: product.name,
          currentStock: product.stockQuantity,
          predictedDemand,
          recommendedReorder,
          reorderDate,
        };
      });

      return forecasts.filter(forecast => forecast.recommendedReorder > 0);
    } catch (error) {
      console.error('Error predicting inventory needs:', error);
      return [];
    }
  }

  // Business Intelligence Dashboard
  async generateBusinessInsights(organizationId: string): Promise<any> {
    try {
      const [
        customerSegments,
        salesForecast,
        topProducts,
        inventoryForecast,
        courierMetrics,
      ] = await Promise.all([
        this.segmentCustomers(organizationId),
        this.forecastSales('Next Month', organizationId),
        this.identifyTopPerformers(organizationId),
        this.predictInventoryNeeds(organizationId),
        this.analyzeCourierPerformance(organizationId),
      ]);

      return {
        customerInsights: {
          segments: customerSegments,
          totalCustomers: customerSegments.reduce((sum, segment) => sum + segment.customerCount, 0),
          averageCLV: customerSegments.reduce((sum, segment) => sum + segment.averageValue, 0) / customerSegments.length,
        },
        salesInsights: {
          forecast: salesForecast,
          topProducts,
          seasonalTrends: await this.analyzeSeasonalTrends(organizationId),
        },
        operationalInsights: {
          inventoryForecast,
          courierMetrics,
          deliveryRoutes: await this.optimizeDeliveryRoutes(organizationId),
        },
        recommendations: await this.generateRecommendations(organizationId),
      };
    } catch (error) {
      console.error('Error generating business insights:', error);
      return {};
    }
  }

  private async generateRecommendations(organizationId: string): Promise<string[]> {
    try {
      const prompt = `
        Based on the business data, provide 5 actionable recommendations for improving the business.
        Focus on:
        - Customer retention
        - Sales growth
        - Operational efficiency
        - Inventory management
        - Customer satisfaction
        
        Return JSON array of recommendation strings.
      `;

      const response = await this.getOpenAIClient().chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
      });

      const result = JSON.parse(response.choices[0].message.content || '[]');
      return result;
    } catch (error) {
      console.error('Error generating recommendations:', error);
      return [
        'Focus on customer retention through personalized marketing',
        'Optimize inventory levels based on demand forecasting',
        'Improve delivery performance through courier partnerships',
        'Implement customer feedback system for better satisfaction',
        'Develop loyalty program to increase repeat purchases',
      ];
    }
  }
}

export const aiAnalyticsService = new AIAnalyticsService(); 