import { prisma } from '../prisma';
import { realTimeSyncService, SyncEvent } from '../sync/realTimeSyncService';
import { EventEmitter } from 'events';

export interface WooCommerceConfig {
  siteUrl: string;
  consumerKey: string;
  consumerSecret: string;
  version: string;
  organizationId: string;
}

export interface WooCommerceProduct {
  id: number;
  name: string;
  slug: string;
  description: string;
  price: string;
  stock_quantity: number;
  stock_status: 'instock' | 'outofstock';
  status: 'publish' | 'draft';
  images: { src: string; alt: string }[];
}

export class WooCommerceService extends EventEmitter {
  private configs: Map<string, WooCommerceConfig> = new Map();

  constructor() {
    super();
    this.loadConfigs();
  }

  private async loadConfigs(): Promise<void> {
    try {
      const integrations = await prisma.wooCommerceIntegration.findMany({
        where: { isActive: true }
      });

      integrations.forEach(integration => {
        this.configs.set(integration.organizationId, {
          siteUrl: integration.siteUrl,
          consumerKey: integration.consumerKey,
          consumerSecret: integration.consumerSecret,
          version: integration.apiVersion || 'wc/v3',
          organizationId: integration.organizationId
        });
      });
    } catch (error) {
      console.error('Error loading WooCommerce configs:', error);
    }
  }

  private getAuthHeaders(config: WooCommerceConfig): HeadersInit {
    const auth = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString('base64');
    return {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json'
    };
  }

  private async makeRequest(config: WooCommerceConfig, endpoint: string, method: string = 'GET', data?: any): Promise<any> {
    const url = `${config.siteUrl}/wp-json/wc/${config.version}/${endpoint}`;
    
    const options: RequestInit = {
      method,
      headers: this.getAuthHeaders(config),
    };

    if (data && method !== 'GET') {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);
    
    if (!response.ok) {
      throw new Error(`WooCommerce API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  async syncProductsToWooCommerce(organizationId: string): Promise<void> {
    const config = this.configs.get(organizationId);
    if (!config) {
      throw new Error('WooCommerce integration not configured');
    }

    try {
      const products = await prisma.product.findMany({
        where: { 
          organizationId,
          isActive: true
        },
        include: { category: true }
      });

      for (const product of products) {
        await this.syncProductToWooCommerce(product, config);
      }

      this.emit('products_synced', { organizationId, count: products.length });

    } catch (error) {
      console.error('Error syncing products to WooCommerce:', error);
      throw error;
    }
  }

  private async syncProductToWooCommerce(product: any, config: WooCommerceConfig): Promise<void> {
    const wooProduct = {
      name: product.name,
      slug: product.slug || product.name.toLowerCase().replace(/\s+/g, '-'),
      description: product.description || '',
      price: product.price.toString(),
      stock_quantity: product.stockQuantity,
      stock_status: product.stockQuantity > 0 ? 'instock' : 'outofstock',
      status: product.isActive ? 'publish' : 'draft',
      images: product.images?.map((img: string) => ({
        src: img,
        alt: product.name
      })) || []
    };

    try {
      if (product.wooCommerceId) {
        await this.makeRequest(config, `products/${product.wooCommerceId}`, 'PUT', wooProduct);
      } else {
        const response = await this.makeRequest(config, 'products', 'POST', wooProduct);
        
        // Store WooCommerce ID in ProductActivity metadata and update syncedAt
        await prisma.productActivity.create({
          data: {
            type: 'STATUS_CHANGED',
            quantity: 0,
            description: `Product synced to WooCommerce with ID: ${response.id}`,
            metadata: { wooCommerceId: response.id.toString() },
            productId: product.id
          }
        });

        await prisma.product.update({
          where: { id: product.id },
          data: { syncedAt: new Date() }
        });
      }

      await this.syncProductEvent(product, 'update', config.organizationId);

    } catch (error) {
      console.error(`Error syncing product ${product.id} to WooCommerce:`, error);
    }
  }

  async addIntegration(config: WooCommerceConfig): Promise<void> {
    await prisma.wooCommerceIntegration.create({
      data: {
        organizationId: config.organizationId,
        siteUrl: config.siteUrl,
        consumerKey: config.consumerKey,
        consumerSecret: config.consumerSecret,
        apiVersion: config.version,
        isActive: true
      }
    });

    this.configs.set(config.organizationId, config);
    this.emit('integration_added', config);
  }

  private async syncProductEvent(product: any, action: string, organizationId: string): Promise<void> {
    const syncEvent: SyncEvent = {
      id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'product',
      action: action as any,
      entityId: product.id,
      data: product,
      source: 'woocommerce',
      timestamp: new Date(),
      organizationId
    };

    await realTimeSyncService.queueEvent(syncEvent);
  }
}

export const wooCommerceService = new WooCommerceService(); 