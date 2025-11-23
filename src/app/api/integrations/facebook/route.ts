import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { FacebookCommerceService } from '@/lib/integrations/facebook/facebookCommerceService';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const integration = await prisma.facebookIntegration.findFirst({
      where: { organizationId: session.user.organizationId },
    });

    if (!integration) {
      return NextResponse.json({ message: 'Integration not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: integration.id,
      pageId: integration.pageId,
      catalogId: integration.catalogId,
      isActive: integration.isActive,
      lastSync: integration.lastSync,
    });
  } catch (error) {
    console.error('Error fetching Facebook integration:', error);
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
    const { pageId, accessToken } = body;

    if (!pageId || !accessToken) {
      return NextResponse.json(
        { message: 'Missing required fields: pageId and accessToken' },
        { status: 400 }
      );
    }

    // Test connection
    const facebookService = new FacebookCommerceService(
      'temp',
      pageId,
      accessToken
    );
    const isConnected = await facebookService.testConnection();

    if (!isConnected) {
      return NextResponse.json(
        { message: 'Failed to connect to Facebook page' },
        { status: 400 }
      );
    }

    // Create or update integration
    const integration = await prisma.facebookIntegration.upsert({
      where: { organizationId: session.user.organizationId },
      create: {
        organizationId: session.user.organizationId,
        pageId,
        accessToken,
        isActive: true,
      },
      update: {
        pageId,
        accessToken,
        isActive: true,
      },
    });

    // Create catalog if needed
    const finalService = new FacebookCommerceService(
      integration.id,
      pageId,
      accessToken
    );

    try {
      const catalogId = await finalService.getOrCreateCatalog();
      await prisma.facebookIntegration.update({
        where: { id: integration.id },
        data: { catalogId },
      });
    } catch (catalogError) {
      console.error('Error creating catalog:', catalogError);
      // Continue even if catalog creation fails
    }

    return NextResponse.json({
      id: integration.id,
      pageId: integration.pageId,
      catalogId: integration.catalogId,
      isActive: integration.isActive,
      message: 'Facebook integration configured successfully',
    }, { status: 201 });
  } catch (error) {
    console.error('Error setting up Facebook integration:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await _request.json();
    const { isActive } = body;

    const integration = await prisma.facebookIntegration.findFirst({
      where: { organizationId: session.user.organizationId },
    });

    if (!integration) {
      return NextResponse.json({ message: 'Integration not found' }, { status: 404 });
    }

    const updated = await prisma.facebookIntegration.update({
      where: { id: integration.id },
      data: {
        isActive: isActive !== undefined ? isActive : integration.isActive,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating Facebook integration:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const integration = await prisma.facebookIntegration.findFirst({
      where: { organizationId: session.user.organizationId },
    });

    if (!integration) {
      return NextResponse.json({ message: 'Integration not found' }, { status: 404 });
    }

    await prisma.facebookIntegration.delete({
      where: { id: integration.id },
    });

    return NextResponse.json({ message: 'Integration deleted successfully' });
  } catch (error) {
    console.error('Error deleting Facebook integration:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

