import { prisma } from '@/lib/prisma';
import { realTimeSyncService, SyncEvent } from '@/lib/sync/realTimeSyncService';
import { EventEmitter } from 'events';

export interface WhatsAppMessage {
  id: string;
  from: string;
  to: string;
  type: 'text' | 'image' | 'document' | 'audio' | 'video' | 'location' | 'contact' | 'sticker' | 'template';
  content: any;
  timestamp: Date;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  organizationId: string;
  customerId?: string;
  orderId?: string;
  metadata?: any;
}

export interface WhatsAppCatalog {
  id: string;
  name: string;
  description?: string;
  products: WhatsAppProduct[];
  organizationId: string;
  isActive: boolean;
  lastUpdated: Date;
}

export interface WhatsAppProduct {
  id: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  images: string[];
  category?: string;
  availability: 'in_stock' | 'out_of_stock' | 'preorder';
  variants?: any[];
  metadata?: any;
}

export class WhatsAppService extends EventEmitter {
  private phoneNumberId: string;
  private accessToken: string;
  private webhookSecret: string;

  constructor() {
    super();
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID!;
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN!;
    this.webhookSecret = process.env.WHATSAPP_WEBHOOK_SECRET!;
  }

  async sendMessage(to: string, content: any, type: string = 'text', organizationId: string): Promise<WhatsAppMessage> {
    try {
      let messageData: any;

      switch (type) {
        case 'text':
          messageData = {
            messaging_product: 'whatsapp',
            to,
            type: 'text',
            text: { body: content }
          };
          break;

        case 'template':
          messageData = {
            messaging_product: 'whatsapp',
            to,
            type: 'template',
            template: {
              name: content.name,
              language: { code: content.language || 'en' },
              components: content.components || []
            }
          };
          break;

        default:
          throw new Error(`Unsupported message type: ${type}`);
      }

      const response = await fetch(`https://graph.facebook.com/v18.0/${this.phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(messageData)
      });

      if (!response.ok) {
        throw new Error(`WhatsApp API error: ${response.statusText}`);
      }

      const result = await response.json();
      
      const message: WhatsAppMessage = {
        id: result.messages[0].id,
        from: this.phoneNumberId,
        to,
        type: type as any,
        content,
        timestamp: new Date(),
        status: 'sent',
        organizationId
      };

      await this.saveMessage(message);
      await this.syncMessage(message);

      this.emit('message_sent', message);
      return message;

    } catch (error) {
      console.error('Error sending WhatsApp message:', error);
      throw error;
    }
  }

  async updateCatalog(organizationId: string): Promise<void> {
    try {
      const products = await prisma.product.findMany({
        where: { 
          organizationId,
          isActive: true,
          stockQuantity: { gt: 0 }
        },
        include: { category: true }
      });

      const catalogProducts = products.map(product => ({
        id: product.id,
        name: product.name,
        description: product.description,
        price: parseFloat(product.price.toString()),
        currency: 'USD',
        images: product.images || [],
        category: product.category?.name,
        availability: product.stockQuantity > 0 ? 'in_stock' : 'out_of_stock'
      }));

      await this.syncCatalogToWhatsApp(catalogProducts, organizationId);

      await prisma.whatsAppCatalog.upsert({
        where: { organizationId },
        update: {
          products: catalogProducts,
          lastUpdated: new Date()
        },
        create: {
          organizationId,
          name: 'Product Catalog',
          products: catalogProducts,
          isActive: true,
          lastUpdated: new Date()
        }
      });

      this.emit('catalog_updated', { organizationId, productCount: catalogProducts.length });

    } catch (error) {
      console.error('Error updating WhatsApp catalog:', error);
      throw error;
    }
  }

  private async syncCatalogToWhatsApp(products: WhatsAppProduct[], organizationId: string): Promise<void> {
    console.log(`Syncing ${products.length} products to WhatsApp catalog for organization ${organizationId}`);
  }

  private async saveMessage(message: WhatsAppMessage): Promise<void> {
    await prisma.whatsAppMessage.create({
      data: {
        id: message.id,
        from: message.from,
        to: message.to,
        type: message.type,
        content: message.content,
        timestamp: message.timestamp,
        status: message.status,
        organizationId: message.organizationId,
        customerId: message.customerId,
        orderId: message.orderId,
        metadata: message.metadata
      }
    });
  }

  private async syncMessage(message: WhatsAppMessage): Promise<void> {
    const syncEvent: SyncEvent = {
      id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'message',
      action: 'create',
      data: message,
      source: 'whatsapp',
      timestamp: new Date(),
      organizationId: message.organizationId
    };

    await realTimeSyncService.queueEvent(syncEvent);
  }
}

export const whatsAppService = new WhatsAppService(); 