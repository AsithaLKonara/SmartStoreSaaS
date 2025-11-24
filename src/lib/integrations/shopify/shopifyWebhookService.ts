import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { ShopifyService } from './shopifyService';

export interface ShopifyWebhook {
  id: number;
  topic: string;
  address: string;
  format: string;
  created_at: string;
  updated_at: string;
}

export class ShopifyWebhookService {
  static verifyWebhook(
    body: string,
    signature: string,
    webhookSecret: string
  ): boolean {
    const hmac = crypto
      .createHmac('sha256', webhookSecret)
      .update(body, 'utf8')
      .digest('base64');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(hmac)
    );
  }

  static async handleWebhook(
    organizationId: string,
    topic: string,
    data: Record<string, unknown>,
    shopifyService: ShopifyService
  ): Promise<void> {
    const integration = await prisma.shopifyIntegration.findFirst({
      where: { organizationId },
    });

    if (!integration || !integration.isActive) {
      throw new Error('Shopify integration not found or inactive');
    }

    switch (topic) {
      case 'products/create':
      case 'products/update':
        await this.handleProductWebhook(data, integration.id);
        break;

      case 'orders/create':
      case 'orders/updated':
      case 'orders/paid':
      case 'orders/cancelled':
        await this.handleOrderWebhook(data, integration.id, shopifyService);
        break;

      case 'inventory_levels/update':
        await this.handleInventoryWebhook(data, integration.id);
        break;

      default:
        console.log(`Unhandled webhook topic: ${topic}`);
    }
  }

  private static async handleProductWebhook(
    productData: Record<string, unknown>,
    integrationId: string
  ): Promise<void> {
    const integration = await prisma.shopifyIntegration.findUnique({
      where: { id: integrationId },
    });

    if (!integration?.syncProducts) {
      return;
    }

    const shopifyService = new ShopifyService(
      integrationId,
      integration.shopDomain,
      integration.accessToken
    );

    await shopifyService.syncProduct(productData);
  }

  private static async handleOrderWebhook(
    orderData: Record<string, unknown>,
    integrationId: string,
    shopifyService: ShopifyService
  ): Promise<void> {
    const integration = await prisma.shopifyIntegration.findUnique({
      where: { id: integrationId },
    });

    if (!integration?.syncOrders) {
      return;
    }

    await shopifyService.syncOrder(orderData);
  }

  private static async handleInventoryWebhook(
    inventoryData: Record<string, unknown> & { variant_id?: string | number },
    integrationId: string
  ): Promise<void> {
    const integration = await prisma.shopifyIntegration.findUnique({
      where: { id: integrationId },
    });

    if (!integration?.syncInventory) {
      return;
    }

    // Update product inventory based on inventory level changes
    // Check via dimensions metadata
    const allProducts = await prisma.product.findMany({});
    const product = allProducts.find(p => {
      const dimensions = (p.dimensions as ProductDimensions) || {};
      return dimensions.shopifyVariantId === String(inventoryData.variant_id);
    });

    if (product) {
      await prisma.product.update({
        where: { id: product.id },
        data: {
          stockQuantity: inventoryData.available || 0,
        },
      });
    }
  }
}

