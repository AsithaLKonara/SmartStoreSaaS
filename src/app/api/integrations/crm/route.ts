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

    const integrations = await prisma.cRMIntegration.findMany({
      where: { organizationId: session.user.organizationId },
    });

    return NextResponse.json(integrations);
  } catch (error) {
    console.error('Error fetching CRM integrations:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await _request.json();
    const { provider, accessToken, refreshToken, instanceUrl, apiKey } = body;

    if (!provider || !accessToken) {
      return NextResponse.json(
        { message: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (provider === 'salesforce' && !instanceUrl) {
      return NextResponse.json(
        { message: 'Instance URL required for Salesforce' },
        { status: 400 }
      );
    }

    if (provider === 'hubspot' && !apiKey) {
      return NextResponse.json(
        { message: 'API key required for HubSpot' },
        { status: 400 }
      );
    }

    const integration = await prisma.cRMIntegration.create({
      data: {
        organizationId: session.user.organizationId,
        provider,
        accessToken,
        refreshToken: refreshToken || null,
        instanceUrl: instanceUrl || null,
        apiKey: apiKey || null,
        isActive: true,
      },
    });

    return NextResponse.json(integration, { status: 201 });
  } catch (error) {
    console.error('Error setting up CRM integration:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

