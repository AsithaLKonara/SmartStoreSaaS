import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const couriers = await prisma.courier.findMany({
      where: { organizationId: session.user.organizationId },
      orderBy: { createdAt: 'desc' },
      include: {
        deliveries: true,
        ratings: true,
      },
    });

    // Calculate real stats from database
    const couriersWithStats = await Promise.all(
      couriers.map(async (courier) => {
        // Calculate average rating
        const avgRatingResult = await prisma.courierRating.aggregate({
          where: { courierId: courier.id },
          _avg: { rating: true },
        });
        const rating = avgRatingResult._avg.rating || 0;

        // Count total deliveries
        const totalDeliveries = courier.deliveries.length;

        // Calculate total earnings
        const earningsResult = await prisma.courierDelivery.aggregate({
          where: { courierId: courier.id },
          _sum: { earnings: true },
        });
        const totalEarnings = earningsResult._sum.earnings || 0;

        // Check if online (based on recent activity - within last 30 minutes)
        const recentDelivery = await prisma.courierDelivery.findFirst({
          where: {
            courierId: courier.id,
            updatedAt: {
              gte: new Date(Date.now() - 30 * 60 * 1000),
            },
          },
          orderBy: { updatedAt: 'desc' },
        });
        const isOnline = !!recentDelivery;

        // Get current location from last delivery (if available)
        let currentLocation = undefined;
        if (recentDelivery) {
          // In a real implementation, this would come from GPS tracking
          // For now, we'll use a placeholder or get from delivery metadata
          currentLocation = recentDelivery.status === 'delivered' ? {
            latitude: 6.9271,
            longitude: 79.8612,
            address: 'Colombo, Sri Lanka',
          } : undefined;
        }

        return {
      ...courier,
          rating: Math.round(rating * 10) / 10, // Round to 1 decimal place
          totalDeliveries,
          totalEarnings: Math.round(totalEarnings * 100) / 100, // Round to 2 decimal places
          isOnline,
          currentLocation,
        };
      })
    );

    return NextResponse.json(couriersWithStats);
  } catch (error) {
    console.error('Error fetching couriers:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

<<<<<<< HEAD
    const body = await _request.json();
    const { name, email, phone, vehicleType, vehicleNumber, status } = body;
=======
    const body = await request.json();
    const { name, code, apiKey, apiSecret, isActive } = body;
>>>>>>> 08d9e1855dc7fd2c99e5d62def516239ff37a9a7

    if (!name || !code) {
      return NextResponse.json({ message: 'Name and code are required' }, { status: 400 });
    }

    const courier = await prisma.courier.create({
      data: {
        name,
<<<<<<< HEAD
        code: `${name.toUpperCase().replace(/\s+/g, '_')}_${Date.now()}`,
        settings: {
        phone,
          vehicleType,
        vehicleNumber,
        status: status || 'ACTIVE',
        },
=======
        code,
        apiKey,
        apiSecret,
        isActive: isActive !== undefined ? isActive : true,
>>>>>>> 08d9e1855dc7fd2c99e5d62def516239ff37a9a7
        organizationId: session.user.organizationId,
      },
    });

    return NextResponse.json(courier, { status: 201 });
  } catch (error) {
    console.error('Error creating courier:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
} 