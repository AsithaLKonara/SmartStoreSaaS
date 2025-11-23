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

    const integrations = await prisma.accountingIntegration.findMany({
      where: { organizationId: session.user.organizationId },
    });

    return NextResponse.json(integrations);
  } catch (error) {
    console.error('Error fetching accounting integrations:', error);
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
    const { provider, accessToken, refreshToken, companyId } = body;

    if (!provider || !accessToken || !refreshToken) {
      return NextResponse.json(
        { message: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (provider === 'quickbooks' && !companyId) {
      return NextResponse.json(
        { message: 'Company ID required for QuickBooks' },
        { status: 400 }
      );
    }

    const integration = await prisma.accountingIntegration.create({
      data: {
        organizationId: session.user.organizationId,
        provider,
        accessToken,
        refreshToken,
        companyId: companyId || null,
        isActive: true,
      },
    });

    return NextResponse.json(integration, { status: 201 });
  } catch (error) {
    console.error('Error setting up accounting integration:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

