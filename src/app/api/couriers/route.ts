import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const couriers = await prisma.courier.findMany({
      where: { organizationId: session.user.organizationId },
      orderBy: { createdAt: 'desc' },
    });

    // Add mock data for demonstration
    const couriersWithMockData = couriers.map(courier => ({
      ...courier,
      rating: Math.random() * 2 + 3, // Random rating between 3-5
      totalDeliveries: Math.floor(Math.random() * 100) + 10,
      totalEarnings: Math.floor(Math.random() * 5000) + 500,
      isOnline: Math.random() > 0.3, // 70% chance of being online
      currentLocation: Math.random() > 0.5 ? {
        latitude: 6.9271 + (Math.random() - 0.5) * 0.1,
        longitude: 79.8612 + (Math.random() - 0.5) * 0.1,
        address: 'Colombo, Sri Lanka'
      } : undefined,
    }));

    return NextResponse.json(couriersWithMockData);
  } catch (error) {
    console.error('Error fetching couriers:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, email, phone, vehicleType, vehicleNumber, status } = body;

    if (!name || !email || !phone || !vehicleType || !vehicleNumber) {
      return NextResponse.json({ message: 'All fields are required' }, { status: 400 });
    }

    const courier = await prisma.courier.create({
      data: {
        name,
        email,
        phone,
        vehicleType: vehicleType as any,
        vehicleNumber,
        status: status || 'ACTIVE',
        organizationId: session.user.organizationId,
      },
    });

    return NextResponse.json(courier, { status: 201 });
  } catch (error) {
    console.error('Error creating courier:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
} 