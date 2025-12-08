import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { AdvancedPredictiveService } from '@/lib/ai/analytics/advancedPredictiveService';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const days = parseInt(searchParams.get('days') || '30');

    const service = new AdvancedPredictiveService();

    if (type === 'forecast') {
      const result = await service.generateSalesForecast(session?.user?.organizationId, days);
      return NextResponse.json(result);
    } else if (type === 'trends') {
      const metric = searchParams.get('metric') as 'sales' | 'products' | 'customers' || 'sales';
      const period = searchParams.get('period') as 'weekly' | 'monthly' | 'quarterly' || 'monthly';
      const result = await service.analyzeTrends(session?.user?.organizationId, metric, period);
      return NextResponse.json(result);
    } else if (type === 'competitive') {
      const competitors = searchParams.get('competitors')?.split(',') || [];
      const result = await service.competitiveIntelligence(session?.user?.organizationId, competitors);
      return NextResponse.json(result);
    } else if (type === 'price') {
      const productId = searchParams.get('productId');
      if (!productId) {
        return NextResponse.json({ message: 'Missing productId' }, { status: 400 });
      }
      const result = await service.optimizePrice(session?.user?.organizationId, productId);
      return NextResponse.json(result);
    }

    return NextResponse.json({ message: 'Invalid type parameter' }, { status: 400 });
  } catch (error) {
    console.error('Error fetching advanced analytics:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

