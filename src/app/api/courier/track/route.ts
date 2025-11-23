import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sriLankaCourierService } from '@/lib/courier/sriLankaCourierService';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const trackingNumber = searchParams.get('trackingNumber');
    const courierCode = searchParams.get('courierCode');

    if (!trackingNumber || !courierCode) {
      return NextResponse.json({ 
        error: 'Tracking number and courier code required' 
      }, { status: 400 });
    }

    const trackingInfo = await sriLankaCourierService.trackShipment(trackingNumber, courierCode);
    
    return NextResponse.json(trackingInfo);
  } catch (error) {
    console.error('Courier tracking error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await _request.json();
    const { pickupAddress, deliveryAddress, package: packageData, orderId, organizationId, courierCode } = body;

    if (!pickupAddress || !deliveryAddress || !packageData || !orderId || !organizationId || !courierCode) {
      return NextResponse.json({ 
        error: 'All shipment details required' 
      }, { status: 400 });
    }

    const shipmentRequest = {
      pickupAddress,
      deliveryAddress,
      package: packageData,
      orderId,
      organizationId
    };

    const shipment = await sriLankaCourierService.createShipment(shipmentRequest, courierCode);
    
    return NextResponse.json(shipment);
  } catch (error) {
    console.error('Shipment creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 