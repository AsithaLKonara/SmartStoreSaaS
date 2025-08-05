import { NextRequest, NextResponse } from 'next/server';
import { wooCommerceService } from '@/lib/woocommerce/woocommerceService';
import { realTimeSyncService, SyncEvent } from '@/lib/sync/realTimeSyncService';

export async function POST(
  request: NextRequest,
  { params }: { params: { organizationId: string } }
) {
  try {
    const body = await request.json();
    const { topic, data } = body;

    // Verify webhook signature
    const signature = request.headers.get('x-wc-webhook-signature');
    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
    }

    // Process webhook based on topic
    switch (topic) {
      case 'product.created':
        await processProductCreated(data, params.organizationId);
        break;
      case 'product.updated':
        await processProductUpdated(data, params.organizationId);
        break;
      case 'product.deleted':
        await processProductDeleted(data, params.organizationId);
        break;
      case 'order.created':
        await processOrderCreated(data, params.organizationId);
        break;
      case 'order.updated':
        await processOrderUpdated(data, params.organizationId);
        break;
      default:
        console.log(`Unhandled webhook topic: ${topic}`);
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('WooCommerce webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function processProductCreated(product: any, organizationId: string): Promise<void> {
  const syncEvent: SyncEvent = {
    id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: 'product',
    action: 'create',
    data: {
      name: product.name,
      description: product.description,
      price: parseFloat(product.price),
      stockQuantity: product.stock_quantity || 0,
      isActive: product.status === 'publish',
      wooCommerceId: product.id.toString(),
      organizationId
    },
    source: 'woocommerce',
    timestamp: new Date(),
    organizationId
  };

  await realTimeSyncService.queueEvent(syncEvent);
}

async function processProductUpdated(product: any, organizationId: string): Promise<void> {
  const syncEvent: SyncEvent = {
    id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: 'product',
    action: 'update',
    data: {
      name: product.name,
      description: product.description,
      price: parseFloat(product.price),
      stockQuantity: product.stock_quantity || 0,
      isActive: product.status === 'publish',
      wooCommerceId: product.id.toString(),
      organizationId
    },
    source: 'woocommerce',
    timestamp: new Date(),
    organizationId
  };

  await realTimeSyncService.queueEvent(syncEvent);
}

async function processProductDeleted(product: any, organizationId: string): Promise<void> {
  const syncEvent: SyncEvent = {
    id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: 'product',
    action: 'delete',
    data: {
      wooCommerceId: product.id.toString(),
      organizationId
    },
    source: 'woocommerce',
    timestamp: new Date(),
    organizationId
  };

  await realTimeSyncService.queueEvent(syncEvent);
}

async function processOrderCreated(order: any, organizationId: string): Promise<void> {
  const syncEvent: SyncEvent = {
    id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: 'order',
    action: 'create',
    data: {
      orderNumber: order.number,
      wooCommerceId: order.id.toString(),
      status: mapWooCommerceStatus(order.status),
      totalAmount: parseFloat(order.total),
      organizationId,
      customer: {
        name: `${order.billing.first_name} ${order.billing.last_name}`,
        email: order.billing.email,
        phone: order.billing.phone
      }
    },
    source: 'woocommerce',
    timestamp: new Date(),
    organizationId
  };

  await realTimeSyncService.queueEvent(syncEvent);
}

async function processOrderUpdated(order: any, organizationId: string): Promise<void> {
  const syncEvent: SyncEvent = {
    id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: 'order',
    action: 'update',
    data: {
      orderNumber: order.number,
      wooCommerceId: order.id.toString(),
      status: mapWooCommerceStatus(order.status),
      totalAmount: parseFloat(order.total),
      organizationId
    },
    source: 'woocommerce',
    timestamp: new Date(),
    organizationId
  };

  await realTimeSyncService.queueEvent(syncEvent);
}

function mapWooCommerceStatus(wooStatus: string): string {
  const statusMap: Record<string, string> = {
    'pending': 'pending',
    'processing': 'processing',
    'completed': 'completed',
    'cancelled': 'cancelled',
    'refunded': 'refunded',
    'failed': 'failed'
  };

  return statusMap[wooStatus] || 'pending';
} 