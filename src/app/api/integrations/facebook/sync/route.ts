import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { FacebookCommerceService } from '@/lib/integrations/facebook/facebookCommerceService';

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const integration = await prisma.facebookIntegration.findFirst({
      where: { organizationId: session.user.organizationId },
    });

    if (!integration || !integration.isActive) {
      return NextResponse.json(
        { message: 'Integration not found or inactive' },
        { status: 404 }
      );
    }

    const facebookService = new FacebookCommerceService(
      integration.id,
      integration.pageId,
      integration.accessToken,
      integration.catalogId || undefined
    );

    const results = await facebookService.syncProducts();

    return NextResponse.json({
      message: 'Sync completed',
      results,
    });
  } catch (error) {
    console.error('Error syncing Facebook data:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

