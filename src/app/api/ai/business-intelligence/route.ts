import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { businessIntelligenceService } from '@/lib/ai/businessIntelligenceService';
import { prisma } from '@/lib/prisma';

interface OrderWithRelations {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  total: number;
  status: string;
  customerId: string;
  organizationId: string;
  items: any[];
  customer: any;
}

interface CustomerData {
  id: string;
  name: string;
  email: string;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
  totalSpent?: number;
  orders?: any[];
}

interface ProductData {
  id: string;
  name: string;
  price: number;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
  category?: string;
  stock?: number;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const organizationId = session.user.organizationId;

    // Get data for BI analysis
    const orders = await prisma.order.findMany({
      where: { organizationId },
      include: { items: true, customer: true },
    });

    const products = await prisma.product.findMany({
      where: { organizationId },
    });

    const customers = await prisma.customer.findMany({
      where: { organizationId },
    });

    const salesData = orders.map((order: OrderWithRelations) => ({
      orderId: order.id,
      date: order.createdAt,
      total: order.total,
      customerId: order.customerId,
      items: order.items,
    }));

    const orderData = orders.map((order: OrderWithRelations) => ({
      orderId: order.id,
      status: order.status,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      total: order.total,
    }));

    const customerData = customers.map((customer: CustomerData) => ({
      customerId: customer.id,
      name: customer.name,
      email: customer.email,
      totalSpent: customer.totalSpent,
      orderCount: customer.orders?.length || 0,
    }));

    const productData = products.map((product: ProductData) => ({
      productId: product.id,
      name: product.name,
      price: product.price,
      stock: product.stock,
      category: product.category,
    }));

    switch (type) {
      case 'real-time-metrics':
        const realTimeMetrics = await businessIntelligenceService.generateRealTimeMetrics(
          salesData,
          orderData,
          customerData,
          productData
        );
        return NextResponse.json({ realTimeMetrics });

      case 'performance-kpis':
        const currentData = {
          sales: salesData,
          orders: orderData,
          customers: customerData,
          products: productData,
        };

        // Get historical data (last 30 days)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const historicalOrders = await prisma.order.findMany({
          where: {
            organizationId,
            createdAt: { gte: thirtyDaysAgo },
          },
        });

        const historicalData = {
          sales: historicalOrders.map((order: OrderWithRelations) => ({
            orderId: order.id,
            date: order.createdAt,
            total: order.total,
          })),
        };

        // Define targets (these would come from business goals)
        const targets = {
          revenueGrowth: 10, // 10% growth target
          customerAcquisitionCost: 50, // $50 target
          customerLifetimeValue: 500, // $500 target
          orderFulfillmentRate: 95, // 95% target
          customerSatisfactionScore: 4.5, // 4.5/5 target
          inventoryTurnover: 12, // 12 times per year
          profitMargin: 25, // 25% target
        };

        const kpis = await businessIntelligenceService.calculatePerformanceKPIs(
          [currentData],
          [historicalData],
          [targets]
        );
        return NextResponse.json({ kpis });

      case 'sales-forecasts':
        const historicalSales = salesData;
        const marketData: any[] = []; // This would come from market research
        const seasonalData: any[] = []; // This would come from seasonal analysis
        const forecasts = await businessIntelligenceService.generateSalesForecasts(
          historicalSales,
          marketData,
          seasonalData
        );
        return NextResponse.json({ forecasts });

      case 'market-trends':
        const marketTrendsData: any[] = []; // This would come from market research APIs
        const competitorData: any[] = []; // This would come from competitor analysis
        const industryReports: any[] = []; // This would come from industry reports
        const trends = await businessIntelligenceService.analyzeMarketTrends(
          marketTrendsData,
          competitorData,
          industryReports
        );
        return NextResponse.json({ trends });

      case 'competitive-analysis':
        const competitorAnalysisData: any[] = []; // This would come from competitor research
        const marketShareData: any[] = []; // This would come from market share analysis
        const productComparison: any[] = []; // This would come from product comparison
        const competitiveAnalysis = await businessIntelligenceService.performCompetitiveAnalysis(
          competitorAnalysisData,
          marketShareData,
          productComparison
        );
        return NextResponse.json({ competitiveAnalysis });

      case 'risk-assessment':
        const businessData = {
          sales: salesData,
          orders: orderData,
          customers: customerData,
          products: productData,
        };
        const marketRiskData: any[] = []; // This would come from market risk analysis
        const financialData: any[] = []; // This would come from financial analysis
        const risks = await businessIntelligenceService.assessBusinessRisks(
          [businessData],
          marketRiskData,
          financialData
        );
        return NextResponse.json({ risks });

      case 'business-insights':
        const marketTrendsDataInsights: any[] = []; // This would come from market research APIs
        const competitorDataInsights: any[] = []; // This would come from competitor analysis
        const allData = {
          sales: salesData,
          orders: orderData,
          customers: customerData,
          products: productData,
          market: marketTrendsDataInsights,
          competitors: competitorDataInsights,
        };
        const insights = await businessIntelligenceService.generateBusinessInsights([allData]);
        return NextResponse.json({ insights });

      case 'dashboard-summary':
        // Get comprehensive dashboard data
        const realTimeMetricsSummary = await businessIntelligenceService.generateRealTimeMetrics(
          salesData,
          orderData,
          customerData,
          productData
        );

        const currentDataSummary = {
          sales: salesData,
          orders: orderData,
          customers: customerData,
          products: productData,
        };

        const thirtyDaysAgoSummary = new Date();
        thirtyDaysAgoSummary.setDate(thirtyDaysAgoSummary.getDate() - 30);

        const historicalOrdersSummary = await prisma.order.findMany({
          where: {
            organizationId,
            createdAt: { gte: thirtyDaysAgoSummary },
          },
        });

        const historicalDataSummary = {
          sales: historicalOrdersSummary.map((order: OrderWithRelations) => ({
            orderId: order.id,
            date: order.createdAt,
            total: order.total,
          })),
        };

        const targetsSummary = {
          revenueGrowth: 15, // 15% growth target
          customerAcquisitionCost: 50, // $50 CAC target
          customerLifetimeValue: 500, // $500 LTV target
          orderFulfillmentRate: 95, // 95% fulfillment rate
          customerSatisfactionScore: 4.5, // 4.5/5 target
          inventoryTurnover: 12, // 12 times per year
          profitMargin: 25, // 25% target
        };

        const kpisSummary = await businessIntelligenceService.calculatePerformanceKPIs(
          [currentDataSummary],
          [historicalDataSummary],
          [targetsSummary]
        );

        const topProducts = products
          .sort((a: any, b: any) => (b.sales || 0) - (a.sales || 0))
          .slice(0, 5);

        const recentOrders = orders
          .sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime())
          .slice(0, 10);

        const customerActivity = customers
          .sort((a: any, b: any) => (b.orders?.length || 0) - (a.orders?.length || 0))
          .slice(0, 5);

        return NextResponse.json({
          realTimeMetrics: realTimeMetricsSummary,
          kpis: kpisSummary,
          topProducts,
          recentOrders,
          customerActivity,
        });

      default:
        return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in business intelligence API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, data } = body;
    const organizationId = session.user.organizationId;

    switch (action) {
      case 'create-custom-report':
        // Create a custom business report
        const report = await prisma.businessReport.create({
          data: {
            ...data,
            organizationId,
            createdBy: session.user.id,
            status: 'DRAFT',
          },
        });
        return NextResponse.json({ report });

      case 'set-kpi-targets':
        // Set KPI targets for the organization
        const { kpiName, targetValue, period } = data;
        const kpiTarget = await prisma.kpiTarget.create({
          data: {
            kpiName,
            targetValue,
            period,
            organizationId,
            createdBy: session.user.id,
          },
        });
        return NextResponse.json({ kpiTarget });

      case 'create-alert':
        // Create business alert based on KPI thresholds
        const alert = await prisma.businessAlert.create({
          data: {
            ...data,
            organizationId,
            createdBy: session.user.id,
            status: 'ACTIVE',
          },
        });
        return NextResponse.json({ alert });

      case 'export-data':
        // Export business data for external analysis
        const { dataType, format, dateRange } = data;
        
        let exportData;
        switch (dataType) {
          case 'sales':
            exportData = await prisma.order.findMany({
              where: {
                organizationId,
                createdAt: {
                  gte: dateRange.start,
                  lte: dateRange.end,
                },
              },
              include: { items: true, customer: true },
            });
            break;
          case 'customers':
            exportData = await prisma.customer.findMany({
              where: { organizationId },
              include: { orders: true },
            });
            break;
          case 'products':
            exportData = await prisma.product.findMany({
              where: { organizationId },
              include: { category: true },
            });
            break;
          default:
            return NextResponse.json({ error: 'Invalid data type' }, { status: 400 });
        }

        return NextResponse.json({ 
          exportData,
          format,
          exportedAt: new Date(),
        });

      case 'schedule-report':
        // Schedule automated report generation
        const scheduledReport = await prisma.scheduledReport.create({
          data: {
            ...data,
            organizationId,
            createdBy: session.user.id,
            status: 'ACTIVE',
          },
        });
        return NextResponse.json({ scheduledReport });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in business intelligence API POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 