import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { BIService } from '@/lib/analytics/biService';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { query } = body;

    if (!query) {
      return NextResponse.json(
        { message: 'Missing query parameter' },
        { status: 400 }
      );
    }

    const biService = new BIService();
    const result = await biService.executeQuery(session.user.organizationId, query);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error executing BI query:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    const biService = new BIService();

    if (type === 'forecast') {
      const days = parseInt(searchParams.get('days') || '30');
      const result = await biService.getSalesForecast(session.user.organizationId, days);
      return NextResponse.json(result);
    } else if (type === 'segmentation') {
      const result = await biService.getCustomerSegmentation(session.user.organizationId);
      return NextResponse.json(result);
    }

    return NextResponse.json({ message: 'Invalid type parameter' }, { status: 400 });
  } catch (error) {
    console.error('Error fetching BI data:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

