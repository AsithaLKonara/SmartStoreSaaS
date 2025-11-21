import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ShopifyService } from '@/lib/integrations/shopify/shopifyService';

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const integration = await prisma.shopifyIntegration.findFirst({
      where: { organizationId: session.user.organizationId },
    });

    if (!integration) {
      return NextResponse.json({ message: 'Integration not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: integration.id,
      shopDomain: integration.shopDomain,
      isActive: integration.isActive,
      lastSync: integration.lastSync,
      syncProducts: integration.syncProducts,
      syncOrders: integration.syncOrders,
      syncInventory: integration.syncInventory,
    });
  } catch (error) {
    console.error('Error fetching Shopify integration:', error);
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
    const { shopDomain, accessToken, apiKey, apiSecret, webhookSecret } = body;

    if (!shopDomain || !accessToken || !apiKey || !apiSecret) {
      return NextResponse.json(
        { message: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Test connection
    const shopifyService = new ShopifyService(
      'temp',
      shopDomain,
      accessToken
    );
    const isConnected = await shopifyService.testConnection();

    if (!isConnected) {
      return NextResponse.json(
        { message: 'Failed to connect to Shopify store' },
        { status: 400 }
      );
    }

    // Create or update integration
    const integration = await prisma.shopifyIntegration.upsert({
      where: { organizationId: session.user.organizationId },
      create: {
        organizationId: session.user.organizationId,
        shopDomain,
        accessToken,
        apiKey,
        apiSecret,
        webhookSecret: webhookSecret || null,
        isActive: true,
      },
      update: {
        shopDomain,
        accessToken,
        apiKey,
        apiSecret,
        webhookSecret: webhookSecret || null,
        isActive: true,
      },
    });

    // Set up webhooks
    const finalService = new ShopifyService(
      integration.id,
      shopDomain,
      accessToken
    );

    const webhookUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/webhooks/shopify/${session.user.organizationId}`;
    
    try {
      // Create webhooks for key events
      const webhookTopics = [
        'products/create',
        'products/update',
        'orders/create',
        'orders/updated',
        'orders/paid',
        'inventory_levels/update',
      ];

      for (const topic of webhookTopics) {
        await finalService.createWebhook(topic, webhookUrl);
      }
    } catch (webhookError) {
      console.error('Error setting up webhooks:', webhookError);
      // Continue even if webhook setup fails
    }

    return NextResponse.json({
      id: integration.id,
      shopDomain: integration.shopDomain,
      isActive: integration.isActive,
      message: 'Shopify integration configured successfully',
    }, { status: 201 });
  } catch (error) {
    console.error('Error setting up Shopify integration:', error);
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
    const { syncProducts, syncOrders, syncInventory, isActive } = body;

    const integration = await prisma.shopifyIntegration.findFirst({
      where: { organizationId: session.user.organizationId },
    });

    if (!integration) {
      return NextResponse.json({ message: 'Integration not found' }, { status: 404 });
    }

    const updated = await prisma.shopifyIntegration.update({
      where: { id: integration.id },
      data: {
        syncProducts: syncProducts !== undefined ? syncProducts : integration.syncProducts,
        syncOrders: syncOrders !== undefined ? syncOrders : integration.syncOrders,
        syncInventory: syncInventory !== undefined ? syncInventory : integration.syncInventory,
        isActive: isActive !== undefined ? isActive : integration.isActive,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating Shopify integration:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const integration = await prisma.shopifyIntegration.findFirst({
      where: { organizationId: session.user.organizationId },
    });

    if (!integration) {
      return NextResponse.json({ message: 'Integration not found' }, { status: 404 });
    }

    // Delete webhooks
    const shopifyService = new ShopifyService(
      integration.id,
      integration.shopDomain,
      integration.accessToken
    );

    try {
      const webhooks = await shopifyService.listWebhooks();
      for (const webhook of webhooks) {
        await shopifyService.deleteWebhook(webhook.id);
      }
    } catch (webhookError) {
      console.error('Error deleting webhooks:', webhookError);
    }

    await prisma.shopifyIntegration.delete({
      where: { id: integration.id },
    });

    return NextResponse.json({ message: 'Integration deleted successfully' });
  } catch (error) {
    console.error('Error deleting Shopify integration:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

