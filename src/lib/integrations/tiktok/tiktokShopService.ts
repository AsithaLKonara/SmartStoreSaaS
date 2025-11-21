import { prisma } from '@/lib/prisma';
import axios, { AxiosInstance } from 'axios';

export interface TikTokProduct {
  id: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  images: string[];
  inventory: number;
  status: 'active' | 'inactive';
}

export interface TikTokOrder {
  order_id: string;
  status: string;
  total_amount: number;
  currency: string;
  items: any[];
  customer: any;
  created_at: string;
}

export class TikTokShopService {
  private client: AxiosInstance;
  private integrationId: string;
  private shopId: string;
  private accessToken: string;

  constructor(integrationId: string, shopId: string, accessToken: string) {
    this.integrationId = integrationId;
    this.shopId = shopId;
    this.accessToken = accessToken;

    this.client = axios.create({
      baseURL: 'https://open-api.tiktokglobalshop.com',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.get(`/api/shops/${this.shopId}`);
      return response.status === 200;
    } catch (error) {
      console.error('TikTok connection test failed:', error);
      return false;
    }
  }

  async syncProducts(): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    try {
      const integration = await prisma.tikTokIntegration.findUnique({
        where: { id: this.integrationId },
      });

      if (!integration) {
        throw new Error('Integration not found');
      }

      // Get products from TikTok Shop
      const response = await this.client.get('/api/products', {
        params: {
          shop_id: this.shopId,
          page_size: 100,
        },
      });

      const products: TikTokProduct[] = response.data.data?.products || [];

      for (const tiktokProduct of products) {
        try {
          await this.syncProduct(tiktokProduct, integration.organizationId);
          success++;
        } catch (error) {
          console.error(`Failed to sync product ${tiktokProduct.id}:`, error);
          failed++;
        }
      }

      await prisma.tikTokIntegration.update({
        where: { id: this.integrationId },
        data: { lastSync: new Date() },
      });

      return { success, failed };
    } catch (error) {
      console.error('Error syncing products from TikTok:', error);
      throw error;
    }
  }

  private async syncProduct(tiktokProduct: TikTokProduct, organizationId: string): Promise<void> {
    const productData = {
      name: tiktokProduct.title,
      description: tiktokProduct.description,
      price: tiktokProduct.price,
      currency: tiktokProduct.currency,
      stockQuantity: tiktokProduct.inventory,
      images: tiktokProduct.images,
      isActive: tiktokProduct.status === 'active',
      organizationId,
      metadata: {
        tiktokId: tiktokProduct.id,
        tiktokShopId: this.shopId,
      },
    };

    // Check via dimensions metadata
    const allProducts = await prisma.product.findMany({
      where: { organizationId },
    });
    const existingProduct = allProducts.find(p => {
      const dimensions = (p.dimensions as any) || {};
      return dimensions.tiktokId === tiktokProduct.id;
    });

    if (existingProduct) {
      await prisma.product.update({
        where: { id: existingProduct.id },
        data: {
          ...productData,
          dimensions: {
            ...(existingProduct.dimensions as any || {}),
            tiktokId: tiktokProduct.id,
            tiktokShopId: this.shopId,
          } as any,
        },
      });
    } else {
      await prisma.product.create({
        data: {
          name: productData.name,
          description: productData.description,
          price: productData.price,
          stockQuantity: productData.stockQuantity,
          images: productData.images,
          isActive: productData.isActive,
          organizationId: productData.organizationId,
          dimensions: {
            currency: productData.currency,
            tiktokId: tiktokProduct.id,
            tiktokShopId: this.shopId,
          } as any,
        },
      });
    }
  }

  async syncOrders(): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    try {
      const integration = await prisma.tikTokIntegration.findUnique({
        where: { id: this.integrationId },
      });

      if (!integration) {
        throw new Error('Integration not found');
      }

      const response = await this.client.get('/api/orders', {
        params: {
          shop_id: this.shopId,
          page_size: 100,
        },
      });

      const orders: TikTokOrder[] = response.data.data?.orders || [];

      for (const tiktokOrder of orders) {
        try {
          await this.syncOrder(tiktokOrder, integration.organizationId);
          success++;
        } catch (error) {
          console.error(`Failed to sync order ${tiktokOrder.order_id}:`, error);
          failed++;
        }
      }

      return { success, failed };
    } catch (error) {
      console.error('Error syncing orders from TikTok:', error);
      throw error;
    }
  }

  private async syncOrder(tiktokOrder: TikTokOrder, organizationId: string): Promise<void> {
    let customer = await prisma.customer.findFirst({
      where: {
        organizationId,
        email: tiktokOrder.customer?.email,
      },
    });

    if (!customer && tiktokOrder.customer) {
      customer = await prisma.customer.create({
        data: {
          email: tiktokOrder.customer.email,
          name: tiktokOrder.customer.name,
          organizationId,
        },
      });
    }

    if (!customer) {
      throw new Error('Customer not found or created');
    }

    const orderData = {
      orderNumber: `TIKTOK-${tiktokOrder.order_id}`,
      status: this.mapTikTokStatus(tiktokOrder.status),
      totalAmount: tiktokOrder.total_amount,
      currency: tiktokOrder.currency,
      customerId: customer.id,
      organizationId,
      metadata: {
        tiktokOrderId: tiktokOrder.order_id,
      },
    };

    const existingOrder = await prisma.order.findUnique({
      where: { orderNumber: orderData.orderNumber },
    });

    if (existingOrder) {
      await prisma.order.update({
        where: { id: existingOrder.id },
        data: {
          status: orderData.status as any,
          totalAmount: orderData.totalAmount,
        },
      });
    } else {
      await prisma.order.create({
        data: {
          orderNumber: orderData.orderNumber,
          status: orderData.status as any,
          totalAmount: orderData.totalAmount,
          currency: orderData.currency,
          customerId: orderData.customerId,
          organizationId: orderData.organizationId,
          metadata: {
            tiktokOrderId: orderData.metadata.tiktokOrderId,
          } as any,
        },
      });
    }
  }

  private mapTikTokStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'unpaid': 'PENDING',
      'pending': 'PENDING',
      'processing': 'CONFIRMED',
      'shipped': 'SHIPPED',
      'delivered': 'COMPLETED',
      'cancelled': 'CANCELLED',
      'refunded': 'REFUNDED',
    };
    return statusMap[status.toLowerCase()] || 'PENDING';
  }

  async createLiveShoppingEvent(
    title: string,
    scheduledTime: Date,
    products: string[]
  ): Promise<string> {
    const response = await this.client.post('/api/live/events', {
      shop_id: this.shopId,
      title,
      scheduled_time: scheduledTime.toISOString(),
      products,
    });

    return response.data.data.event_id;
  }
}

