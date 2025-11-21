import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { MagentoService } from '@/lib/integrations/magento/magentoService';

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const integration = await prisma.magentoIntegration.findFirst({
      where: { organizationId: session.user.organizationId },
    });

    if (!integration) {
      return NextResponse.json({ message: 'Integration not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: integration.id,
      baseUrl: integration.baseUrl,
      isActive: integration.isActive,
      lastSync: integration.lastSync,
    });
  } catch (error) {
    console.error('Error fetching Magento integration:', error);
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
    const { baseUrl, accessToken } = body;

    if (!baseUrl || !accessToken) {
      return NextResponse.json(
        { message: 'Missing required fields: baseUrl and accessToken' },
        { status: 400 }
      );
    }

    // Test connection
    const magentoService = new MagentoService('temp', baseUrl, accessToken);
    const isConnected = await magentoService.testConnection();

    if (!isConnected) {
      return NextResponse.json(
        { message: 'Failed to connect to Magento store' },
        { status: 400 }
      );
    }

    // Create or update integration
    const integration = await prisma.magentoIntegration.upsert({
      where: { organizationId: session.user.organizationId },
      create: {
        organizationId: session.user.organizationId,
        baseUrl,
        accessToken,
        isActive: true,
      },
      update: {
        baseUrl,
        accessToken,
        isActive: true,
      },
    });

    return NextResponse.json({
      id: integration.id,
      baseUrl: integration.baseUrl,
      isActive: integration.isActive,
      message: 'Magento integration configured successfully',
    }, { status: 201 });
  } catch (error) {
    console.error('Error setting up Magento integration:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

