import { prisma } from '@/lib/prisma';
import axios, { AxiosInstance } from 'axios';

export interface FacebookCatalogItem {
  id?: string;
  retailer_id: string;
  name: string;
  description?: string;
  image_url: string;
  category: string;
  availability: 'in stock' | 'out of stock' | 'preorder' | 'available for order';
  condition: 'new' | 'refurbished' | 'used';
  price: string;
  currency: string;
  url: string;
  brand?: string;
  inventory?: number;
  additional_image_urls?: string[];
}

export interface FacebookOrder {
  id: string;
  order_id: string;
  buyer: {
    name: string;
    email: string;
    phone?: string;
  };
  items: Array<{
    retailer_id: string;
    quantity: number;
    price: string;
  }>;
  total: string;
  currency: string;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  created_time: string;
}

export class FacebookCommerceService {
  private client: AxiosInstance;
  private integrationId: string;
  private pageId: string;
  private accessToken: string;
  private catalogId: string | null;

  constructor(integrationId: string, pageId: string, accessToken: string, catalogId?: string) {
    this.integrationId = integrationId;
    this.pageId = pageId;
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
      const response = await this.client.get(`/${this.pageId}`);
      return response.status === 200;
    } catch (error) {
      console.error('Facebook connection test failed:', error);
      return false;
    }
  }

  async createCatalog(name: string): Promise<string> {
    try {
      const response = await this.client.post(`/${this.pageId}/owned_product_catalogs`, {
        name,
        vertical: 'commerce',
      });
      return response.data.id;
    } catch (error) {
      console.error('Error creating Facebook catalog:', error);
      throw error;
    }
  }

  async getOrCreateCatalog(): Promise<string> {
    if (this.catalogId) {
      return this.catalogId;
    }

    const integration = await prisma.facebookIntegration.findUnique({
      where: { id: this.integrationId },
    });

    if (integration?.catalogId) {
      this.catalogId = integration.catalogId;
      return this.catalogId;
    }

    // Create new catalog
    const catalogName = `SmartStore Catalog ${new Date().toISOString()}`;
    const newCatalogId = await this.createCatalog(catalogName);

    // Update integration
    await prisma.facebookIntegration.update({
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

      // Get products from database
      const integration = await prisma.facebookIntegration.findUnique({
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
        take: 1000, // Facebook API limit
      });

      // Batch upload products to Facebook
      const batch = products.map(product => this.productToFacebookCatalogItem(product));
      
      // Facebook Catalog API uses batch requests
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

      // Update last sync
      await prisma.facebookIntegration.update({
        where: { id: this.integrationId },
        data: { lastSync: new Date() },
      });

      return { success, failed };
    } catch (error) {
      console.error('Error syncing products to Facebook:', error);
      throw error;
    }
  }

  private productToFacebookCatalogItem(product: any): FacebookCatalogItem {
    return {
      retailer_id: product.sku || product.id,
      name: product.name,
      description: product.description?.replace(/<[^>]*>/g, '') || '',
      image_url: product.images?.[0] || '',
      category: 'Apparel & Accessories',
      availability: product.stockQuantity > 0 ? 'in stock' : 'out of stock',
      condition: 'new',
      price: `${product.price.toFixed(2)} ${product.currency || 'USD'}`,
      currency: product.currency || 'USD',
      url: `${process.env.NEXTAUTH_URL || 'https://smartstore.ai'}/products/${product.slug}`,
      brand: 'SmartStore',
      inventory: product.stockQuantity,
      additional_image_urls: product.images?.slice(1) || [],
    };
  }

  private async uploadProductsBatch(catalogId: string, items: FacebookCatalogItem[]): Promise<void> {
    // Facebook Catalog API batch upload
    const response = await this.client.post(`/${catalogId}/batch`, {
      requests: items.map(item => ({
        method: 'UPDATE',
        data: item,
      })),
    });

    // Check for errors
    if (response.data.errors && response.data.errors.length > 0) {
      throw new Error(`Facebook API errors: ${JSON.stringify(response.data.errors)}`);
    }
  }

  async updateInventory(productId: string, quantity: number): Promise<void> {
    try {
      const catalogId = await this.getOrCreateCatalog();
      const product = await prisma.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        throw new Error('Product not found');
      }

      const catalogItem = this.productToFacebookCatalogItem(product);
      catalogItem.inventory = quantity;
      catalogItem.availability = quantity > 0 ? 'in stock' : 'out of stock';

      await this.client.post(`/${catalogId}/batch`, {
        requests: [{
          method: 'UPDATE',
          data: catalogItem,
        }],
      });
    } catch (error) {
      console.error('Error updating Facebook inventory:', error);
      throw error;
    }
  }

  async getOrders(): Promise<FacebookOrder[]> {
    try {
      // Facebook Commerce API doesn't have a direct orders endpoint
      // Orders are typically managed through Facebook Shop interface
      // This would need to be implemented based on Facebook's Commerce API
      return [];
    } catch (error) {
      console.error('Error fetching Facebook orders:', error);
      throw error;
    }
  }

  async createMessengerConversation(userId: string, message: string): Promise<string> {
    try {
      const response = await this.client.post(`/${this.pageId}/messages`, {
        recipient: { id: userId },
        message: { text: message },
      });
      return response.data.message_id;
    } catch (error) {
      console.error('Error sending Facebook Messenger message:', error);
      throw error;
    }
  }

  async getPageInsights(): Promise<any> {
    try {
      const response = await this.client.get(`/${this.pageId}/insights`, {
        params: {
          metric: 'page_fans,page_engaged_users,page_post_engagements',
          period: 'day',
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching Facebook page insights:', error);
      throw error;
    }
  }
}

