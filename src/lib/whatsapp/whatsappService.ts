import { prisma } from '@/lib/prisma';
import { realTimeSyncService, SyncEvent } from '@/lib/sync/realTimeSyncService';
import { EventEmitter } from 'events';
import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';

export interface WhatsAppMessage {
  id: string;
  from: string;
  to: string;
  type: 'text' | 'image' | 'document' | 'audio' | 'video' | 'location' | 'contact' | 'sticker' | 'template' | 'interactive';
  content: any;
  timestamp: Date;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  organizationId: string;
  customerId?: string;
  orderId?: string;
  metadata?: any;
  templateName?: string;
  templateData?: Record<string, any>;
  mediaId?: string;
  mediaUrl?: string;
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
  retailer_id?: string;
}

export interface WhatsAppTemplate {
  name: string;
  language: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'DISABLED';
  category: 'AUTHENTICATION' | 'MARKETING' | 'UTILITY';
  components: Array<{
    type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
    format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
    text?: string;
    example?: any;
    buttons?: Array<{
      type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
      text: string;
      url?: string;
      phone_number?: string;
    }>;
  }>;
}

export interface WhatsAppContact {
  wa_id: string;
  profile: {
    name: string;
  };
}

export interface WhatsAppBusinessProfile {
  about?: string;
  address?: string;
  description?: string;
  email?: string;
  profile_picture_url?: string;
  websites?: string[];
  vertical?: string;
}

export interface WhatsAppWebhookEntry {
  id: string;
  changes: Array<{
    value: {
      messaging_product: string;
      metadata: {
        display_phone_number: string;
        phone_number_id: string;
      };
      contacts?: WhatsAppContact[];
      messages?: any[];
      statuses?: any[];
    };
    field: string;
  }>;
}

export class WhatsAppService extends EventEmitter {
  private apiClient: AxiosInstance;
  private phoneNumberId: string;
  private accessToken: string;
  private webhookVerifyToken: string;
  private businessAccountId: string;

  constructor() {
    super();
    
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID!;
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN!;
    this.webhookVerifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN!;
    this.businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID!;

    this.apiClient = axios.create({
      baseURL: 'https://graph.facebook.com/v18.0',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.on('message:received', this.handleIncomingMessage.bind(this));
    this.on('message:status', this.handleMessageStatus.bind(this));
  }

  /**
   * Send a text message
   */
  async sendTextMessage(
    to: string,
    message: string,
    organizationId: string,
    preview_url: boolean = false
  ): Promise<WhatsAppMessage> {
    try {
      const payload = {
            messaging_product: 'whatsapp',
            to,
            type: 'text',
        text: {
          body: message,
          preview_url,
        },
      };

      const response = await this.apiClient.post(`/${this.phoneNumberId}/messages`, payload);
      
      const whatsappMessage: WhatsAppMessage = {
        id: response.data.messages[0].id,
        from: this.phoneNumberId,
        to,
        type: 'text',
        content: { body: message },
        timestamp: new Date(),
        status: 'sent',
        organizationId,
      };

      // Store message in database
      await this.storeMessage(whatsappMessage);

      // Emit sync event
      await realTimeSyncService.queueEvent({
        type: 'message',
        entityId: whatsappMessage.id,
        organizationId,
        data: whatsappMessage,
        timestamp: new Date(),
      });

      return whatsappMessage;
    } catch (error) {
      console.error('Error sending WhatsApp text message:', error);
      throw new Error('Failed to send WhatsApp message');
    }
  }

  /**
   * Send a template message
   */
  async sendTemplateMessage(
    to: string,
    templateName: string,
    language: string,
    organizationId: string,
    components?: any[]
  ): Promise<WhatsAppMessage> {
    try {
      const payload = {
            messaging_product: 'whatsapp',
            to,
            type: 'template',
            template: {
          name: templateName,
          language: {
            code: language,
          },
          components: components || [],
        },
      };

      const response = await this.apiClient.post(`/${this.phoneNumberId}/messages`, payload);
      
      const whatsappMessage: WhatsAppMessage = {
        id: response.data.messages[0].id,
        from: this.phoneNumberId,
        to,
        type: 'template',
        content: { template: payload.template },
        timestamp: new Date(),
        status: 'sent',
        organizationId,
        templateName,
      };

      await this.storeMessage(whatsappMessage);

      await realTimeSyncService.queueEvent({
        type: 'message',
        entityId: whatsappMessage.id,
        organizationId,
        data: whatsappMessage,
        timestamp: new Date(),
      });

      return whatsappMessage;
    } catch (error) {
      console.error('Error sending WhatsApp template message:', error);
      throw new Error('Failed to send WhatsApp template message');
    }
  }

  /**
   * Send media message (image, document, audio, video)
   */
  async sendMediaMessage(
    to: string,
    mediaType: 'image' | 'document' | 'audio' | 'video',
    mediaId: string,
    organizationId: string,
    caption?: string,
    filename?: string
  ): Promise<WhatsAppMessage> {
    try {
      const payload: any = {
        messaging_product: 'whatsapp',
        to,
        type: mediaType,
        [mediaType]: {
          id: mediaId,
        },
      };

      if (caption && (mediaType === 'image' || mediaType === 'video')) {
        payload[mediaType].caption = caption;
      }

      if (filename && mediaType === 'document') {
        payload[mediaType].filename = filename;
      }

      const response = await this.apiClient.post(`/${this.phoneNumberId}/messages`, payload);
      
      const whatsappMessage: WhatsAppMessage = {
        id: response.data.messages[0].id,
        from: this.phoneNumberId,
        to,
        type: mediaType,
        content: payload[mediaType],
        timestamp: new Date(),
        status: 'sent',
        organizationId,
        mediaId,
      };

      await this.storeMessage(whatsappMessage);

      await realTimeSyncService.queueEvent({
        type: 'message',
        entityId: whatsappMessage.id,
        organizationId,
        data: whatsappMessage,
        timestamp: new Date(),
      });

      return whatsappMessage;
    } catch (error) {
      console.error('Error sending WhatsApp media message:', error);
      throw new Error('Failed to send WhatsApp media message');
    }
  }

  /**
   * Send interactive message (buttons, list)
   */
  async sendInteractiveMessage(
    to: string,
    interactiveData: any,
    organizationId: string
  ): Promise<WhatsAppMessage> {
    try {
      const payload = {
        messaging_product: 'whatsapp',
        to,
        type: 'interactive',
        interactive: interactiveData,
      };

      const response = await this.apiClient.post(`/${this.phoneNumberId}/messages`, payload);
      
      const whatsappMessage: WhatsAppMessage = {
        id: response.data.messages[0].id,
        from: this.phoneNumberId,
        to,
        type: 'interactive',
        content: interactiveData,
        timestamp: new Date(),
        status: 'sent',
        organizationId,
      };

      await this.storeMessage(whatsappMessage);

      await realTimeSyncService.queueEvent({
        type: 'message',
        entityId: whatsappMessage.id,
        organizationId,
        data: whatsappMessage,
        timestamp: new Date(),
      });

      return whatsappMessage;
    } catch (error) {
      console.error('Error sending WhatsApp interactive message:', error);
      throw new Error('Failed to send WhatsApp interactive message');
    }
  }

  /**
   * Upload media and get media ID
   */
  async uploadMedia(
    mediaBuffer: Buffer,
    mediaType: 'image' | 'document' | 'audio' | 'video',
    filename?: string
  ): Promise<string> {
    try {
      const formData = new FormData();
      formData.append('file', new Blob([Buffer.from(mediaBuffer)]), filename);
      formData.append('type', mediaType);
      formData.append('messaging_product', 'whatsapp');

      const response = await this.apiClient.post(`/${this.phoneNumberId}/media`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      return response.data.id;
    } catch (error) {
      console.error('Error uploading media to WhatsApp:', error);
      throw new Error('Failed to upload media');
    }
  }

  /**
   * Download media by ID
   */
  async downloadMedia(mediaId: string): Promise<Buffer> {
    try {
      // First get media URL
      const mediaResponse = await this.apiClient.get(`/${mediaId}`);
      const mediaUrl = mediaResponse.data.url;

      // Download the media
      const downloadResponse = await this.apiClient.get(mediaUrl, {
        responseType: 'arraybuffer',
      });

      return Buffer.from(downloadResponse.data);
    } catch (error) {
      console.error('Error downloading media from WhatsApp:', error);
      throw new Error('Failed to download media');
    }
  }

  /**
   * Create message template
   */
  async createMessageTemplate(
    organizationId: string,
    template: Omit<WhatsAppTemplate, 'status'>
  ): Promise<WhatsAppTemplate> {
    try {
      const payload = {
        name: template.name,
        language: template.language,
        category: template.category,
        components: template.components,
      };

      const response = await this.apiClient.post(`/${this.businessAccountId}/message_templates`, payload);
      
      const createdTemplate: WhatsAppTemplate = {
        ...template,
        status: 'PENDING',
      };

      // Store template in Organization metadata
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { settings: true },
      });

      const settings = (organization?.settings as any) || {};
      const whatsappTemplates = settings.whatsappTemplates || [];
      
      // Add template with ID from API response
      whatsappTemplates.push({
        ...createdTemplate,
        templateId: response.data.id,
        createdAt: new Date(),
      });

      // Update organization metadata
      await prisma.organization.update({
        where: { id: organizationId },
        data: {
          settings: {
            ...settings,
            whatsappTemplates,
          } as any,
        },
      });

      return createdTemplate;
    } catch (error) {
      console.error('Error creating WhatsApp template:', error);
      throw new Error('Failed to create WhatsApp template');
    }
  }

  /**
   * Get message templates
   */
  async getMessageTemplates(): Promise<WhatsAppTemplate[]> {
    try {
      const response = await this.apiClient.get(`/${this.businessAccountId}/message_templates`);
      return response.data.data;
    } catch (error) {
      console.error('Error getting WhatsApp templates:', error);
      throw new Error('Failed to get WhatsApp templates');
    }
  }

  /**
   * Create and manage business catalog
   */
  async createCatalog(
    name: string,
    organizationId: string,
    description?: string
  ): Promise<WhatsAppCatalog> {
    try {
      const payload = {
        name,
        description,
      };

      const response = await this.apiClient.post(`/${this.businessAccountId}/product_catalogs`, payload);
      
      const catalog: WhatsAppCatalog = {
        id: response.data.id,
        name,
        description,
        products: [],
          organizationId,
          isActive: true,
        lastUpdated: new Date(),
      };

      // Store catalog in database
      await prisma.whatsAppCatalog.create({
        data: {
          name: catalog.name,
          description: catalog.description,
          products: catalog.products || [], // Store products as JSON
          organizationId: catalog.organizationId,
          isActive: catalog.isActive,
        },
      });

      return catalog;
    } catch (error) {
      console.error('Error creating WhatsApp catalog:', error);
      throw new Error('Failed to create WhatsApp catalog');
    }
  }

  /**
   * Add product to catalog
   */
  async addProductToCatalog(
    catalogId: string,
    product: Omit<WhatsAppProduct, 'id'>
  ): Promise<WhatsAppProduct> {
    try {
      const payload = {
        name: product.name,
        description: product.description,
        price: product.price * 100, // Convert to cents
        currency: product.currency,
        image_url: product.images[0],
        availability: product.availability,
        retailer_id: product.retailer_id || crypto.randomUUID(),
      };

      const response = await this.apiClient.post(`/${catalogId}/products`, payload);
      
      const whatsappProduct: WhatsAppProduct = {
        id: response.data.id,
        ...product,
        retailer_id: payload.retailer_id,
      };

      return whatsappProduct;
    } catch (error) {
      console.error('Error adding product to WhatsApp catalog:', error);
      throw new Error('Failed to add product to catalog');
    }
  }

  /**
   * Update business profile
   */
  async updateBusinessProfile(profile: WhatsAppBusinessProfile): Promise<void> {
    try {
      await this.apiClient.post(`/${this.phoneNumberId}/whatsapp_business_profile`, profile);
    } catch (error) {
      console.error('Error updating WhatsApp business profile:', error);
      throw new Error('Failed to update business profile');
    }
  }

  /**
   * Handle webhook verification
   */
  verifyWebhook(mode: string, token: string, challenge: string): string | null {
    if (mode === 'subscribe' && token === this.webhookVerifyToken) {
      return challenge;
    }
    return null;
  }

  /**
   * Handle incoming webhook
   */
  async handleWebhook(body: any, signature: string): Promise<void> {
    try {
      // Verify webhook signature
      if (!this.verifyWebhookSignature(body, signature)) {
        throw new Error('Invalid webhook signature');
      }

      const entries: WhatsAppWebhookEntry[] = body.entry || [];

      for (const entry of entries) {
        for (const change of entry.changes) {
          if (change.field === 'messages') {
            const value = change.value;

            // Handle incoming messages
            if (value.messages) {
              for (const message of value.messages) {
                await this.processIncomingMessage(message, value.metadata);
              }
            }

            // Handle message status updates
            if (value.statuses) {
              for (const status of value.statuses) {
                await this.processMessageStatus(status);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error handling WhatsApp webhook:', error);
      throw error;
    }
  }

  private verifyWebhookSignature(body: any, signature: string): boolean {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', process.env.WHATSAPP_WEBHOOK_SECRET!)
        .update(JSON.stringify(body))
        .digest('hex');

      return signature === `sha256=${expectedSignature}`;
    } catch (error) {
      console.error('Error verifying webhook signature:', error);
      return false;
    }
  }

  private async processIncomingMessage(message: any, metadata: any): Promise<void> {
    try {
      const whatsappMessage: WhatsAppMessage = {
        id: message.id,
        from: message.from,
        to: metadata.phone_number_id,
        type: message.type,
        content: this.extractMessageContent(message),
        timestamp: new Date(parseInt(message.timestamp) * 1000),
        status: 'delivered',
        organizationId: '', // Will be determined from phone number
      };

      // Determine organization from phone number
      const integration = await prisma.whatsAppIntegration.findFirst({
        where: { phoneNumberId: metadata.phone_number_id },
      });

      if (integration) {
        whatsappMessage.organizationId = integration.organizationId;
      }

      // Store message
      await this.storeMessage(whatsappMessage);

      // Emit event
      this.emit('message:received', whatsappMessage);

      // Process auto-replies and workflows
      await this.processAutoReply(whatsappMessage);
    } catch (error) {
      console.error('Error processing incoming WhatsApp message:', error);
    }
  }

  private async processMessageStatus(status: any): Promise<void> {
    try {
      // Update message status in database
      await prisma.whatsAppMessage.updateMany({
        where: { id: status.id }, // Use id instead of messageId
        data: { 
          status: status.status,
          timestamp: new Date(parseInt(status.timestamp) * 1000), // Use timestamp instead of statusTimestamp
        },
      });

      this.emit('message:status', {
        id: status.id,
        status: status.status,
        timestamp: new Date(parseInt(status.timestamp) * 1000),
      });
    } catch (error) {
      console.error('Error processing message status:', error);
    }
  }

  private extractMessageContent(message: any): any {
    switch (message.type) {
      case 'text':
        return { body: message.text.body };
      case 'image':
      case 'document':
      case 'audio':
      case 'video':
        return {
          id: message[message.type].id,
          mime_type: message[message.type].mime_type,
          caption: message[message.type].caption,
          filename: message[message.type].filename,
        };
      case 'location':
        return {
          latitude: message.location.latitude,
          longitude: message.location.longitude,
          name: message.location.name,
          address: message.location.address,
        };
      case 'contact':
        return message.contact;
      case 'interactive':
        return message.interactive;
      default:
        return message;
    }
  }

  private async processAutoReply(message: WhatsAppMessage): Promise<void> {
    try {
      const messageText = message.content.body?.toLowerCase() || '';

      // Handle common keywords
      if (messageText.includes('hello') || messageText.includes('hi')) {
        await this.sendTextMessage(
          message.from,
          'Hello! Welcome to SmartStore AI. How can I help you today?',
          message.organizationId
        );
      } else if (messageText.includes('catalog') || messageText.includes('products')) {
        await this.sendCatalogMessage(message.from, message.organizationId);
      } else if (messageText.includes('order') || messageText.includes('status')) {
        await this.sendOrderStatusMessage(message.from, message.organizationId);
      } else if (messageText.includes('help') || messageText.includes('support')) {
        await this.sendHelpMessage(message.from, message.organizationId);
      }
    } catch (error) {
      console.error('Error processing auto-reply:', error);
    }
  }

  private async sendCatalogMessage(to: string, organizationId: string): Promise<void> {
    const catalogMessage = {
      type: 'product_list',
      header: {
        type: 'text',
        text: 'Our Products',
      },
      body: {
        text: 'Check out our latest products:',
      },
      action: {
        catalog_id: 'your_catalog_id',
        sections: [
          {
            title: 'Featured Products',
            product_items: [
              { product_retailer_id: 'product_1' },
              { product_retailer_id: 'product_2' },
            ],
          },
        ],
      },
    };

    await this.sendInteractiveMessage(to, catalogMessage, organizationId);
  }

  private async sendOrderStatusMessage(to: string, organizationId: string): Promise<void> {
    const orderMessage = {
      type: 'button',
      body: {
        text: 'To check your order status, please click the button below or provide your order number.',
      },
      action: {
        buttons: [
          {
            type: 'web_url',
            url: `${process.env.NEXTAUTH_URL}/orders/track`,
            title: 'Track Order',
          },
        ],
      },
    };

    await this.sendInteractiveMessage(to, orderMessage, organizationId);
  }

  private async sendHelpMessage(to: string, organizationId: string): Promise<void> {
    const helpMessage = `
🛍️ *SmartStore AI Help*

Here&apos;s what I can help you with:
• Type "catalog" to see our products
• Type "order" to check order status
• Type "support" for customer service

For immediate assistance, visit our website or call customer service.
    `.trim();

    await this.sendTextMessage(to, helpMessage, organizationId);
  }

  private async storeMessage(message: WhatsAppMessage): Promise<void> {
    try {
    await prisma.whatsAppMessage.create({
      data: {
          // messageId: message.id, // Not in schema - store in metadata
        from: message.from,
        to: message.to,
        type: message.type,
        content: message.content,
        timestamp: message.timestamp,
        status: message.status,
        organizationId: message.organizationId,
        customerId: message.customerId,
        orderId: message.orderId,
          // templateName and mediaId not in schema - store in metadata
          metadata: {
            templateName: message.templateName,
            mediaId: message.mediaId,
          } as any,
        },
      });
    } catch (error) {
      console.error('Error storing WhatsApp message:', error);
    }
  }

  private async handleIncomingMessage(message: WhatsAppMessage): Promise<void> {
    // Broadcast to real-time sync
    await realTimeSyncService.queueEvent({
      type: 'message',
      action: 'create',
      entityId: message.id,
      organizationId: message.organizationId,
      data: message,
      timestamp: new Date(),
    });
  }

  private async handleMessageStatus(status: any): Promise<void> {
    // Broadcast status update
    await realTimeSyncService.queueEvent({
      type: 'message',
      action: 'update',
      entityId: status.id,
      organizationId: '', // Will need to be determined
      data: status,
      timestamp: new Date(),
    });
  }

  /**
   * Send transactional messages
   */
  async sendOrderConfirmation(orderId: string, customerPhone: string, organizationId: string): Promise<void> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: true } } },
    });

    if (!order) throw new Error('Order not found');

    await this.sendTemplateMessage(
      customerPhone,
      'order_confirmation',
      'en',
      organizationId,
      [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: order.id },
            { type: 'text', text: order.totalAmount.toString() },
          ],
        },
      ]
    );
  }

  async sendShippingUpdate(orderId: string, trackingNumber: string, organizationId: string): Promise<void> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true },
    });

    if (!order || !order.customer.phone) return;

    await this.sendTemplateMessage(
      order.customer.phone,
      'shipping_update',
      'en',
      organizationId,
      [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: order.id },
            { type: 'text', text: trackingNumber },
          ],
        },
      ]
    );
  }

  async sendPaymentReminder(orderId: string, organizationId: string): Promise<void> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true },
    });

    if (!order || !order.customer.phone) return;

    await this.sendTemplateMessage(
      order.customer.phone,
      'payment_reminder',
      'en',
      organizationId,
      [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: order.id },
            { type: 'text', text: order.totalAmount.toString() },
          ],
        },
      ]
    );
  }
}

export const whatsAppService = new WhatsAppService(); 