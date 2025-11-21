import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { InstagramShoppingService } from '@/lib/integrations/instagram/instagramShoppingService';

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const integration = await prisma.instagramIntegration.findFirst({
      where: { organizationId: session.user.organizationId },
    });

    if (!integration) {
      return NextResponse.json({ message: 'Integration not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: integration.id,
      businessAccountId: integration.businessAccountId,
      catalogId: integration.catalogId,
      isActive: integration.isActive,
      lastSync: integration.lastSync,
    });
  } catch (error) {
    console.error('Error fetching Instagram integration:', error);
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
    const { businessAccountId, accessToken } = body;

    if (!businessAccountId || !accessToken) {
      return NextResponse.json(
        { message: 'Missing required fields: businessAccountId and accessToken' },
        { status: 400 }
      );
    }

    // Test connection
    const instagramService = new InstagramShoppingService(
      'temp',
      businessAccountId,
      accessToken
    );
    const isConnected = await instagramService.testConnection();

    if (!isConnected) {
      return NextResponse.json(
        { message: 'Failed to connect to Instagram Business Account' },
        { status: 400 }
      );
    }

    // Create or update integration
    const integration = await prisma.instagramIntegration.upsert({
      where: { organizationId: session.user.organizationId },
      create: {
        organizationId: session.user.organizationId,
        businessAccountId,
        accessToken,
        isActive: true,
      },
      update: {
        businessAccountId,
        accessToken,
        isActive: true,
      },
    });

    // Create catalog if needed
    const finalService = new InstagramShoppingService(
      integration.id,
      businessAccountId,
      accessToken
    );

    try {
      const catalogId = await finalService.getOrCreateCatalog();
      await prisma.instagramIntegration.update({
        where: { id: integration.id },
        data: { catalogId },
      });
    } catch (catalogError) {
      console.error('Error creating catalog:', catalogError);
    }

    return NextResponse.json({
      id: integration.id,
      businessAccountId: integration.businessAccountId,
      catalogId: integration.catalogId,
      isActive: integration.isActive,
      message: 'Instagram integration configured successfully',
    }, { status: 201 });
  } catch (error) {
    console.error('Error setting up Instagram integration:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await _request.json();
    const { isActive } = body;

    const integration = await prisma.instagramIntegration.findFirst({
      where: { organizationId: session.user.organizationId },
    });

    if (!integration) {
      return NextResponse.json({ message: 'Integration not found' }, { status: 404 });
    }

    const updated = await prisma.instagramIntegration.update({
      where: { id: integration.id },
      data: {
        isActive: isActive !== undefined ? isActive : integration.isActive,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating Instagram integration:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const integration = await prisma.instagramIntegration.findFirst({
      where: { organizationId: session.user.organizationId },
    });

    if (!integration) {
      return NextResponse.json({ message: 'Integration not found' }, { status: 404 });
    }

    await prisma.instagramIntegration.delete({
      where: { id: integration.id },
    });

    return NextResponse.json({ message: 'Integration deleted successfully' });
  } catch (error) {
    console.error('Error deleting Instagram integration:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

