import { prisma } from '@/lib/prisma';

export interface ForecastResult {
  forecast: Array<{ date: string; value: number; confidence: number }>;
  confidenceInterval: { lower: number; upper: number };
  trend: 'increasing' | 'decreasing' | 'stable';
  seasonality: boolean;
}

export interface TrendAnalysis {
  trend: 'upward' | 'downward' | 'stable';
  strength: number;
  factors: string[];
  predictions: Array<{ period: string; expectedValue: number }>;
}

export class AdvancedPredictiveService {
  async generateSalesForecast(
    organizationId: string,
    days: number = 30,
    confidenceLevel: number = 0.95
  ): Promise<ForecastResult> {
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

    // Group by day
    const dailySales = this.groupSalesByDay(orders);
    const values = Object.values(dailySales);

    // Calculate trend
    const trend = this.calculateTrend(values);
    
    // Detect seasonality
    const seasonality = this.detectSeasonality(values);

    // Generate forecast using moving average with trend adjustment
    const forecast = this.generateForecast(dailySales, days, trend, seasonality, confidenceLevel);

    return {
      forecast,
      confidenceInterval: this.calculateConfidenceInterval(values, confidenceLevel),
      trend: trend > 0 ? 'increasing' : trend < 0 ? 'decreasing' : 'stable',
      seasonality,
    };
  }

  async analyzeTrends(
    organizationId: string,
    metric: 'sales' | 'products' | 'customers',
    period: 'weekly' | 'monthly' | 'quarterly' = 'monthly'
  ): Promise<TrendAnalysis> {
    let data: Array<Record<string, unknown>> = [];

    switch (metric) {
      case 'sales':
        data = await prisma.order.findMany({
          where: { organizationId },
          orderBy: { createdAt: 'asc' },
        });
        break;
      case 'products':
        data = await prisma.product.findMany({
          where: { organizationId },
          orderBy: { createdAt: 'asc' },
        });
        break;
      case 'customers':
        data = await prisma.customer.findMany({
          where: { organizationId },
          orderBy: { createdAt: 'asc' },
        });
        break;
    }

    const values = this.aggregateByPeriod(data, period, metric);
    const trend = this.calculateTrend(values);
    const factors = this.identifyTrendFactors(organizationId, metric, trend);
    const predictions = this.predictNextPeriods(values, trend, period);

    return {
      trend: trend > 0.1 ? 'upward' : trend < -0.1 ? 'downward' : 'stable',
      strength: Math.abs(trend),
      factors,
      predictions,
    };
  }

  async competitiveIntelligence(
    organizationId: string,
    competitors: string[]
  ): Promise<{
    priceComparison: Array<{ product: string; ourPrice: number; competitorPrice: number; competitor: string }>;
    marketShare: number;
    recommendations: string[];
  }> {
    // Get our products
    const ourProducts = await prisma.product.findMany({
      where: { organizationId, isActive: true },
      take: 10,
    });

    // In production, this would fetch competitor data from APIs or web scraping
    // For now, return mock data structure
    const priceComparison = ourProducts.map(product => ({
      product: product.name,
      ourPrice: product.price,
      competitorPrice: product.price * (0.9 + Math.random() * 0.2), // Mock competitor price
      competitor: competitors[Math.floor(Math.random() * competitors.length)],
    }));

    const marketShare = 0.15; // Mock market share
    const recommendations = [
      'Consider price adjustments for high-competition products',
      'Focus on unique value propositions',
      'Monitor competitor promotions',
    ];

    return {
      priceComparison,
      marketShare,
      recommendations,
    };
  }

  async optimizePrice(
    organizationId: string,
    productId: string
  ): Promise<{
    currentPrice: number;
    recommendedPrice: number;
    expectedImpact: {
      sales: number;
      revenue: number;
      margin: number;
    };
    confidence: number;
  }> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new Error('Product not found');
    }

    // Get sales history
    const orderItems = await prisma.orderItem.findMany({
      where: {
        product: {
          id: productId,
        },
      },
      include: {
        order: true,
      },
    });

    // Simple price elasticity model
    const priceHistory = orderItems.map(item => ({
      price: item.price,
      quantity: item.quantity,
      date: item.order.createdAt,
    }));

    // Calculate price elasticity
    const elasticity = this.calculatePriceElasticity(priceHistory);
    
    // Optimize price
    const recommendedPrice = this.optimizePriceBasedOnElasticity(
      product.price,
      elasticity,
      product.costPrice || 0
    );

    // Estimate impact
    const expectedImpact = this.estimatePriceImpact(
      product.price,
      recommendedPrice,
      elasticity,
      orderItems.length
    );

    return {
      currentPrice: product.price,
      recommendedPrice,
      expectedImpact,
      confidence: 0.75,
    };
  }

  private groupSalesByDay(orders: Array<{ createdAt: Date; totalAmount: number }>): Record<string, number> {
    const daily: Record<string, number> = {};
    orders.forEach(order => {
      const date = order.createdAt.toISOString().split('T')[0];
      daily[date] = (daily[date] || 0) + order.totalAmount;
    });
    return daily;
  }

  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;
    
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = values;
    
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope;
  }

  private detectSeasonality(values: number[]): boolean {
    if (values.length < 14) return false;
    
    // Simple seasonality detection (check for weekly patterns)
    const weeklyAvg = values.slice(-7).reduce((a, b) => a + b, 0) / 7;
    const overallAvg = values.reduce((a, b) => a + b, 0) / values.length;
    
    return Math.abs(weeklyAvg - overallAvg) / overallAvg > 0.1;
  }

  private generateForecast(
    historical: Record<string, number>,
    days: number,
    trend: number,
    seasonality: boolean,
    confidence: number
  ): Array<{ date: string; value: number; confidence: number }> {
    const values = Object.values(historical);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    
    const forecast: Array<{ date: string; value: number; confidence: number }> = [];
    const today = new Date();
    
    for (let i = 1; i <= days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      
      let value = avg + (trend * i);
      
      // Apply seasonality
      if (seasonality) {
        const dayOfWeek = date.getDay();
        const weeklyFactor = 1 + Math.sin(dayOfWeek * Math.PI / 3.5) * 0.1;
        value *= weeklyFactor;
      }
      
      // Confidence decreases over time
      const timeConfidence = Math.max(0.5, 1 - (i / days) * (1 - confidence));
      
      forecast.push({
        date: dateStr,
        value: Math.max(0, value),
        confidence: timeConfidence,
      });
    }
    
    return forecast;
  }

  private calculateConfidenceInterval(
    values: number[],
    confidence: number
  ): { lower: number; upper: number } {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    // Z-score for confidence level (simplified)
    const zScore = confidence === 0.95 ? 1.96 : 1.64;
    const margin = zScore * stdDev;
    
    return {
      lower: avg - margin,
      upper: avg + margin,
    };
  }

  private aggregateByPeriod(data: Array<Record<string, unknown>>, period: string, metric: string): number[] {
    // Simplified aggregation
    const grouped: Record<string, number> = {};
    
    data.forEach(item => {
      const date = new Date(item.createdAt);
      let key: string;
      
      if (period === 'weekly') {
        const week = Math.floor(date.getTime() / (7 * 24 * 60 * 60 * 1000));
        key = `week_${week}`;
      } else if (period === 'monthly') {
        key = `${date.getFullYear()}-${date.getMonth()}`;
      } else {
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        key = `${date.getFullYear()}-Q${quarter}`;
      }
      
      if (metric === 'sales') {
        grouped[key] = (grouped[key] || 0) + (item.totalAmount || 0);
      } else {
        grouped[key] = (grouped[key] || 0) + 1;
      }
    });
    
    return Object.values(grouped);
  }

  private identifyTrendFactors(
    organizationId: string,
    metric: string,
    trend: number
  ): string[] {
    const factors: string[] = [];
    
    if (trend > 0.1) {
      factors.push('Positive growth trend detected');
      if (metric === 'sales') {
        factors.push('Consider increasing inventory');
        factors.push('Marketing campaigns may be effective');
      }
    } else if (trend < -0.1) {
      factors.push('Declining trend detected');
      factors.push('Review marketing strategies');
      factors.push('Consider promotional campaigns');
    }
    
    return factors;
  }

  private predictNextPeriods(
    values: number[],
    trend: number,
    _period: string
  ): Array<{ period: string; expectedValue: number }> {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const predictions: Array<{ period: string; expectedValue: number }> = [];
    
    for (let i = 1; i <= 3; i++) {
      const value = avg + (trend * i * values.length);
      predictions.push({
        period: `Period ${i}`,
        expectedValue: Math.max(0, value),
      });
    }
    
    return predictions;
  }

  private calculatePriceElasticity(priceHistory: Array<{ price: number; quantity: number; date: Date }>): number {
    if (priceHistory.length < 2) return -1.5; // Default elasticity
    
    // Simplified price elasticity calculation
    const priceChanges = priceHistory.slice(1).map((item, i) => ({
      priceChange: (item.price - priceHistory[i].price) / priceHistory[i].price,
      quantityChange: (item.quantity - priceHistory[i].quantity) / priceHistory[i].quantity,
    }));
    
    const avgPriceChange = priceChanges.reduce((sum, item) => sum + item.priceChange, 0) / priceChanges.length;
    const avgQuantityChange = priceChanges.reduce((sum, item) => sum + item.quantityChange, 0) / priceChanges.length;
    
    if (avgPriceChange === 0) return -1.5;
    
    return avgQuantityChange / avgPriceChange;
  }

  private optimizePriceBasedOnElasticity(
    currentPrice: number,
    elasticity: number,
    _costPrice: number
  ): number {
    // Optimal price = cost / (1 + 1/elasticity)
    // Simplified optimization
    if (elasticity > -1) {
      // Inelastic demand - can increase price
      return currentPrice * 1.1;
    } else if (elasticity < -2) {
      // Very elastic demand - consider lowering price
      return currentPrice * 0.95;
    }
    
    return currentPrice;
  }

  private estimatePriceImpact(
    currentPrice: number,
    newPrice: number,
    elasticity: number,
    currentSales: number
  ): { sales: number; revenue: number; margin: number } {
    const priceChange = (newPrice - currentPrice) / currentPrice;
    const quantityChange = elasticity * priceChange;
    
    const newQuantity = currentSales * (1 + quantityChange);
    const newRevenue = newPrice * newQuantity;
    const currentRevenue = currentPrice * currentSales;
    
    return {
      sales: newQuantity,
      revenue: newRevenue,
      margin: (newRevenue - currentRevenue) / currentRevenue,
    };
  }
}

