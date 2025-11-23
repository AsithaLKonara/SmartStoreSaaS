import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { whatsAppService } from '@/lib/whatsapp/whatsappService';
import { wooCommerceService } from '@/lib/woocommerce/woocommerceService';
import { sriLankaCourierService } from '@/lib/courier/sriLankaCourierService';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { type, config, organizationId } = body;

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    switch (type) {
      case 'whatsapp':
        return await setupWhatsAppIntegration(config, organizationId);
      
      case 'woocommerce':
        return await setupWooCommerceIntegration(config, organizationId);
      
      case 'courier':
        return await setupCourierIntegration(config, organizationId);
      
      default:
        return NextResponse.json({ error: 'Invalid integration type' }, { status: 400 });
    }
  } catch (error) {
    console.error('Integration setup error:', error);
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

    const integrations = await getIntegrationsStatus(organizationId);
    return NextResponse.json(integrations);
  } catch (error) {
    console.error('Integration status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function setupWhatsAppIntegration(config: any, organizationId: string) {
  try {
    // Validate WhatsApp configuration
    if (!config.phoneNumberId || !config.accessToken) {
      return NextResponse.json({ 
        error: 'Phone Number ID and Access Token are required' 
      }, { status: 400 });
    }

    // Test WhatsApp API connection
    const response = await fetch(`https://graph.facebook.com/v18.0/${config.phoneNumberId}?fields=verified_name`, {
      headers: {
        'Authorization': `Bearer ${config.accessToken}`
      }
    });

    if (!response.ok) {
      return NextResponse.json({ 
        error: 'Invalid WhatsApp credentials' 
      }, { status: 400 });
    }

    // Save or update integration
    const existing = await prisma.whatsAppIntegration.findFirst({
      where: { organizationId },
    });
    
    const integration = existing 
      ? await prisma.whatsAppIntegration.update({
          where: { id: existing.id },
          data: {
            phoneNumberId: config.phoneNumberId,
            accessToken: config.accessToken,
            webhookSecret: config.webhookSecret,
            isActive: true,
            settings: config.settings || {}
          }
        })
      : await prisma.whatsAppIntegration.create({
          data: {
            organizationId,
            phoneNumberId: config.phoneNumberId,
            accessToken: config.accessToken,
            webhookSecret: config.webhookSecret,
            isActive: true,
            settings: config.settings || {}
          }
        });

    // Setup webhooks
    await setupWhatsAppWebhooks(config.phoneNumberId, config.accessToken);

    return NextResponse.json({
      success: true,
      message: 'WhatsApp integration configured successfully',
      integration
    });
  } catch (error) {
    console.error('WhatsApp setup error:', error);
    return NextResponse.json({ 
      error: 'Failed to setup WhatsApp integration' 
    }, { status: 500 });
  }
}

async function setupWooCommerceIntegration(config: any, organizationId: string) {
  try {
    // Validate WooCommerce configuration
    if (!config.siteUrl || !config.consumerKey || !config.consumerSecret) {
      return NextResponse.json({ 
        error: 'Site URL, Consumer Key, and Consumer Secret are required' 
      }, { status: 400 });
    }

    // Test WooCommerce API connection
    const auth = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString('base64');
    const response = await fetch(`${config.siteUrl}/wp-json/wc/v3/products?per_page=1`, {
      headers: {
        'Authorization': `Basic ${auth}`
      }
    });

    if (!response.ok) {
      return NextResponse.json({ 
        error: 'Invalid WooCommerce credentials' 
      }, { status: 400 });
    }

    // Save or update integration
    const integration = await prisma.wooCommerceIntegration.upsert({
      where: { organizationId },
      update: {
        siteUrl: config.siteUrl,
        consumerKey: config.consumerKey,
        consumerSecret: config.consumerSecret,
        apiVersion: config.apiVersion || 'wc/v3',
        isActive: true,
        settings: config.settings || {}
      },
      create: {
        organizationId,
        siteUrl: config.siteUrl,
        consumerKey: config.consumerKey,
        consumerSecret: config.consumerSecret,
        apiVersion: config.apiVersion || 'wc/v3',
        isActive: true,
        settings: config.settings || {}
      }
    });

    // Setup webhooks
    await setupWooCommerceWebhooks(config);

    return NextResponse.json({
      success: true,
      message: 'WooCommerce integration configured successfully',
      integration
    });
  } catch (error) {
    console.error('WooCommerce setup error:', error);
    return NextResponse.json({ 
      error: 'Failed to setup WooCommerce integration' 
    }, { status: 500 });
  }
}

async function setupCourierIntegration(config: any, organizationId: string) {
  try {
    // Validate courier configuration
    if (!config.name || !config.code || !config.apiKey) {
      return NextResponse.json({ 
        error: 'Name, Code, and API Key are required' 
      }, { status: 400 });
    }

    // Save or update courier
    const courier = await prisma.courier.upsert({
      where: { 
        organizationId_code: {
          organizationId,
          code: config.code
        }
      },
      update: {
        name: config.name,
        apiKey: config.apiKey,
        apiSecret: config.apiSecret,
        isActive: true,
        settings: config.settings || {}
      },
      create: {
        organizationId,
        name: config.name,
        code: config.code,
        apiKey: config.apiKey,
        apiSecret: config.apiSecret,
        isActive: true,
        settings: config.settings || {}
      }
    });

    // Test courier connection
    const isHealthy = await sriLankaCourierService.testCourierConnection(config.code);

    return NextResponse.json({
      success: true,
      message: 'Courier integration configured successfully',
      courier,
      connectionTest: isHealthy ? 'success' : 'failed'
    });
  } catch (error) {
    console.error('Courier setup error:', error);
    return NextResponse.json({ 
      error: 'Failed to setup courier integration' 
    }, { status: 500 });
  }
}

async function getIntegrationsStatus(organizationId: string) {
  const [whatsapp, woocommerce, couriers] = await Promise.all([
    prisma.whatsAppIntegration.findFirst({
      where: { organizationId, isActive: true }
    }),
    prisma.wooCommerceIntegration.findFirst({
      where: { organizationId, isActive: true }
    }),
    prisma.courier.findMany({
      where: { organizationId, isActive: true }
    })
  ]);

  return {
    whatsapp: {
      configured: !!whatsapp,
      status: whatsapp ? 'active' : 'not_configured'
    },
    woocommerce: {
      configured: !!woocommerce,
      status: woocommerce ? 'active' : 'not_configured'
    },
    couriers: {
      configured: couriers.length > 0,
      count: couriers.length,
      active: couriers.filter(c => c.isActive).length
    }
  };
}

async function setupWhatsAppWebhooks(phoneNumberId: string, accessToken: string) {
  try {
    const webhookUrl = `${process.env.NEXTAUTH_URL}/api/webhooks/whatsapp`;
    
    const webhookData = {
      object: 'whatsapp_business_account',
      callback_url: webhookUrl,
      fields: ['messages', 'message_status']
    };

    const response = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/subscriptions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(webhookData)
    });

    if (!response.ok) {
      console.error('Failed to setup WhatsApp webhooks');
    }
  } catch (error) {
    console.error('WhatsApp webhook setup error:', error);
  }
}

async function setupWooCommerceWebhooks(config: any) {
  try {
    const auth = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString('base64');
    const webhookUrl = `${process.env.NEXTAUTH_URL}/api/webhooks/woocommerce/${config.organizationId}`;

    const webhooks = [
      { topic: 'product.created', delivery_url: webhookUrl },
      { topic: 'product.updated', delivery_url: webhookUrl },
      { topic: 'product.deleted', delivery_url: webhookUrl },
      { topic: 'order.created', delivery_url: webhookUrl },
      { topic: 'order.updated', delivery_url: webhookUrl }
    ];

    for (const webhook of webhooks) {
      try {
        await fetch(`${config.siteUrl}/wp-json/wc/v3/webhooks`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(webhook)
        });
      } catch (error) {
        console.error(`Failed to setup WooCommerce webhook ${webhook.topic}:`, error);
      }
    }
  } catch (error) {
    console.error('WooCommerce webhook setup error:', error);
  }
} 