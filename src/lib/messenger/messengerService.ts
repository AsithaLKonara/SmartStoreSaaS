import { prisma } from '@/lib/prisma';
import { realTimeSyncService } from '@/lib/sync/realTimeSyncService';
import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';

export interface MessengerMessage {
  id: string;
  senderId: string;
  recipientId: string;
  message: {
    text?: string;
    attachments?: Array<{
      type: 'image' | 'video' | 'audio' | 'file';
      payload: {
        url: string;
      };
    }>;
    quick_replies?: Array<{
      content_type: 'text' | 'location' | 'user_phone_number' | 'user_email';
      title?: string;
      payload?: string;
      image_url?: string;
    }>;
  };
  timestamp: Date;
  organizationId: string;
  conversationId?: string;
}

export interface MessengerProfile {
  first_name: string;
  last_name: string;
  profile_pic: string;
  locale: string;
  timezone: number;
  gender: string;
}

export interface MessengerTemplate {
  template_type: 'generic' | 'button' | 'receipt' | 'list';
  elements?: Array<{
    title: string;
    subtitle?: string;
    image_url?: string;
    default_action?: {
      type: 'web_url';
      url: string;
    };
    buttons?: Array<{
      type: 'web_url' | 'postback' | 'phone_number';
      title: string;
      url?: string;
      payload?: string;
      phone_number?: string;
    }>;
  }>;
  buttons?: Array<{
    type: 'web_url' | 'postback' | 'phone_number';
    title: string;
    url?: string;
    payload?: string;
    phone_number?: string;
  }>;
}

export interface MessengerWebhookEntry {
  id: string;
  time: number;
  messaging: Array<{
    sender: { id: string };
    recipient: { id: string };
    timestamp: number;
    message?: {
      mid: string;
      text?: string;
      attachments?: any[];
      quick_reply?: {
        payload: string;
      };
    };
    delivery?: {
      mids: string[];
      watermark: number;
    };
    read?: {
      watermark: number;
    };
    postback?: {
      title: string;
      payload: string;
    };
  }>;
}

export class MessengerService {
  private apiClient: AxiosInstance;
  private pageAccessToken: string;
  private appSecret: string;
  private verifyToken: string;

  constructor() {
    this.pageAccessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN!;
    this.appSecret = process.env.FACEBOOK_APP_SECRET!;
    this.verifyToken = process.env.FACEBOOK_VERIFY_TOKEN!;

    this.apiClient = axios.create({
      baseURL: 'https://graph.facebook.com/v18.0',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Send text message
   */
  async sendTextMessage(
    recipientId: string,
    text: string,
    organizationId: string,
    quickReplies?: Array<{
      title: string;
      payload: string;
    }>
  ): Promise<MessengerMessage> {
    try {
      const messageData: any = {
        recipient: { id: recipientId },
        message: { text },
      };

      if (quickReplies && quickReplies.length > 0) {
        messageData.message.quick_replies = quickReplies.map(qr => ({
          content_type: 'text',
          title: qr.title,
          payload: qr.payload,
        }));
      }

      const response = await this.apiClient.post('/me/messages', messageData, {
        params: { access_token: this.pageAccessToken },
      });

      const message: MessengerMessage = {
        id: response.data.message_id,
        senderId: 'page',
        recipientId,
        message: { text, quick_replies: messageData.message.quick_replies },
        timestamp: new Date(),
        organizationId,
      };

      // Store message in database
      await this.storeMessage(message);

      // Broadcast real-time event
      await realTimeSyncService.broadcastEvent({
        type: 'messenger_message_sent',
        entityId: message.id,
        entityType: 'messenger_message',
        organizationId,
        data: message,
        timestamp: new Date(),
      });

      return message;
    } catch (error) {
      console.error('Error sending Messenger text message:', error);
      throw new Error('Failed to send Messenger message');
    }
  }

  /**
   * Send template message
   */
  async sendTemplateMessage(
    recipientId: string,
    template: MessengerTemplate,
    organizationId: string
  ): Promise<MessengerMessage> {
    try {
      const messageData = {
        recipient: { id: recipientId },
        message: {
          attachment: {
            type: 'template',
            payload: template,
          },
        },
      };

      const response = await this.apiClient.post('/me/messages', messageData, {
        params: { access_token: this.pageAccessToken },
      });

      const message: MessengerMessage = {
        id: response.data.message_id,
        senderId: 'page',
        recipientId,
        message: { attachments: [{ type: 'file', payload: { url: '' } }] },
        timestamp: new Date(),
        organizationId,
      };

      await this.storeMessage(message);

      await realTimeSyncService.broadcastEvent({
        type: 'messenger_template_sent',
        entityId: message.id,
        entityType: 'messenger_message',
        organizationId,
        data: message,
        timestamp: new Date(),
      });

      return message;
    } catch (error) {
      console.error('Error sending Messenger template:', error);
      throw new Error('Failed to send Messenger template');
    }
  }

  /**
   * Send attachment
   */
  async sendAttachment(
    recipientId: string,
    attachmentType: 'image' | 'video' | 'audio' | 'file',
    url: string,
    organizationId: string
  ): Promise<MessengerMessage> {
    try {
      const messageData = {
        recipient: { id: recipientId },
        message: {
          attachment: {
            type: attachmentType,
            payload: { url },
          },
        },
      };

      const response = await this.apiClient.post('/me/messages', messageData, {
        params: { access_token: this.pageAccessToken },
      });

      const message: MessengerMessage = {
        id: response.data.message_id,
        senderId: 'page',
        recipientId,
        message: {
          attachments: [{
            type: attachmentType,
            payload: { url },
          }],
        },
        timestamp: new Date(),
        organizationId,
      };

      await this.storeMessage(message);

      await realTimeSyncService.broadcastEvent({
        type: 'messenger_attachment_sent',
        entityId: message.id,
        entityType: 'messenger_message',
        organizationId,
        data: message,
        timestamp: new Date(),
      });

      return message;
    } catch (error) {
      console.error('Error sending Messenger attachment:', error);
      throw new Error('Failed to send Messenger attachment');
    }
  }

  /**
   * Get user profile
   */
  async getUserProfile(userId: string): Promise<MessengerProfile | null> {
    try {
      const response = await this.apiClient.get(`/${userId}`, {
        params: {
          fields: 'first_name,last_name,profile_pic,locale,timezone,gender',
          access_token: this.pageAccessToken,
        },
      });

      return response.data;
    } catch (error) {
      console.error('Error getting user profile:', error);
      return null;
    }
  }

  /**
   * Set typing indicator
   */
  async setTypingIndicator(recipientId: string, action: 'typing_on' | 'typing_off'): Promise<void> {
    try {
      await this.apiClient.post('/me/messages', {
        recipient: { id: recipientId },
        sender_action: action,
      }, {
        params: { access_token: this.pageAccessToken },
      });
    } catch (error) {
      console.error('Error setting typing indicator:', error);
    }
  }

  /**
   * Mark message as seen
   */
  async markSeen(recipientId: string): Promise<void> {
    try {
      await this.apiClient.post('/me/messages', {
        recipient: { id: recipientId },
        sender_action: 'mark_seen',
      }, {
        params: { access_token: this.pageAccessToken },
      });
    } catch (error) {
      console.error('Error marking message as seen:', error);
    }
  }

  /**
   * Set persistent menu
   */
  async setPersistentMenu(menuItems: Array<{
    type: 'web_url' | 'postback';
    title: string;
    url?: string;
    payload?: string;
  }>): Promise<void> {
    try {
      await this.apiClient.post('/me/messenger_profile', {
        persistent_menu: [{
          locale: 'default',
          composer_input_disabled: false,
          call_to_actions: menuItems,
        }],
      }, {
        params: { access_token: this.pageAccessToken },
      });
    } catch (error) {
      console.error('Error setting persistent menu:', error);
      throw new Error('Failed to set persistent menu');
    }
  }

  /**
   * Set greeting text
   */
  async setGreeting(text: string): Promise<void> {
    try {
      await this.apiClient.post('/me/messenger_profile', {
        greeting: [{
          locale: 'default',
          text,
        }],
      }, {
        params: { access_token: this.pageAccessToken },
      });
    } catch (error) {
      console.error('Error setting greeting:', error);
      throw new Error('Failed to set greeting');
    }
  }

  /**
   * Set get started button
   */
  async setGetStartedButton(payload: string): Promise<void> {
    try {
      await this.apiClient.post('/me/messenger_profile', {
        get_started: { payload },
      }, {
        params: { access_token: this.pageAccessToken },
      });
    } catch (error) {
      console.error('Error setting get started button:', error);
      throw new Error('Failed to set get started button');
    }
  }

  /**
   * Handle webhook verification
   */
  verifyWebhook(mode: string, token: string, challenge: string): string | null {
    if (mode === 'subscribe' && token === this.verifyToken) {
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

      const entries: MessengerWebhookEntry[] = body.entry || [];

      for (const entry of entries) {
        for (const messagingEvent of entry.messaging) {
          await this.processMessagingEvent(messagingEvent, entry.id);
        }
      }
    } catch (error) {
      console.error('Error handling Messenger webhook:', error);
      throw error;
    }
  }

  private verifyWebhookSignature(body: any, signature: string): boolean {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', this.appSecret)
        .update(JSON.stringify(body))
        .digest('hex');

      return signature === `sha256=${expectedSignature}`;
    } catch (error) {
      console.error('Error verifying webhook signature:', error);
      return false;
    }
  }

  private async processMessagingEvent(event: any, pageId: string): Promise<void> {
    try {
      const senderId = event.sender.id;
      const recipientId = event.recipient.id;

      // Determine organization from page ID
      const integration = await prisma.messengerIntegration.findFirst({
        where: { pageId },
      });

      if (!integration) {
        console.warn(`No integration found for page ID: ${pageId}`);
        return;
      }

      const organizationId = integration.organizationId;

      if (event.message) {
        await this.processIncomingMessage(event, organizationId);
      } else if (event.postback) {
        await this.processPostback(event, organizationId);
      } else if (event.delivery) {
        await this.processDeliveryReceipt(event, organizationId);
      } else if (event.read) {
        await this.processReadReceipt(event, organizationId);
      }
    } catch (error) {
      console.error('Error processing messaging event:', error);
    }
  }

  private async processIncomingMessage(event: any, organizationId: string): Promise<void> {
    try {
      const message: MessengerMessage = {
        id: event.message.mid,
        senderId: event.sender.id,
        recipientId: event.recipient.id,
        message: {
          text: event.message.text,
          attachments: event.message.attachments || [],
        },
        timestamp: new Date(event.timestamp),
        organizationId,
      };

      // Store message
      await this.storeMessage(message);

      // Process auto-replies
      await this.processAutoReply(message);

      // Broadcast real-time event
      await realTimeSyncService.broadcastEvent({
        type: 'messenger_message_received',
        entityId: message.id,
        entityType: 'messenger_message',
        organizationId,
        data: message,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('Error processing incoming message:', error);
    }
  }

  private async processPostback(event: any, organizationId: string): Promise<void> {
    try {
      const senderId = event.sender.id;
      const payload = event.postback.payload;
      const title = event.postback.title;

      // Handle different postback payloads
      switch (payload) {
        case 'GET_STARTED':
          await this.handleGetStarted(senderId, organizationId);
          break;
        case 'VIEW_CATALOG':
          await this.sendCatalog(senderId, organizationId);
          break;
        case 'CONTACT_SUPPORT':
          await this.handleContactSupport(senderId, organizationId);
          break;
        case 'TRACK_ORDER':
          await this.handleTrackOrder(senderId, organizationId);
          break;
        default:
          // Handle custom payloads
          await this.handleCustomPostback(senderId, payload, title, organizationId);
      }
    } catch (error) {
      console.error('Error processing postback:', error);
    }
  }

  private async processDeliveryReceipt(event: any, organizationId: string): Promise<void> {
    try {
      // Update message delivery status
      await prisma.messengerMessage.updateMany({
        where: {
          messageId: { in: event.delivery.mids },
          organizationId,
        },
        data: {
          deliveredAt: new Date(event.delivery.watermark),
        },
      });
    } catch (error) {
      console.error('Error processing delivery receipt:', error);
    }
  }

  private async processReadReceipt(event: any, organizationId: string): Promise<void> {
    try {
      // Update message read status
      await prisma.messengerMessage.updateMany({
        where: {
          senderId: event.recipient.id,
          recipientId: event.sender.id,
          timestamp: { lte: new Date(event.read.watermark) },
          organizationId,
        },
        data: {
          readAt: new Date(event.read.watermark),
        },
      });
    } catch (error) {
      console.error('Error processing read receipt:', error);
    }
  }

  private async processAutoReply(message: MessengerMessage): Promise<void> {
    try {
      const messageText = message.message.text?.toLowerCase() || '';

      if (messageText.includes('hello') || messageText.includes('hi')) {
        await this.sendTextMessage(
          message.senderId,
          'Hello! Welcome to SmartStore AI. How can I help you today?',
          message.organizationId,
          [
            { title: '📦 View Products', payload: 'VIEW_CATALOG' },
            { title: '📞 Contact Support', payload: 'CONTACT_SUPPORT' },
            { title: '🚚 Track Order', payload: 'TRACK_ORDER' },
          ]
        );
      } else if (messageText.includes('catalog') || messageText.includes('products')) {
        await this.sendCatalog(message.senderId, message.organizationId);
      } else if (messageText.includes('help') || messageText.includes('support')) {
        await this.handleContactSupport(message.senderId, message.organizationId);
      }
    } catch (error) {
      console.error('Error processing auto-reply:', error);
    }
  }

  private async handleGetStarted(senderId: string, organizationId: string): Promise<void> {
    const welcomeMessage = `🎉 Welcome to SmartStore AI!

We're excited to help you with:
• Product browsing and purchasing
• Order tracking and support
• Personalized recommendations
• Customer service

What would you like to do today?`;

    await this.sendTextMessage(senderId, welcomeMessage, organizationId, [
      { title: '🛍️ Browse Products', payload: 'VIEW_CATALOG' },
      { title: '📦 Track My Order', payload: 'TRACK_ORDER' },
      { title: '💬 Get Help', payload: 'CONTACT_SUPPORT' },
    ]);
  }

  private async sendCatalog(senderId: string, organizationId: string): Promise<void> {
    try {
      // Get featured products
      const products = await prisma.product.findMany({
        where: {
          organizationId,
          isActive: true,
          isFeatured: true,
        },
        take: 10,
        include: {
          images: true,
        },
      });

      if (products.length === 0) {
        await this.sendTextMessage(
          senderId,
          'Sorry, no products are currently available. Please check back later!',
          organizationId
        );
        return;
      }

      const elements = products.slice(0, 10).map(product => ({
        title: product.name,
        subtitle: product.description || `Price: $${product.price}`,
        image_url: product.images[0]?.url || '',
        default_action: {
          type: 'web_url' as const,
          url: `${process.env.NEXTAUTH_URL}/products/${product.id}`,
        },
        buttons: [
          {
            type: 'web_url' as const,
            title: 'View Details',
            url: `${process.env.NEXTAUTH_URL}/products/${product.id}`,
          },
          {
            type: 'postback' as const,
            title: 'Add to Cart',
            payload: `ADD_TO_CART_${product.id}`,
          },
        ],
      }));

      const template: MessengerTemplate = {
        template_type: 'generic',
        elements,
      };

      await this.sendTemplateMessage(senderId, template, organizationId);
    } catch (error) {
      console.error('Error sending catalog:', error);
      await this.sendTextMessage(
        senderId,
        'Sorry, I encountered an error while fetching our product catalog. Please try again later.',
        organizationId
      );
    }
  }

  private async handleContactSupport(senderId: string, organizationId: string): Promise<void> {
    const supportMessage = `🛠️ **Customer Support**

Our support team is here to help! You can:

• Chat with us right here
• Visit our help center
• Call our support line
• Email us directly

How would you prefer to get help?`;

    await this.sendTextMessage(senderId, supportMessage, organizationId, [
      { title: '💬 Chat Now', payload: 'START_CHAT' },
      { title: '🌐 Help Center', payload: 'HELP_CENTER' },
      { title: '📞 Call Support', payload: 'CALL_SUPPORT' },
    ]);
  }

  private async handleTrackOrder(senderId: string, organizationId: string): Promise<void> {
    await this.sendTextMessage(
      senderId,
      '📦 **Order Tracking**\n\nPlease provide your order number to track your shipment, or click below to view all your orders.',
      organizationId,
      [
        { title: '📋 View All Orders', payload: 'VIEW_ORDERS' },
        { title: '🔍 Enter Order Number', payload: 'ENTER_ORDER_ID' },
      ]
    );
  }

  private async handleCustomPostback(
    senderId: string,
    payload: string,
    title: string,
    organizationId: string
  ): Promise<void> {
    // Handle custom business logic based on payload
    if (payload.startsWith('ADD_TO_CART_')) {
      const productId = payload.replace('ADD_TO_CART_', '');
      await this.handleAddToCart(senderId, productId, organizationId);
    } else if (payload === 'START_CHAT') {
      await this.handleStartChat(senderId, organizationId);
    } else {
      // Default response for unhandled payloads
      await this.sendTextMessage(
        senderId,
        `Thanks for your interest in "${title}". Our team will get back to you soon!`,
        organizationId
      );
    }
  }

  private async handleAddToCart(senderId: string, productId: string, organizationId: string): Promise<void> {
    try {
      const product = await prisma.product.findFirst({
        where: { id: productId, organizationId },
      });

      if (!product) {
        await this.sendTextMessage(
          senderId,
          'Sorry, this product is no longer available.',
          organizationId
        );
        return;
      }

      // In a real implementation, you would add to cart here
      await this.sendTextMessage(
        senderId,
        `✅ ${product.name} has been added to your cart!\n\nReady to checkout?`,
        organizationId,
        [
          { title: '🛒 View Cart', payload: 'VIEW_CART' },
          { title: '💳 Checkout', payload: 'CHECKOUT' },
          { title: '🛍️ Continue Shopping', payload: 'VIEW_CATALOG' },
        ]
      );
    } catch (error) {
      console.error('Error handling add to cart:', error);
      await this.sendTextMessage(
        senderId,
        'Sorry, I encountered an error. Please try again.',
        organizationId
      );
    }
  }

  private async handleStartChat(senderId: string, organizationId: string): Promise<void> {
    // Create a support ticket
    await prisma.supportTicket.create({
      data: {
        customerId: senderId,
        source: 'MESSENGER',
        status: 'OPEN',
        priority: 'MEDIUM',
        subject: 'Customer initiated chat',
        organizationId,
      },
    });

    await this.sendTextMessage(
      senderId,
      '👋 You\'re now connected with our support team! Please describe how we can help you.',
      organizationId
    );
  }

  private async storeMessage(message: MessengerMessage): Promise<void> {
    try {
      await prisma.messengerMessage.create({
        data: {
          messageId: message.id,
          senderId: message.senderId,
          recipientId: message.recipientId,
          content: message.message,
          timestamp: message.timestamp,
          organizationId: message.organizationId,
          conversationId: message.conversationId,
        },
      });
    } catch (error) {
      console.error('Error storing Messenger message:', error);
    }
  }

  /**
   * Send transactional messages
   */
  async sendOrderConfirmation(orderId: string, customerId: string, organizationId: string): Promise<void> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: true } } },
    });

    if (!order) return;

    const template: MessengerTemplate = {
      template_type: 'receipt',
      elements: [{
        title: `Order #${order.id}`,
        subtitle: `Total: $${order.total}`,
        buttons: [
          {
            type: 'web_url',
            title: 'View Order',
            url: `${process.env.NEXTAUTH_URL}/orders/${order.id}`,
          },
        ],
      }],
    };

    await this.sendTemplateMessage(customerId, template, organizationId);
  }

  async sendShippingUpdate(orderId: string, trackingNumber: string, organizationId: string): Promise<void> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true },
    });

    if (!order || !order.customer.messengerId) return;

    await this.sendTextMessage(
      order.customer.messengerId,
      `📦 Your order #${order.id} has shipped!\n\nTracking: ${trackingNumber}\n\nTrack your package: ${process.env.TRACKING_URL}/${trackingNumber}`,
      organizationId,
      [
        { title: '📱 Track Package', payload: `TRACK_${trackingNumber}` },
        { title: '📞 Contact Support', payload: 'CONTACT_SUPPORT' },
      ]
    );
  }
}

export const messengerService = new MessengerService();
