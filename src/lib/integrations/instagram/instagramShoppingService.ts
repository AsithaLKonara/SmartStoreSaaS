import { prisma } from '@/lib/prisma';
import axios, { AxiosInstance } from 'axios';

export interface InstagramProduct {
  id: string;
  name: string;
  description: string;
  price: string;
  currency: string;
  image_url: string;
  availability: 'in stock' | 'out of stock';
  inventory: number;
}

export class InstagramShoppingService {
  private client: AxiosInstance;
  private integrationId: string;
  private businessAccountId: string;
  private accessToken: string;
  private catalogId: string | null;

  constructor(
    integrationId: string,
    businessAccountId: string,
    accessToken: string,
    catalogId?: string
  ) {
    this.integrationId = integrationId;
    this.businessAccountId = businessAccountId;
    this.accessToken = accessToken;
    this.catalogId = catalogId || null;

    this.client = axios.create({
      baseURL: 'https://graph.facebook.com/v18.0',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.get(`/${this.businessAccountId}`);
      return response.status === 200;
    } catch (error) {
      console.error('Instagram connection test failed:', error);
      return false;
    }
  }

  async createCatalog(name: string): Promise<string> {
    try {
      const response = await this.client.post(`/${this.businessAccountId}/owned_product_catalogs`, {
        name,
        vertical: 'commerce',
      });
      return response.data.id;
    } catch (error) {
      console.error('Error creating Instagram catalog:', error);
      throw error;
    }
  }

  async getOrCreateCatalog(): Promise<string> {
    if (this.catalogId) {
      return this.catalogId;
    }

    const integration = await prisma.instagramIntegration.findUnique({
      where: { id: this.integrationId },
    });

    if (integration?.catalogId) {
      this.catalogId = integration.catalogId;
      return this.catalogId;
    }

    const catalogName = `Instagram Catalog ${new Date().toISOString()}`;
    const newCatalogId = await this.createCatalog(catalogName);

    await prisma.instagramIntegration.update({
      where: { id: this.integrationId },
      data: { catalogId: newCatalogId },
    });

    this.catalogId = newCatalogId;
    return newCatalogId;
  }

  async syncProducts(): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    try {
      const catalogId = await this.getOrCreateCatalog();
      const integration = await prisma.instagramIntegration.findUnique({
        where: { id: this.integrationId },
      });

      if (!integration) {
        throw new Error('Integration not found');
      }

      const products = await prisma.product.findMany({
        where: {
          organizationId: integration.organizationId,
          isActive: true,
        },
        take: 1000,
      });

      const batch = products.map(product => this.productToInstagramProduct(product));
      
      const batchSize = 100;
      for (let i = 0; i < batch.length; i += batchSize) {
        const batchChunk = batch.slice(i, i + batchSize);
        
        try {
          await this.uploadProductsBatch(catalogId, batchChunk);
          success += batchChunk.length;
        } catch (error) {
          console.error(`Error uploading batch ${i / batchSize + 1}:`, error);
          failed += batchChunk.length;
        }
      }

      await prisma.instagramIntegration.update({
        where: { id: this.integrationId },
        data: { lastSync: new Date() },
      });

      return { success, failed };
    } catch (error) {
      console.error('Error syncing products to Instagram:', error);
      throw error;
    }
  }

  private productToInstagramProduct(product: any): InstagramProduct {
    return {
      id: product.sku || product.id,
      name: product.name,
      description: product.description?.replace(/<[^>]*>/g, '') || '',
      price: `${product.price.toFixed(2)} ${product.currency || 'USD'}`,
      currency: product.currency || 'USD',
      image_url: product.images?.[0] || '',
      availability: product.stockQuantity > 0 ? 'in stock' : 'out of stock',
      inventory: product.stockQuantity,
    };
  }

  private async uploadProductsBatch(catalogId: string, items: InstagramProduct[]): Promise<void> {
    const response = await this.client.post(`/${catalogId}/batch`, {
      requests: items.map(item => ({
        method: 'UPDATE',
        data: item,
      })),
    });

    if (response.data.errors && response.data.errors.length > 0) {
      throw new Error(`Instagram API errors: ${JSON.stringify(response.data.errors)}`);
    }
  }

  async tagProductInPost(mediaId: string, productId: string): Promise<void> {
    try {
      await this.client.post(`/${mediaId}/product_tags`, {
        product_id: productId,
      });
    } catch (error) {
      console.error('Error tagging product in Instagram post:', error);
      throw error;
    }
  }

  async createCheckoutSession(productIds: string[], customerInfo: any): Promise<string> {
    try {
      const response = await this.client.post(`/${this.businessAccountId}/checkout_sessions`, {
        product_ids: productIds,
        customer: customerInfo,
      });
      return response.data.session_id;
    } catch (error) {
      console.error('Error creating Instagram checkout session:', error);
      throw error;
    }
  }
}

