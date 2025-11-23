import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { IoTService } from '@/lib/iot/iotService';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId');
    const warehouseId = searchParams.get('warehouseId');

    const service = new IoTService();

    if (deviceId) {
      const device = await service.getDeviceStatus(deviceId);
      return NextResponse.json(device);
    } else if (warehouseId) {
      const devices = await service.getWarehouseDevices(warehouseId);
      return NextResponse.json(devices);
    }

    return NextResponse.json({ message: 'Missing deviceId or warehouseId' }, { status: 400 });
  } catch (error) {
    console.error('Error fetching IoT devices:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await _request.json();
    const { action } = body;

    const service = new IoTService();

    if (action === 'register') {
      const { warehouseId, deviceId, deviceType, name, location } = body;
      const device = await service.registerDevice(
        session.user.organizationId,
        warehouseId || null,
        deviceId,
        deviceType,
        name,
        location
      );
      return NextResponse.json(device, { status: 201 });
    } else if (action === 'reading') {
      const { deviceId, sensorType, value, unit, productId } = body;
      await service.updateSensorReading(deviceId, sensorType, value, unit, productId);
      return NextResponse.json({ message: 'Reading updated' });
    } else if (action === 'smart-shelf') {
      const { warehouseId, productId, location, threshold } = body;
      const device = await service.createSmartShelf(
        session.user.organizationId,
        warehouseId,
        productId,
        location,
        threshold
      );
      return NextResponse.json(device, { status: 201 });
    }

    return NextResponse.json({ message: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error processing IoT request:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

