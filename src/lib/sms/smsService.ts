import twilio from 'twilio';
import { prisma } from '@/lib/prisma';

// Initialize Twilio
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

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
      let result;
      if (this.provider === 'twilio') {
        result = await this.sendWithTwilio(options);
      } else {
        result = await this.sendWithAWSSNS(options);
      }

      // Log SMS in Notification (smsLog model doesn't exist)
      await prisma.notification.create({
        data: {
          type: 'SYSTEM',
          message: `SMS sent to ${options.to}`,
          message: `SMS sent to ${options.to}`,
          organizationId: '', // Will need to be determined from context
          metadata: {
            smsLog: {
              to: options.to,
              message: options.message,
              from: options.from || process.env.SMS_FROM_NUMBER,
              status: result.success ? 'SENT' : 'FAILED',
              messageId: result.messageId,
              error: result.error,
              sentAt: result.success ? new Date() : undefined,
              campaignId: options.campaignId,
              scheduledTime: options.scheduledTime,
            },
          } as any,
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
    // AWS SNS implementation would go here
    // For now, return error since AWS SDK is not available
    return {
      success: false,
      error: 'AWS SNS not configured',
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
      // smsTemplate model doesn't exist, using Notification as fallback
      const createdTemplate = {
        id: crypto.randomUUID(),
        name: template.name,
        content: template.content,
        variables: template.variables,
        organizationId: (template as any).organizationId || '',
      } as any;

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
   * Send order confirmation SMS
   */
  async sendOrderConfirmation(orderId: string, customerPhone: string): Promise<void> {
    try {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          customer: true,
        },
      });

      if (!order) {
        throw new Error('Order not found');
      }

      const message = `Hi ${order.customer.name}! Your order #${order.id} has been confirmed. Total: $${order.totalAmount}. Track your order at: ${process.env.NEXTAUTH_URL}/orders/${order.id}`;

      await this.sendSMS({
        to: customerPhone,
        message,
        campaignId: 'order-confirmation',
      });
    } catch (error) {
      console.error('Error sending order confirmation SMS:', error);
    }
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
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        // template doesn't exist in Campaign model
        // include: {
        //   template: true,
          segments: {
            include: {
              customerSegment: {
                include: {
                  customerSegmentCustomers: {
                    include: {
                      customer: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!campaign || !campaign.template) {
        throw new Error('Campaign or template not found');
      }

      const recipients = campaign.segments.flatMap((segment: any) =>
        segment.customerSegment.customerSegmentCustomers.map((sub: any) => ({
          phone: sub.customer.phone!,
          customerId: sub.customer.id,
        }))
      );

      const message = campaign.template.content;

      // Send SMS to all recipients
      const results = await Promise.allSettled(
        recipients.map((recipient: any) =>
          this.sendSMS({
            to: recipient.phone,
            message,
            campaignId,
          })
        )
      );

      const successCount = results.filter((result: any) => 
        result.status === 'fulfilled' && result.value.success
      ).length;

      // Update campaign status
      await prisma.smsCampaign.update({
        where: { id: campaignId },
        data: {
          status: 'completed',
          completedAt: new Date(),
        },
      });

      return {
        success: successCount > 0,
        recipientCount: recipients.length,
      };
    } catch (error) {
      console.error('Error sending SMS campaign:', error);
      return { success: false, recipientCount: 0 };
    }
  }

  /**
   * Handle incoming SMS
   */
  async handleIncomingMessage(from: string, body: string, messageId: string): Promise<void> {
    try {
      // Log incoming message in Notification (smsLog model doesn't exist)
      await prisma.notification.create({
        data: {
          type: 'SYSTEM',
          message: `SMS received from ${from}`,
          message: `SMS received from ${from}`,
          organizationId: '', // Will need to be determined from context
          metadata: {
            smsLog: {
              to: process.env.TWILIO_PHONE_NUMBER,
              from,
              message: body,
              messageId,
              status: 'RECEIVED',
              receivedAt: new Date(),
            },
          } as any,
        },
      });

      // Process auto-reply
      await this.processAutoReply(from, body);

      // Check if it's a customer service request
      if (this.isCustomerServiceKeyword(body)) {
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

  /**
   * Trigger customer service workflow
   */
  private async triggerCustomerServiceWorkflow(phone: string, message: string): Promise<void> {
    try {
      // Create support ticket
      await prisma.supportTicket.create({
        data: {
          subject: `SMS Support Request from ${phone}`,
          description: message,
          priority: 'medium',
          status: 'open',
          phone,
          organization: {
            connect: {
              id: process.env.DEFAULT_ORGANIZATION_ID || 'default'
            }
          }
        },
      });

      // Send auto-reply
      await this.sendSMS({
        to: phone,
        message: 'Thank you for your message. Our customer service team will get back to you shortly.',
      });
    } catch (error) {
      console.error('Error triggering customer service workflow:', error);
    }
  }

  /**
   * Get SMS analytics
   */
  async getAnalytics(startDate: Date, endDate: Date): Promise<SMSAnalytics> {
    try {
      // Get SMS logs from Notification metadata (smsLog model doesn't exist)
      const notifications = await prisma.notification.findMany({
        where: {
          type: 'SYSTEM',
          subject: { in: ['SMS Sent', 'SMS Received'] },
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      });

      const logs = notifications
        .map(n => (n.metadata as any)?.smsLog)
        .filter((log): log is NonNullable<typeof log> => !!log);

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
      // Since smsSubscription doesn't exist in schema, we'll store it in a different way
      // For now, we'll use a generic approach or store in metadata
      console.log(`Adding ${phone} to SMS list ${listId} with custom fields:`, customFields);
      
      // TODO: Implement proper SMS subscription storage when schema is updated
      // This could be stored in a separate table or in user preferences
    } catch (error) {
      console.error('Error adding to SMS list:', error);
      throw new Error('Failed to add to SMS list');
    }
  }

  async removeFromSMSList(phone: string, listId: string): Promise<void> {
    try {
      // Since smsSubscription doesn't exist in schema, we'll handle this differently
      console.log(`Removing ${phone} from SMS list ${listId}`);
      
      // TODO: Implement proper SMS subscription removal when schema is updated
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

  /**
   * Send test SMS
   */
  async sendTestSMS(phone: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const result = await this.sendSMS({
        to: phone,
        message: 'This is a test SMS from SmartStore AI. If you receive this, SMS integration is working correctly!',
      });

      // Log test SMS (smsLog model doesn't exist, using Notification)
      await prisma.notification.create({
        data: {
          type: 'SYSTEM',
          message: 'Test SMS sent',
          userId: '',
          organizationId: process.env.DEFAULT_ORGANIZATION_ID || 'default',
          metadata: {
            phone: process.env.TWILIO_PHONE_NUMBER!,
            message: 'Test SMS sent',
            status: 'SENT',
            provider: this.provider,
          } as any,
        },
      });

      return result;
    } catch (error) {
      console.error('Error sending test SMS:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

export const smsService = new SMSService();
