import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma, validateOrganizationId } from '@/lib/prisma';
import { handleApiError, validateSession } from '@/lib/api-error-handler';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const sessionValidation = validateSession(session);
    if (!sessionValidation.valid) {
      return NextResponse.json({ message: sessionValidation.error || 'Unauthorized' }, { status: 401 });
    }

    const organizationId = validateOrganizationId(session?.user?.organizationId);

    const warehouses = await prisma.warehouse.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(warehouses);
  } catch (error) {
    const session = await getServerSession(authOptions).catch(() => null);
    return handleApiError(error, request, session);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const sessionValidation = validateSession(session);
    if (!sessionValidation.valid) {
      return NextResponse.json({ message: sessionValidation.error || 'Unauthorized' }, { status: 401 });
    }

    const organizationId = validateOrganizationId(session?.user?.organizationId);

    const body = await request.json();
    const { name, address, settings } = body;

    if (!name || !address) {
      return NextResponse.json({ message: 'Name and address are required' }, { status: 400 });
    }

    const warehouse = await prisma.warehouse.create({
      data: {
        name,
        address,
        settings: settings || {},
        organizationId,
      },
    });

    return NextResponse.json(warehouse, { status: 201 });
  } catch (error) {
    const session = await getServerSession(authOptions).catch(() => null);
    return handleApiError(error, request, session);
  }
} 