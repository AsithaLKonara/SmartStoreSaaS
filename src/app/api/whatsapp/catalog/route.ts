import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { whatsAppService } from '@/lib/whatsapp/whatsappService';
import { prisma } from '@/lib/prisma';

export async function POST() {
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

    // Check if catalog exists, create if it doesn't
    const existingCatalog = await prisma.whatsAppCatalog.findUnique({
      where: { organizationId }
    });

    if (!existingCatalog) {
      await whatsAppService.createCatalog('Main Catalog', organizationId);
    } else {
      // Update existing catalog with latest products
      await whatsAppService.updateCatalog(organizationId);
    }
    
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