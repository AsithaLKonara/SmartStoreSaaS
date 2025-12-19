import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface PredictiveMetric {
  metric: string;
  currentValue: number;
  predictedValue: number;
  confidence: number;
  trend: 'up' | 'down' | 'stable';
  factors: string[];
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

function calculateMovingAverage(values: number[], periods: number = 3): number {
  if (values.length === 0) return 0;
  const recentValues = values.slice(-periods);
  return recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
}

function calculateTrend(values: number[]): 'up' | 'down' | 'stable' {
  if (values.length < 2) return 'stable';
  const firstHalf = values.slice(0, Math.floor(values.length / 2));
  const secondHalf = values.slice(Math.floor(values.length / 2));
  const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
  const change = ((secondAvg - firstAvg) / firstAvg) * 100;
  
  if (change > 5) return 'up';
  if (change < -5) return 'down';
  return 'stable';
}

function calculateConfidence(values: number[]): number {
  if (values.length < 3) return 50;
  
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  const coefficientOfVariation = mean > 0 ? stdDev / mean : 1;
  
  // Lower variance = higher confidence
  const confidence = Math.max(60, Math.min(95, 100 - (coefficientOfVariation * 50)));
  return Math.round(confidence);
}

export async function GET(request: NextRequest) {
  try {
    const session = (await getServerSession(authOptions)) as { user?: { organizationId?: string | null } | null; } | null;
    if (!session || !session.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '30d';
    const { startDate, endDate, days } = parseTimeRange(timeRange);
    
    const previousStartDate = new Date(startDate.getTime() - (endDate.getTime() - startDate.getTime()));

    // Fetch historical orders
    const historicalOrders = await prisma.order.findMany({
      where: {
        organizationId: session.user.organizationId,
        createdAt: { gte: previousStartDate, lte: endDate },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const historicalCustomers = await prisma.customer.findMany({
      where: {
        organizationId: session.user.organizationId,
        createdAt: { gte: previousStartDate, lte: endDate },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Group data by period for trend analysis
    const periodSize = Math.max(1, Math.floor(days / 7)); // Weekly periods
    const dailyRevenue: number[] = [];
    const dailyOrders: number[] = [];
    const dailyCustomers: number[] = [];

    for (let i = 0; i < days; i++) {
      const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const dayStart = new Date(date.setHours(0, 0, 0, 0));
      const dayEnd = new Date(date.setHours(23, 59, 59, 999));

      const dayOrders = historicalOrders.filter(
        order => order.createdAt >= dayStart && order.createdAt <= dayEnd
      );
      
      const dayRevenue = dayOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
      const dayCustomers = historicalCustomers.filter(
        customer => customer.createdAt >= dayStart && customer.createdAt <= dayEnd
      ).length;

      dailyRevenue.push(dayRevenue);
      dailyOrders.push(dayOrders.length);
      dailyCustomers.push(dayCustomers);
    }

    // Current period data (last period)
    const currentPeriodStart = new Date(startDate.getTime() + (days - periodSize) * 24 * 60 * 60 * 1000);
    const currentPeriodOrders = historicalOrders.filter(
      order => order.createdAt >= currentPeriodStart && order.createdAt <= endDate
    );
    const currentRevenue = currentPeriodOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
    const currentOrderCount = currentPeriodOrders.length;
    const currentCustomerCount = historicalCustomers.filter(
      customer => customer.createdAt >= currentPeriodStart && customer.createdAt <= endDate
    ).length;

    // Predictive metrics
    const metrics: PredictiveMetric[] = [];

    // Revenue prediction
    const revenueTrend = calculateTrend(dailyRevenue);
    const avgRevenue = calculateMovingAverage(dailyRevenue, periodSize);
    const predictedRevenue = avgRevenue * periodSize;
    const revenueConfidence = calculateConfidence(dailyRevenue);
    
    const revenueFactors: string[] = [];
    if (revenueTrend === 'up') revenueFactors.push('Positive revenue trend');
    if (revenueTrend === 'down') revenueFactors.push('Declining revenue trend');
    if (dailyRevenue.length > 0) {
      const recentAvg = dailyRevenue.slice(-7).reduce((sum, val) => sum + val, 0) / Math.min(7, dailyRevenue.length);
      const overallAvg = dailyRevenue.reduce((sum, val) => sum + val, 0) / dailyRevenue.length;
      if (recentAvg > overallAvg * 1.1) revenueFactors.push('Recent performance above average');
      if (recentAvg < overallAvg * 0.9) revenueFactors.push('Recent performance below average');
    }

    metrics.push({
      metric: 'Revenue',
      currentValue: currentRevenue,
      predictedValue: Math.round(predictedRevenue * 100) / 100,
      confidence: revenueConfidence,
      trend: revenueTrend,
      factors: revenueFactors.length > 0 ? revenueFactors : ['Stable revenue pattern'],
    });

    // Order count prediction
    const orderTrend = calculateTrend(dailyOrders);
    const avgOrders = calculateMovingAverage(dailyOrders, periodSize);
    const predictedOrders = Math.round(avgOrders * periodSize);
    const orderConfidence = calculateConfidence(dailyOrders);
    
    const orderFactors: string[] = [];
    if (orderTrend === 'up') orderFactors.push('Growing order volume');
    if (orderTrend === 'down') orderFactors.push('Declining order volume');
    if (currentOrderCount > avgOrders * 1.2) orderFactors.push('Current period above trend');
    if (currentOrderCount < avgOrders * 0.8) orderFactors.push('Current period below trend');

    metrics.push({
      metric: 'Orders',
      currentValue: currentOrderCount,
      predictedValue: predictedOrders,
      confidence: orderConfidence,
      trend: orderTrend,
      factors: orderFactors.length > 0 ? orderFactors : ['Stable order pattern'],
    });

    // Customer count prediction
    if (dailyCustomers.length > 0) {
      const customerTrend = calculateTrend(dailyCustomers);
      const avgCustomers = calculateMovingAverage(dailyCustomers, periodSize);
      const predictedCustomers = Math.round(avgCustomers * periodSize);
      const customerConfidence = calculateConfidence(dailyCustomers);
      
      const customerFactors: string[] = [];
      if (customerTrend === 'up') customerFactors.push('Growing customer base');
      if (customerTrend === 'down') customerFactors.push('Slowing customer acquisition');
      if (currentCustomerCount > avgCustomers * 1.2) customerFactors.push('Recent acquisition spike');
      if (currentCustomerCount < avgCustomers * 0.8) customerFactors.push('Recent acquisition decline');

      metrics.push({
        metric: 'Customers',
        currentValue: currentCustomerCount,
        predictedValue: predictedCustomers,
        confidence: customerConfidence,
        trend: customerTrend,
        factors: customerFactors.length > 0 ? customerFactors : ['Stable customer acquisition'],
      });
    }

    // Average Order Value prediction
    if (currentOrderCount > 0) {
      const avgOrderValue = currentRevenue / currentOrderCount;
      const historicalAOV = dailyRevenue
        .map((rev, idx) => dailyOrders[idx] > 0 ? rev / dailyOrders[idx] : 0)
        .filter(aov => aov > 0);
      
      if (historicalAOV.length > 0) {
        const aovTrend = calculateTrend(historicalAOV);
        const predictedAOV = calculateMovingAverage(historicalAOV, periodSize);
        const aovConfidence = calculateConfidence(historicalAOV);
        
        const aovFactors: string[] = [];
        if (aovTrend === 'up') aovFactors.push('Increasing order values');
        if (aovTrend === 'down') aovFactors.push('Decreasing order values');
        if (avgOrderValue > predictedAOV * 1.1) aovFactors.push('Current AOV above trend');
        if (avgOrderValue < predictedAOV * 0.9) aovFactors.push('Current AOV below trend');

        metrics.push({
          metric: 'Average Order Value',
          currentValue: Math.round(avgOrderValue * 100) / 100,
          predictedValue: Math.round(predictedAOV * 100) / 100,
          confidence: aovConfidence,
          trend: aovTrend,
          factors: aovFactors.length > 0 ? aovFactors : ['Stable AOV pattern'],
        });
      }
    }

    return NextResponse.json({ metrics });
  } catch (error) {
    console.error('Error fetching predictive metrics:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

