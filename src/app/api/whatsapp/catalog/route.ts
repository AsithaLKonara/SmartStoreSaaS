import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { whatsAppService } from '@/lib/whatsapp/whatsappService';
import { prisma } from '@/lib/prisma';

export async function POST(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await _request.json();
    const { organizationId } = body;

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

<<<<<<< HEAD
    // TODO: Implement updateCatalog method in WhatsAppService
    // await whatsAppService.updateCatalog(organizationId);
=======
    // Check if catalog exists, create if it doesn't
    const existingCatalog = await prisma.whatsAppCatalog.findUnique({
      where: { organizationId }
    });

    if (!existingCatalog) {
      await whatsAppService.createCatalog('Main Catalog', organizationId);
    }
>>>>>>> 08d9e1855dc7fd2c99e5d62def516239ff37a9a7
    
    return NextResponse.json({ 
      success: true, 
      message: 'WhatsApp catalog updated successfully' 
    });
  } catch (error) {
    console.error('WhatsApp catalog update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    const { prisma } = await import('@/lib/prisma');
    const catalog = await prisma.whatsAppCatalog.findUnique({
      where: { organizationId }
    });

    return NextResponse.json(catalog || { products: [], isActive: false });
  } catch (error) {
    console.error('WhatsApp catalog fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 