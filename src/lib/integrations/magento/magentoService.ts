import { prisma } from '@/lib/prisma';
import axios, { AxiosInstance } from 'axios';

export interface MagentoProduct {
  id: number;
  sku: string;
  name: string;
  price: number;
  type_id: string;
  status: number;
  visibility: number;
  created_at: string;
  updated_at: string;
}

export interface MagentoOrder {
  entity_id: number;
  increment_id: string;
  status: string;
  state: string;
  grand_total: number;
  subtotal: number;
  created_at: string;
  customer_email: string;
  items: any[];
}

export class MagentoService {
  private client: AxiosInstance;
  private integrationId: string;

  constructor(integrationId: string, baseUrl: string, accessToken: string) {
    this.integrationId = integrationId;
    this.client = axios.create({
      baseURL: `${baseUrl}/rest/default/V1`,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.get('/store/storeViews');
      return response.status === 200;
    } catch (error) {
      console.error('Magento connection test failed:', error);
      return false;
    }
  }

  async syncProducts(): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    try {
      const integration = await prisma.magentoIntegration.findUnique({
        where: { id: this.integrationId },
      });

      if (!integration) {
        throw new Error('Integration not found');
      }

      // Get products from Magento
      const response = await this.client.get('/products', {
        params: {
          searchCriteria: {
            pageSize: 100,
            currentPage: 1,
          },
        },
      });

      const products: MagentoProduct[] = response.data.items || [];

      for (const magentoProduct of products) {
        try {
          await this.syncProduct(magentoProduct, integration.organizationId);
          success++;
        } catch (error) {
          console.error(`Failed to sync product ${magentoProduct.id}:`, error);
          failed++;
        }
      }

      await prisma.magentoIntegration.update({
        where: { id: this.integrationId },
        data: { lastSync: new Date() },
      });

      return { success, failed };
    } catch (error) {
      console.error('Error syncing products from Magento:', error);
      throw error;
    }
  }

  private async syncProduct(magentoProduct: MagentoProduct, organizationId: string): Promise<void> {
    const productData = {
      name: magentoProduct.name,
      sku: magentoProduct.sku,
      price: magentoProduct.price,
      isActive: magentoProduct.status === 1,
      organizationId,
      metadata: {
        magentoId: magentoProduct.id,
        magentoType: magentoProduct.type_id,
      },
    };

    // Check via dimensions metadata (Product doesn't have metadata field)
    const allProducts = await prisma.product.findMany({
      where: { organizationId },
    });
    const existingProduct = allProducts.find(p => {
      const dimensions = (p.dimensions as any) || {};
      return dimensions.magentoId === String(magentoProduct.id);
    });

    if (existingProduct) {
      await prisma.product.update({
        where: { id: existingProduct.id },
        data: {
          ...productData,
          dimensions: {
            ...(existingProduct.dimensions as any || {}),
            magentoId: String(magentoProduct.id),
            magentoType: magentoProduct.type_id,
          } as any,
        },
      });
    } else {
      await prisma.product.create({
        data: {
          name: productData.name,
          sku: productData.sku,
          price: productData.price,
          isActive: productData.isActive,
          organizationId: productData.organizationId,
          dimensions: {
            magentoId: String(magentoProduct.id),
            magentoType: magentoProduct.type_id,
          } as any,
        },
      });
    }
  }

  async syncOrders(): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    try {
      const integration = await prisma.magentoIntegration.findUnique({
        where: { id: this.integrationId },
      });

      if (!integration) {
        throw new Error('Integration not found');
      }

      const response = await this.client.get('/orders', {
        params: {
          searchCriteria: {
            pageSize: 100,
            currentPage: 1,
          },
        },
      });

      const orders: MagentoOrder[] = response.data.items || [];

      for (const magentoOrder of orders) {
        try {
          await this.syncOrder(magentoOrder, integration.organizationId);
          success++;
        } catch (error) {
          console.error(`Failed to sync order ${magentoOrder.entity_id}:`, error);
          failed++;
        }
      }

      return { success, failed };
    } catch (error) {
      console.error('Error syncing orders from Magento:', error);
      throw error;
    }
  }

  private async syncOrder(magentoOrder: MagentoOrder, organizationId: string): Promise<void> {
    // Find or create customer
    let customer = await prisma.customer.findFirst({
      where: {
        organizationId,
        email: magentoOrder.customer_email,
      },
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          email: magentoOrder.customer_email,
          organizationId,
        },
      });
    }

    const orderData = {
      orderNumber: `MAGENTO-${magentoOrder.increment_id}`,
      status: this.mapMagentoStatus(magentoOrder.status),
      totalAmount: magentoOrder.grand_total,
      subtotal: magentoOrder.subtotal,
      customerId: customer.id,
      organizationId,
      metadata: {
        magentoId: magentoOrder.entity_id,
        magentoIncrementId: magentoOrder.increment_id,
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
          subtotal: orderData.subtotal,
          customerId: orderData.customerId,
          organizationId: orderData.organizationId,
          metadata: {
            magentoId: orderData.metadata.magentoId,
            magentoIncrementId: orderData.metadata.magentoIncrementId,
          } as any,
        },
      });
    }
  }

  private mapMagentoStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'pending': 'PENDING',
      'processing': 'CONFIRMED',
      'complete': 'COMPLETED',
      'closed': 'CANCELLED',
      'canceled': 'CANCELLED',
    };
    return statusMap[status.toLowerCase()] || 'PENDING';
  }
}

