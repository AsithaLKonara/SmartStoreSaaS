import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { TikTokShopService } from '@/lib/integrations/tiktok/tiktokShopService';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const integration = await prisma.tikTokIntegration.findFirst({
      where: { organizationId: session.user.organizationId },
    });

    if (!integration) {
      return NextResponse.json({ message: 'Integration not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: integration.id,
      shopId: integration.shopId,
      isActive: integration.isActive,
      lastSync: integration.lastSync,
    });
  } catch (error) {
    console.error('Error fetching TikTok integration:', error);
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
    const { shopId, accessToken } = body;

    if (!shopId || !accessToken) {
      return NextResponse.json(
        { message: 'Missing required fields: shopId and accessToken' },
        { status: 400 }
      );
    }

    // Test connection
    const tiktokService = new TikTokShopService('temp', shopId, accessToken);
    const isConnected = await tiktokService.testConnection();

    if (!isConnected) {
      return NextResponse.json(
        { message: 'Failed to connect to TikTok Shop' },
        { status: 400 }
      );
    }

    // Create or update integration
    const integration = await prisma.tikTokIntegration.upsert({
      where: { organizationId: session.user.organizationId },
      create: {
        organizationId: session.user.organizationId,
        shopId,
        accessToken,
        isActive: true,
      },
      update: {
        shopId,
        accessToken,
        isActive: true,
      },
    });

    return NextResponse.json({
      id: integration.id,
      shopId: integration.shopId,
      isActive: integration.isActive,
      message: 'TikTok integration configured successfully',
    }, { status: 201 });
  } catch (error) {
    console.error('Error setting up TikTok integration:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

