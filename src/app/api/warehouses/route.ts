import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const warehouses = await prisma.warehouse.findMany({
      where: { organizationId: session.user.organizationId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(warehouses);
  } catch (error) {
    console.error('Error fetching warehouses:', error);
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
    const { name, address, settings } = body;

    if (!name || !address) {
      return NextResponse.json({ message: 'Name and address are required' }, { status: 400 });
    }

    const warehouse = await prisma.warehouse.create({
      data: {
        name,
        address,
        settings: settings || {},
        organizationId: session.user.organizationId,
      },
    });

    return NextResponse.json(warehouse, { status: 201 });
  } catch (error) {
    console.error('Error creating warehouse:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
} 