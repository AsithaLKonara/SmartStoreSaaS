import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PinterestService } from '@/lib/integrations/pinterest/pinterestService';

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const integration = await prisma.pinterestIntegration.findFirst({
      where: { organizationId: session?.user?.organizationId },
    });

    if (!integration || !integration.isActive) {
      return NextResponse.json(
        { message: 'Integration not found or inactive' },
        { status: 404 }
      );
    }

    const pinterestService = new PinterestService(
      integration.id,
      integration.accessToken
    );

    const results = await pinterestService.syncProducts(session?.user?.organizationId);

    return NextResponse.json({
      message: 'Sync completed',
      results,
    });
  } catch (error) {
    console.error('Error syncing Pinterest data:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

