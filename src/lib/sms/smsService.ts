import twilio from 'twilio';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { prisma } from '@/lib/prisma';

// Initialize Twilio
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

// Initialize AWS SNS
const snsClient = new SNSClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export interface SMSOptions {
  to: string;
  message: string;
  from?: string;
  mediaUrl?: string[];
  scheduledTime?: Date;
  campaignId?: string;
}

export interface BulkSMSOptions {
  recipients: Array<{
    phone: string;
    message: string;
    variables?: Record<string, any>;
  }>;
  from?: string;
  scheduledTime?: Date;
  campaignId?: string;
}

export interface SMSTemplate {
  id: string;
  name: string;
  content: string;
  variables: string[];
}

export interface SMSAnalytics {
  sent: number;
  delivered: number;
  failed: number;
  clicked: number;
  deliveryRate: number;
  clickRate: number;
}

export class SMSService {
  private provider: 'twilio' | 'aws-sns' = 'twilio';

  constructor() {
    this.provider = (process.env.SMS_PROVIDER as 'twilio' | 'aws-sns') || 'twilio';
  }

  /**
   * Send a single SMS
   */
  async sendSMS(options: SMSOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      // Log SMS in database
      const smsLog = await prisma.smsLog.create({
        data: {
          to: options.to,
          message: options.message,
          from: options.from || process.env.SMS_FROM_NUMBER!,
          status: 'PENDING',
          campaignId: options.campaignId,
          scheduledTime: options.scheduledTime,
        },
      });

      let result;
      if (this.provider === 'twilio') {
        result = await this.sendWithTwilio(options);
      } else {
        result = await this.sendWithAWSSNS(options);
      }

      // Update SMS log with result
      await prisma.smsLog.update({
        where: { id: smsLog.id },
        data: {
          status: result.success ? 'SENT' : 'FAILED',
          messageId: result.messageId,
          error: result.error,
          sentAt: result.success ? new Date() : undefined,
        },
      });

      return result;
    } catch (error) {
      console.error('Error sending SMS:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private async sendWithTwilio(options: SMSOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const messageOptions: any = {
      body: options.message,
      from: options.from || process.env.TWILIO_PHONE_NUMBER!,
      to: this.formatPhoneNumber(options.to),
    };

    if (options.mediaUrl && options.mediaUrl.length > 0) {
      messageOptions.mediaUrl = options.mediaUrl;
    }

    if (options.scheduledTime) {
      messageOptions.scheduleType = 'fixed';
      messageOptions.sendAt = options.scheduledTime;
    }

    const message = await twilioClient.messages.create(messageOptions);

    return {
      success: true,
      messageId: message.sid,
    };
  }

  private async sendWithAWSSNS(options: SMSOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const command = new PublishCommand({
      Message: options.message,
      PhoneNumber: this.formatPhoneNumber(options.to),
      MessageAttributes: {
        'AWS.SNS.SMS.SenderID': {
          DataType: 'String',
          StringValue: process.env.SMS_SENDER_ID || 'SmartStore',
        },
        'AWS.SNS.SMS.SMSType': {
          DataType: 'String',
          StringValue: 'Transactional',
        },
      },
    });

    const response = await snsClient.send(command);

    return {
      success: true,
      messageId: response.MessageId,
    };
  }

  /**
   * Send bulk SMS messages
   */
  async sendBulkSMS(options: BulkSMSOptions): Promise<{ success: boolean; results: any[]; error?: string }> {
    try {
      const results = [];

      for (const recipient of options.recipients) {
        const result = await this.sendSMS({
          to: recipient.phone,
          message: this.processTemplate(recipient.message, recipient.variables || {}),
          from: options.from,
          scheduledTime: options.scheduledTime,
          campaignId: options.campaignId,
        });

        results.push({
          phone: recipient.phone,
          ...result,
        });

        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      return {
        success: true,
        results,
      };
    } catch (error) {
      console.error('Error sending bulk SMS:', error);
      return { success: false, results: [], error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Create SMS template
   */
  async createTemplate(template: Omit<SMSTemplate, 'id'>): Promise<SMSTemplate> {
    try {
      const createdTemplate = await prisma.smsTemplate.create({
        data: {
          name: template.name,
          content: template.content,
          variables: template.variables,
        },
      });

      return {
        id: createdTemplate.id,
        name: createdTemplate.name,
        content: createdTemplate.content,
        variables: createdTemplate.variables,
      };
    } catch (error) {
      console.error('Error creating SMS template:', error);
      throw new Error('Failed to create SMS template');
    }
  }

  /**
   * Send transactional SMS messages
   */
  async sendOrderConfirmation(orderId: string, customerPhone: string): Promise<void> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    const message = `Hi ${order.customer.name}! Your order #${order.id} has been confirmed. Total: $${order.total}. Track your order at: ${process.env.NEXTAUTH_URL}/orders/${order.id}`;

    await this.sendSMS({
      to: customerPhone,
      message,
    });
  }

  async sendShippingNotification(orderId: string, trackingNumber: string): Promise<void> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    const message = `Your order #${order.id} has shipped! Track it with: ${trackingNumber} at ${process.env.TRACKING_URL}/${trackingNumber}`;

    await this.sendSMS({
      to: order.customer.phone || '',
      message,
    });
  }

  async sendDeliveryNotification(orderId: string): Promise<void> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    const message = `Great news! Your order #${order.id} has been delivered. Thank you for choosing SmartStore AI!`;

    await this.sendSMS({
      to: order.customer.phone || '',
      message,
    });
  }

  async sendOTPCode(phone: string, code: string): Promise<void> {
    const message = `Your SmartStore AI verification code is: ${code}. This code expires in 5 minutes.`;

    await this.sendSMS({
      to: phone,
      message,
    });
  }

  async sendPasswordReset(phone: string, resetCode: string): Promise<void> {
    const message = `Your password reset code is: ${resetCode}. Use this code to reset your SmartStore AI password. Expires in 10 minutes.`;

    await this.sendSMS({
      to: phone,
      message,
    });
  }

  async sendLowStockAlert(productName: string, currentStock: number, adminPhones: string[]): Promise<void> {
    const message = `⚠️ LOW STOCK ALERT: ${productName} has only ${currentStock} units remaining. Please restock soon.`;

    for (const phone of adminPhones) {
      await this.sendSMS({
        to: phone,
        message,
      });
    }
  }

  async sendPaymentReminder(orderId: string, amount: number, customerPhone: string): Promise<void> {
    const message = `Payment reminder: Your order #${orderId} payment of $${amount} is due. Pay now at: ${process.env.NEXTAUTH_URL}/orders/${orderId}/pay`;

    await this.sendSMS({
      to: customerPhone,
      message,
    });
  }

  /**
   * Send marketing SMS campaigns
   */
  async sendCampaign(campaignId: string): Promise<{ success: boolean; recipientCount: number }> {
    try {
      const campaign = await prisma.smsCampaign.findUnique({
        where: { id: campaignId },
        include: {
          template: true,
          segments: {
            include: {
              subscriptions: {
                where: { isActive: true },
              },
            },
          },
        },
      });

      if (!campaign) {
        throw new Error('Campaign not found');
      }

      const recipients = campaign.segments.flatMap(segment => 
        segment.subscriptions.map(sub => ({
          phone: sub.phone,
          message: campaign.template.content,
          variables: sub.customFields || {},
        }))
      );

      const result = await this.sendBulkSMS({
        recipients,
        campaignId,
        scheduledTime: campaign.scheduledTime,
      });

      // Update campaign status
      await prisma.smsCampaign.update({
        where: { id: campaignId },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          recipientCount: recipients.length,
        },
      });

      return {
        success: result.success,
        recipientCount: recipients.length,
      };
    } catch (error) {
      console.error('Error sending SMS campaign:', error);
      throw new Error('Failed to send SMS campaign');
    }
  }

  /**
   * Handle incoming SMS messages (webhooks)
   */
  async handleIncomingMessage(from: string, body: string, messageId: string): Promise<void> {
    try {
      // Log incoming message
      await prisma.smsLog.create({
        data: {
          to: process.env.TWILIO_PHONE_NUMBER!,
          from,
          message: body,
          messageId,
          status: 'RECEIVED',
          receivedAt: new Date(),
        },
      });

      // Process auto-replies
      await this.processAutoReply(from, body.toLowerCase().trim());

      // Trigger customer service workflow if needed
      if (this.isCustomerServiceKeyword(body.toLowerCase())) {
        await this.triggerCustomerServiceWorkflow(from, body);
      }
    } catch (error) {
      console.error('Error handling incoming SMS:', error);
    }
  }

  private async processAutoReply(phone: string, message: string): Promise<void> {
    const autoReplies = [
      { keywords: ['stop', 'unsubscribe'], reply: 'You have been unsubscribed from SMS notifications. Reply START to re-subscribe.' },
      { keywords: ['start', 'subscribe'], reply: 'You have been subscribed to SMS notifications. Reply STOP to unsubscribe.' },
      { keywords: ['help', 'info'], reply: 'SmartStore AI Support. For help, visit our website or call customer service.' },
      { keywords: ['status', 'order'], reply: 'To check your order status, please visit our website or provide your order number.' },
    ];

    for (const autoReply of autoReplies) {
      if (autoReply.keywords.some(keyword => message.includes(keyword))) {
        await this.sendSMS({
          to: phone,
          message: autoReply.reply,
        });
        break;
      }
    }
  }

  private isCustomerServiceKeyword(message: string): boolean {
    const serviceKeywords = ['help', 'support', 'problem', 'issue', 'complaint', 'refund', 'return'];
    return serviceKeywords.some(keyword => message.includes(keyword));
  }

  private async triggerCustomerServiceWorkflow(phone: string, message: string): Promise<void> {
    // Create a customer service ticket
    await prisma.supportTicket.create({
      data: {
        phone,
        message,
        source: 'SMS',
        status: 'OPEN',
        priority: 'MEDIUM',
      },
    });

    // Send acknowledgment
    await this.sendSMS({
      to: phone,
      message: 'Thank you for contacting us. A support representative will respond to your inquiry soon.',
    });
  }

  /**
   * Get SMS analytics
   */
  async getAnalytics(startDate: Date, endDate: Date): Promise<SMSAnalytics> {
    try {
      const logs = await prisma.smsLog.findMany({
        where: {
          sentAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      });

      const sent = logs.filter(log => log.status === 'SENT').length;
      const delivered = logs.filter(log => log.status === 'DELIVERED').length;
      const failed = logs.filter(log => log.status === 'FAILED').length;
      const clicked = logs.filter(log => log.clicked).length;

      return {
        sent,
        delivered,
        failed,
        clicked,
        deliveryRate: sent > 0 ? (delivered / sent) * 100 : 0,
        clickRate: sent > 0 ? (clicked / sent) * 100 : 0,
      };
    } catch (error) {
      console.error('Error getting SMS analytics:', error);
      throw new Error('Failed to get SMS analytics');
    }
  }

  /**
   * Manage SMS subscriptions
   */
  async addToSMSList(phone: string, listId: string, customFields?: Record<string, any>): Promise<void> {
    try {
      await prisma.smsSubscription.upsert({
        where: {
          phone_listId: {
            phone,
            listId,
          },
        },
        update: {
          isActive: true,
          customFields,
          updatedAt: new Date(),
        },
        create: {
          phone,
          listId,
          isActive: true,
          customFields,
        },
      });
    } catch (error) {
      console.error('Error adding to SMS list:', error);
      throw new Error('Failed to add to SMS list');
    }
  }

  async removeFromSMSList(phone: string, listId: string): Promise<void> {
    try {
      await prisma.smsSubscription.updateMany({
        where: { phone, listId },
        data: { isActive: false },
      });
    } catch (error) {
      console.error('Error removing from SMS list:', error);
      throw new Error('Failed to remove from SMS list');
    }
  }

  /**
   * Utility functions
   */
  private formatPhoneNumber(phone: string): string {
    // Remove all non-numeric characters
    const cleaned = phone.replace(/\D/g, '');
    
    // Add country code if not present
    if (cleaned.length === 10) {
      return `+1${cleaned}`; // Default to US
    } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+${cleaned}`;
    } else if (!cleaned.startsWith('+')) {
      return `+${cleaned}`;
    }
    
    return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
  }

  private processTemplate(template: string, variables: Record<string, any>): string {
    let processed = template;
    
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      processed = processed.replace(new RegExp(placeholder, 'g'), String(value));
    }
    
    return processed;
  }

  /**
   * Check delivery status
   */
  async checkDeliveryStatus(messageId: string): Promise<string> {
    try {
      if (this.provider === 'twilio') {
        const message = await twilioClient.messages(messageId).fetch();
        return message.status;
      } else {
        // AWS SNS doesn't provide delivery status directly
        // You would need to use CloudWatch or delivery status logs
        return 'unknown';
      }
    } catch (error) {
      console.error('Error checking delivery status:', error);
      return 'error';
    }
  }
}

export const smsService = new SMSService();
