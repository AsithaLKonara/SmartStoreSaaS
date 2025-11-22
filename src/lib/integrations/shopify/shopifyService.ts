import { prisma } from '@/lib/prisma';
import axios, { AxiosInstance } from 'axios';

export interface ShopifyProduct {
  id: number;
  title: string;
  body_html: string;
  vendor: string;
  product_type: string;
  created_at: string;
  handle: string;
  updated_at: string;
  published_at: string | null;
  template_suffix: string | null;
  status: string;
  published_scope: string;
  tags: string;
  admin_graphql_api_id: string;
  variants: ShopifyVariant[];
  options: ShopifyOption[];
  images: ShopifyImage[];
  image: ShopifyImage | null;
}

export interface ShopifyVariant {
  id: number;
  product_id: number;
  title: string;
  price: string;
  sku: string;
  position: number;
  inventory_policy: string;
  compare_at_price: string | null;
  fulfillment_service: string;
  inventory_management: string;
  option1: string | null;
  option2: string | null;
  option3: string | null;
  created_at: string;
  updated_at: string;
  taxable: boolean;
  barcode: string | null;
  grams: number;
  image_id: number | null;
  weight: number;
  weight_unit: string;
  inventory_quantity: number;
  old_inventory_quantity: number;
  requires_shipping: boolean;
  admin_graphql_api_id: string;
}

export interface ShopifyOption {
  id: number;
  product_id: number;
  name: string;
  position: number;
  values: string[];
}

export interface ShopifyImage {
  id: number;
  product_id: number;
  position: number;
  created_at: string;
  updated_at: string;
  alt: string | null;
  width: number;
  height: number;
  src: string;
  variant_ids: number[];
  admin_graphql_api_id: string;
}

export interface ShopifyOrder {
  id: number;
  email: string;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  number: number;
  note: string | null;
  token: string;
  gateway: string;
  test: boolean;
  total_price: string;
  subtotal_price: string;
  total_weight: number;
  total_tax: string;
  taxes_included: boolean;
  currency: string;
  financial_status: string;
  confirmed: boolean;
  total_discounts: string;
  buyer_accepts_marketing: boolean;
  name: string;
  referring_site: string;
  landing_site: string;
  cancelled_at: string | null;
  cancel_reason: string | null;
  total_line_items_price: string;
  total_duties: string | null;
  billing_address: any;
  shipping_address: any;
  customer: any;
  line_items: any[];
  fulfillments: any[];
  refunds: any[];
}

export class ShopifyService {
  private client: AxiosInstance;
  private integrationId: string;

  constructor(integrationId: string, shopDomain: string, accessToken: string) {
    this.integrationId = integrationId;
    this.client = axios.create({
      baseURL: `https://${shopDomain}.myshopify.com/admin/api/2024-01`,
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.get('/shop.json');
      return response.status === 200;
    } catch (error) {
      console.error('Shopify connection test failed:', error);
      return false;
    }
  }

  async syncProducts(): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;
    const startTime = new Date();

    try {
      let pageInfo: string | null = null;
      do {
        const url: string = pageInfo 
          ? `/products.json?limit=250&page_info=${pageInfo}`
          : '/products.json?limit=250';

        const response: any = await this.client.get(url);
        const products: ShopifyProduct[] = response.data.products;

        for (const shopifyProduct of products) {
          try {
            await this.syncProduct(shopifyProduct);
            success++;
          } catch (error) {
            console.error(`Failed to sync product ${shopifyProduct.id}:`, error);
            failed++;
          }
        }

        // Get next page info from Link header
        const linkHeader: string | undefined = response.headers.link;
        if (linkHeader) {
          const nextMatch: RegExpMatchArray | null = linkHeader.match(/<[^>]*page_info=([^>]+)>; rel="next"/);
          pageInfo = nextMatch ? nextMatch[1] : null;
        } else {
          pageInfo = null;
        }
      } while (pageInfo);

      await this.logSync('product', 'success', success, failed, startTime);

      return { success, failed };
    } catch (error) {
      await this.logSync('product', 'failed', success, failed, startTime, String(error));
      throw error;
    }
  }

  async syncProduct(shopifyProduct: ShopifyProduct): Promise<void> {
    const integration = await prisma.shopifyIntegration.findUnique({
      where: { id: this.integrationId },
    });

    if (!integration) {
      throw new Error('Integration not found');
    }

    const productData = {
      name: shopifyProduct.title,
      description: shopifyProduct.body_html?.replace(/<[^>]*>/g, '') || '',
      sku: shopifyProduct.variants[0]?.sku || `SHOPIFY-${shopifyProduct.id}`,
      price: parseFloat(shopifyProduct.variants[0]?.price || '0'),
      costPrice: parseFloat(shopifyProduct.variants[0]?.compare_at_price || shopifyProduct.variants[0]?.price || '0'),
      stockQuantity: shopifyProduct.variants.reduce((sum, v) => sum + (v.inventory_quantity || 0), 0),
      images: shopifyProduct.images.map(img => img.src),
      isActive: shopifyProduct.status === 'active',
      organizationId: integration.organizationId,
      metadata: {
        shopifyId: shopifyProduct.id,
        shopifyHandle: shopifyProduct.handle,
        shopifyVendor: shopifyProduct.vendor,
        shopifyType: shopifyProduct.product_type,
      },
    };

    // Check if product already exists (via dimensions metadata)
    const allProducts = await prisma.product.findMany({
      where: { organizationId: integration.organizationId },
    });
    const existingProduct = allProducts.find(p => {
      const dimensions = (p.dimensions as any) || {};
      return dimensions.shopifyId === String(shopifyProduct.id);
    });

    if (existingProduct) {
      await prisma.product.update({
        where: { id: existingProduct.id },
        data: {
          ...productData,
          dimensions: {
            ...(existingProduct.dimensions as any || {}),
            shopifyId: String(shopifyProduct.id),
            shopifyHandle: shopifyProduct.handle,
            shopifyVendor: shopifyProduct.vendor,
            shopifyType: shopifyProduct.product_type,
          } as any,
        },
      });
    } else {
      const slug = productData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      await prisma.product.create({
        data: {
          name: productData.name,
          slug: slug || `product-${Date.now()}`,
          description: productData.description,
          sku: productData.sku,
          price: productData.price,
          costPrice: productData.costPrice,
          stockQuantity: productData.stockQuantity,
          images: productData.images,
          isActive: productData.isActive,
          organizationId: productData.organizationId,
          createdById: productData.organizationId, // Use organizationId as fallback
          dimensions: {
            shopifyId: String(shopifyProduct.id),
            shopifyHandle: shopifyProduct.handle,
            shopifyVendor: shopifyProduct.vendor,
            shopifyType: shopifyProduct.product_type,
          } as any,
        },
      });
    }
  }

  async syncOrders(): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;
    const startTime = new Date();

    try {
      let pageInfo: string | null = null;
      do {
        const url: string = pageInfo
          ? `/orders.json?limit=250&status=any&page_info=${pageInfo}`
          : '/orders.json?limit=250&status=any';

        const response = await this.client.get(url);
        const orders: ShopifyOrder[] = response.data.orders;

        for (const shopifyOrder of orders) {
          try {
            await this.syncOrder(shopifyOrder);
            success++;
          } catch (error) {
            console.error(`Failed to sync order ${shopifyOrder.id}:`, error);
            failed++;
          }
        }

        const linkHeader: string | undefined = response.headers.link;
        if (linkHeader) {
          const nextMatch: RegExpMatchArray | null = linkHeader.match(/<[^>]*page_info=([^>]+)>; rel="next"/);
          pageInfo = nextMatch ? nextMatch[1] : null;
        } else {
          pageInfo = null;
        }
      } while (pageInfo);

      await this.logSync('order', 'success', success, failed, startTime);

      return { success, failed };
    } catch (error) {
      await this.logSync('order', 'failed', success, failed, startTime, String(error));
      throw error;
    }
  }

  async syncOrder(shopifyOrder: ShopifyOrder): Promise<void> {
    const integration = await prisma.shopifyIntegration.findUnique({
      where: { id: this.integrationId },
    });

    if (!integration) {
      throw new Error('Integration not found');
    }

    // Find or create customer
    let customer = await prisma.customer.findFirst({
      where: {
        organizationId: integration.organizationId,
        email: shopifyOrder.email,
      },
    });

    if (!customer && shopifyOrder.customer) {
      customer = await prisma.customer.create({
        data: {
          name: shopifyOrder.customer.first_name + ' ' + shopifyOrder.customer.last_name,
          email: shopifyOrder.email,
          phone: shopifyOrder.customer.phone || null,
          organizationId: integration.organizationId,
        },
      });
    }

    if (!customer) {
      throw new Error('Customer not found or created');
    }

    const orderData = {
      orderNumber: `SHOPIFY-${shopifyOrder.number}`,
      status: this.mapShopifyStatusToOrderStatus(shopifyOrder.financial_status),
      totalAmount: parseFloat(shopifyOrder.total_price),
      subtotal: parseFloat(shopifyOrder.subtotal_price),
      tax: parseFloat(shopifyOrder.total_tax),
      shipping: parseFloat(shopifyOrder.total_discounts || '0'),
      discount: parseFloat(shopifyOrder.total_discounts || '0'),
      currency: shopifyOrder.currency,
      paymentMethod: shopifyOrder.gateway || 'online',
      paymentStatus: this.mapShopifyFinancialStatus(shopifyOrder.financial_status),
      customerId: customer.id,
      organizationId: integration.organizationId,
      metadata: {
        shopifyId: shopifyOrder.id,
        shopifyName: shopifyOrder.name,
        shopifyToken: shopifyOrder.token,
      },
      items: {
        create: shopifyOrder.line_items.map((item: any) => ({
          quantity: item.quantity,
          price: parseFloat(item.price),
          total: parseFloat(item.price) * item.quantity,
          metadata: {
            shopifyLineItemId: item.id,
            variantId: item.variant_id,
          },
        })),
      },
    };

    // Check if order already exists
    const existingOrder = await prisma.order.findUnique({
      where: { orderNumber: orderData.orderNumber },
    });

    if (existingOrder) {
      await prisma.order.update({
        where: { id: existingOrder.id },
        data: {
          status: orderData.status as any,
          totalAmount: orderData.totalAmount,
          paymentStatus: orderData.paymentStatus as any,
        },
      });
    } else {
      await prisma.order.create({
        data: {
          orderNumber: orderData.orderNumber,
          status: orderData.status as any,
          totalAmount: orderData.totalAmount,
          subtotal: orderData.subtotal,
          tax: orderData.tax,
          shipping: orderData.shipping,
          discount: orderData.discount,
          currency: orderData.currency,
          paymentMethod: orderData.paymentMethod,
          paymentStatus: orderData.paymentStatus as any,
          customerId: orderData.customerId,
          organizationId: orderData.organizationId,
          createdById: orderData.organizationId, // Use organizationId as fallback
          items: {
            create: Array.isArray(orderData.items) ? orderData.items.map((item: { quantity: number; price: number; total: number; metadata?: { shopifyLineItemId?: string; variantId?: string } }) => ({
              quantity: item.quantity,
              price: item.price,
              total: item.total,
              metadata: item.metadata || {},
              productId: (item.metadata as any)?.productId || '',
            })) : [],
          },
          metadata: orderData.metadata as any,
        },
      });
    }
  }

  async syncInventory(): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;
    const startTime = new Date();

    try {
      const response = await this.client.get('/products.json?limit=250');
      const products: ShopifyProduct[] = response.data.products;

      for (const shopifyProduct of products) {
        try {
          const totalInventory = shopifyProduct.variants.reduce(
            (sum, v) => sum + (v.inventory_quantity || 0),
            0
          );

          // Check via dimensions metadata
          const allProducts = await prisma.product.findMany({});
          const product = allProducts.find(p => {
            const dimensions = (p.dimensions as any) || {};
            return dimensions.shopifyId === String(shopifyProduct.id);
          });

          if (product) {
            await prisma.product.update({
              where: { id: product.id },
              data: { stockQuantity: totalInventory },
            });
            success++;
          }
        } catch (error) {
          console.error(`Failed to sync inventory for product ${shopifyProduct.id}:`, error);
          failed++;
        }
      }

      await this.logSync('inventory', 'success', success, failed, startTime);

      return { success, failed };
    } catch (error) {
      await this.logSync('inventory', 'failed', success, failed, startTime, String(error));
      throw error;
    }
  }

  private mapShopifyStatusToOrderStatus(financialStatus: string): string {
    const statusMap: Record<string, string> = {
      'pending': 'PENDING',
      'authorized': 'CONFIRMED',
      'partially_paid': 'CONFIRMED',
      'paid': 'CONFIRMED',
      'partially_refunded': 'REFUNDED',
      'refunded': 'REFUNDED',
      'voided': 'CANCELLED',
    };
    return statusMap[financialStatus] || 'PENDING';
  }

  private mapShopifyFinancialStatus(financialStatus: string): string {
    const statusMap: Record<string, string> = {
      'pending': 'PENDING',
      'authorized': 'AUTHORIZED',
      'partially_paid': 'PARTIAL',
      'paid': 'PAID',
      'partially_refunded': 'PARTIAL_REFUND',
      'refunded': 'REFUNDED',
      'voided': 'VOIDED',
    };
    return statusMap[financialStatus] || 'PENDING';
  }

  private async logSync(
    syncType: string,
    status: string,
    processed: number,
    failed: number,
    startedAt: Date,
    errorMessage?: string
  ): Promise<void> {
    await prisma.shopifySyncLog.create({
      data: {
        integrationId: this.integrationId,
        syncType,
        status,
        recordsProcessed: processed,
        recordsFailed: failed,
        errorMessage,
        startedAt,
        completedAt: new Date(),
      },
    });
  }

  async createWebhook(topic: string, address: string): Promise<any> {
    const response = await this.client.post('/webhooks.json', {
      webhook: {
        topic,
        address,
        format: 'json',
      },
    });
    return response.data.webhook;
  }

  async deleteWebhook(webhookId: number): Promise<void> {
    await this.client.delete(`/webhooks/${webhookId}.json`);
  }

  async listWebhooks(): Promise<any[]> {
    const response = await this.client.get('/webhooks.json');
    return response.data.webhooks;
  }
}

