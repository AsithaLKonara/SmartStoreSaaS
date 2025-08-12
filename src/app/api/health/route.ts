import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { realTimeSyncService } from '@/lib/sync/realTimeSyncService';
import { whatsAppService } from '@/lib/whatsapp/whatsappService';
import { wooCommerceService } from '@/lib/woocommerce/woocommerceService';
import { sriLankaCourierService } from '@/lib/courier/sriLankaCourierService';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const detailed = searchParams.get('detailed') === 'true';

    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      services: {
        database: 'healthy',
        redis: 'healthy',
        websocket: 'healthy',
        integrations: {}
      }
    };

    // Check database connection
    try {
      await prisma.$connect();
      health.services.database = 'healthy';
    } catch (error) {
      health.services.database = 'unhealthy';
      health.status = 'degraded';
    }

    // Check Redis connection
    try {
      const redis = realTimeSyncService['redis'];
      if (redis) {
        await redis.ping();
        health.services.redis = 'healthy';
      } else {
        health.services.redis = 'unhealthy';
        health.status = 'degraded';
      }
    } catch (error) {
      health.services.redis = 'unhealthy';
      health.status = 'degraded';
    }

    // Check WebSocket server
    try {
      const wss = realTimeSyncService['wss'];
      if (wss && wss.clients) {
        health.services.websocket = 'healthy';
      } else {
        health.services.websocket = 'unhealthy';
        health.status = 'degraded';
      }
    } catch (error) {
      health.services.websocket = 'unhealthy';
      health.status = 'degraded';
    }

    // Check integrations if organizationId is provided
    if (organizationId && detailed) {
      health.services.integrations = {
        whatsapp: await checkWhatsAppHealth(organizationId),
        woocommerce: await checkWooCommerceHealth(organizationId),
        couriers: await checkCourierHealth(organizationId)
      };
    }

    const statusCode = health.status === 'healthy' ? 200 : 503;
    
    return NextResponse.json(health, { status: statusCode });
  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    }, { status: 503 });
  }
}

async function checkWhatsAppHealth(organizationId: string): Promise<string> {
  try {
    const integration = await prisma.whatsAppIntegration.findFirst({
      where: { organizationId, isActive: true }
    });

    if (!integration) {
      return 'not_configured';
    }

    // Test WhatsApp API connection
    const response = await fetch(`https://graph.facebook.com/v18.0/${integration.phoneNumberId}?fields=verified_name`, {
      headers: {
        'Authorization': `Bearer ${integration.accessToken}`
      }
    });

    return response.ok ? 'healthy' : 'unhealthy';
  } catch (error) {
    return 'unhealthy';
  }
}

async function checkWooCommerceHealth(organizationId: string): Promise<string> {
  try {
    const integration = await prisma.wooCommerceIntegration.findFirst({
      where: { organizationId, isActive: true }
    });

    if (!integration) {
      return 'not_configured';
    }

    // Test WooCommerce API connection
    const auth = Buffer.from(`${integration.consumerKey}:${integration.consumerSecret}`).toString('base64');
    const response = await fetch(`${integration.siteUrl}/wp-json/wc/${integration.apiVersion}/products?per_page=1`, {
      headers: {
        'Authorization': `Basic ${auth}`
      }
    });

    return response.ok ? 'healthy' : 'unhealthy';
  } catch (error) {
    return 'unhealthy';
  }
}

async function checkCourierHealth(organizationId: string): Promise<Record<string, string>> {
  try {
    const couriers = await prisma.courier.findMany({
      where: { organizationId, isActive: true }
    });

    const health: Record<string, string> = {};
    
    for (const courier of couriers) {
      try {
        const isHealthy = await sriLankaCourierService.testCourierConnection(courier.code);
        health[courier.code] = isHealthy ? 'healthy' : 'unhealthy';
      } catch (error) {
        health[courier.code] = 'unhealthy';
      }
    }

    return health;
  } catch (error) {
    return { error: 'unhealthy' };
  }
} 