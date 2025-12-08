import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { RegionService } from '@/lib/region/regionService';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const region = searchParams.get('region');

    const service = new RegionService();

    if (region) {
      const config = service.getRegionConfigByRegion(region);
      return NextResponse.json(config);
    } else {
      const config = await service.getRegionConfig(session?.user?.organizationId);
      return NextResponse.json(config);
    }
  } catch (error) {
    console.error('Error fetching region config:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { region } = body;

    if (!region) {
      return NextResponse.json(
        { message: 'Missing region parameter' },
        { status: 400 }
      );
    }

    const service = new RegionService();
    await service.setRegion(session?.user?.organizationId, region);

    return NextResponse.json({ message: 'Region updated successfully' });
  } catch (error) {
    console.error('Error setting region:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

