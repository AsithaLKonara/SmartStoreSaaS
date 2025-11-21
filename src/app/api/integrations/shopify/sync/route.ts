import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ShopifyService } from '@/lib/integrations/shopify/shopifyService';

export async function POST(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await _request.json();
    const { type } = body; // 'products', 'orders', 'inventory', 'all'

    const integration = await prisma.shopifyIntegration.findFirst({
      where: { organizationId: session.user.organizationId },
    });

    if (!integration || !integration.isActive) {
      return NextResponse.json(
        { message: 'Integration not found or inactive' },
        { status: 404 }
      );
    }

    const shopifyService = new ShopifyService(
      integration.id,
      integration.shopDomain,
      integration.accessToken
    );

    let results: any = {};

    if (type === 'products' || type === 'all') {
      if (integration.syncProducts) {
        results.products = await shopifyService.syncProducts();
      }
    }

    if (type === 'orders' || type === 'all') {
      if (integration.syncOrders) {
        results.orders = await shopifyService.syncOrders();
      }
    }

    if (type === 'inventory' || type === 'all') {
      if (integration.syncInventory) {
        results.inventory = await shopifyService.syncInventory();
      }
    }

    // Update last sync time
    await prisma.shopifyIntegration.update({
      where: { id: integration.id },
      data: { lastSync: new Date() },
    });

    return NextResponse.json({
      message: 'Sync completed',
      results,
    });
  } catch (error) {
    console.error('Error syncing Shopify data:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

