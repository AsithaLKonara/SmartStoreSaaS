import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { IoTService } from '@/lib/iot/iotService';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId');

    if (!deviceId) {
      return NextResponse.json({ message: 'Missing deviceId' }, { status: 400 });
    }

    const service = new IoTService();
    const inventory = await service.getSmartShelfInventory(deviceId);

    return NextResponse.json(inventory);
  } catch (error) {
    console.error('Error fetching sensor data:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

