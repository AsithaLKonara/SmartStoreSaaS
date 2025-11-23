import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { MagentoService } from '@/lib/integrations/magento/magentoService';

export async function POST(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await _request.json();
    const { type } = body; // 'products', 'orders', 'all'

    const integration = await prisma.magentoIntegration.findFirst({
      where: { organizationId: session.user.organizationId },
    });

    if (!integration || !integration.isActive) {
      return NextResponse.json(
        { message: 'Integration not found or inactive' },
        { status: 404 }
      );
    }

    const magentoService = new MagentoService(
      integration.id,
      integration.baseUrl,
      integration.accessToken
    );

    const results: any = {};

    if (type === 'products' || type === 'all') {
      results.products = await magentoService.syncProducts();
    }

    if (type === 'orders' || type === 'all') {
      results.orders = await magentoService.syncOrders();
    }

    await prisma.magentoIntegration.update({
      where: { id: integration.id },
      data: { lastSync: new Date() },
    });

    return NextResponse.json({
      message: 'Sync completed',
      results,
    });
  } catch (error) {
    console.error('Error syncing Magento data:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

