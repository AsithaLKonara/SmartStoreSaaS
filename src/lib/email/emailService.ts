import sgMail from '@sendgrid/mail';
import { SESClient, SendEmailCommand, SendBulkTemplatedEmailCommand } from '@aws-sdk/client-ses';
import { prisma } from '@/lib/prisma';

// Initialize SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

// Initialize AWS SES
const sesClient = new SESClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  variables: string[];
}

export interface EmailOptions {
  to: string | string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  html?: string;
  text?: string;
  templateId?: string;
  templateData?: Record<string, any>;
  attachments?: Array<{
    filename: string;
    content: string;
    type?: string;
    disposition?: string;
  }>;
  replyTo?: string;
  from?: {
    email: string;
    name?: string;
  };
}

export interface BulkEmailOptions {
  templateId: string;
  from: {
    email: string;
    name?: string;
  };
  recipients: Array<{
    email: string;
    templateData: Record<string, any>;
  }>;
  subject: string;
  replyTo?: string;
}

export interface EmailAnalytics {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  unsubscribed: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
}

export class EmailService {
  private provider: 'sendgrid' | 'ses' = 'sendgrid';

  constructor() {
    this.provider = (process.env.EMAIL_PROVIDER as 'sendgrid' | 'ses') || 'sendgrid';
  }

  /**
   * Send a single email
   */
  async sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      if (this.provider === 'sendgrid') {
        return await this.sendWithSendGrid(options);
      } else {
        return await this.sendWithSES(options);
      }
    } catch (error) {
      console.error('Error sending email:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private async sendWithSendGrid(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const msg: any = {
      to: Array.isArray(options.to) ? options.to : [options.to],
      from: options.from || {
        email: process.env.FROM_EMAIL!,
        name: process.env.FROM_NAME || 'SmartStore AI',
      },
      subject: options.subject,
      html: options.html,
      text: options.text,
      replyTo: options.replyTo,
    };

    if (options.cc) msg.cc = options.cc;
    if (options.bcc) msg.bcc = options.bcc;
    if (options.attachments) msg.attachments = options.attachments;

    if (options.templateId && options.templateData) {
      msg.templateId = options.templateId;
      msg.dynamicTemplateData = options.templateData;
      delete msg.html;
      delete msg.text;
    }

    const response = await sgMail.send(msg);
    return {
      success: true,
      messageId: response[0].headers['x-message-id'],
    };
  }

  private async sendWithSES(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const destinations = Array.isArray(options.to) ? options.to : [options.to];
    
    const command = new SendEmailCommand({
      Source: options.from?.email || process.env.FROM_EMAIL!,
      Destination: {
        ToAddresses: destinations,
        CcAddresses: options.cc,
        BccAddresses: options.bcc,
      },
      Message: {
        Subject: {
          Data: options.subject,
          Charset: 'UTF-8',
        },
        Body: {
          Html: options.html ? {
            Data: options.html,
            Charset: 'UTF-8',
          } : undefined,
          Text: options.text ? {
            Data: options.text,
            Charset: 'UTF-8',
          } : undefined,
        },
      },
      ReplyToAddresses: options.replyTo ? [options.replyTo] : undefined,
    });

    const response = await sesClient.send(command);
    return {
      success: true,
      messageId: response.MessageId,
    };
  }

  /**
   * Send bulk emails using templates
   */
  async sendBulkEmail(options: BulkEmailOptions): Promise<{ success: boolean; results: any[]; error?: string }> {
    try {
      if (this.provider === 'sendgrid') {
        return await this.sendBulkWithSendGrid(options);
      } else {
        return await this.sendBulkWithSES(options);
      }
    } catch (error) {
      console.error('Error sending bulk email:', error);
      return { success: false, results: [], error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private async sendBulkWithSendGrid(options: BulkEmailOptions): Promise<{ success: boolean; results: any[] }> {
    const msg = {
      from: options.from,
      templateId: options.templateId,
      personalizations: options.recipients.map(recipient => ({
        to: [{ email: recipient.email }],
        dynamicTemplateData: recipient.templateData,
      })),
      replyTo: options.replyTo,
    };

    const response = await sgMail.sendMultiple(msg);
    return {
      success: true,
      results: response,
    };
  }

  private async sendBulkWithSES(options: BulkEmailOptions): Promise<{ success: boolean; results: any[] }> {
    const command = new SendBulkTemplatedEmailCommand({
      Source: options.from.email,
      Template: options.templateId,
      DefaultTemplateData: JSON.stringify({}),
      Destinations: options.recipients.map(recipient => ({
        Destination: {
          ToAddresses: [recipient.email],
        },
        ReplacementTemplateData: JSON.stringify(recipient.templateData),
      })),
      ReplyToAddresses: options.replyTo ? [options.replyTo] : undefined,
    });

    const response = await sesClient.send(command);
    return {
      success: true,
      results: response.MessageId ? [response.MessageId] : [],
    };
  }

  /**
   * Create email template
   */
  async createTemplate(template: Omit<EmailTemplate, 'id'>): Promise<EmailTemplate> {
    try {
      const createdTemplate = await prisma.emailTemplate.create({
        data: {
          name: template.name,
          subject: template.subject,
          htmlContent: template.htmlContent,
          textContent: template.textContent,
          variables: template.variables,
        },
      });

      // Create template in email service provider
      if (this.provider === 'sendgrid') {
        await this.createSendGridTemplate(createdTemplate);
      } else {
        await this.createSESTemplate(createdTemplate);
      }

      return {
        id: createdTemplate.id,
        name: createdTemplate.name,
        subject: createdTemplate.subject,
        htmlContent: createdTemplate.htmlContent,
        textContent: createdTemplate.textContent,
        variables: createdTemplate.variables,
      };
    } catch (error) {
      console.error('Error creating email template:', error);
      throw new Error('Failed to create email template');
    }
  }

  private async createSendGridTemplate(template: any): Promise<void> {
    // SendGrid template creation logic
    const templateData = {
      name: template.name,
      generation: 'dynamic',
    };

    // This would require additional SendGrid API calls
    console.log('Creating SendGrid template:', templateData);
  }

  private async createSESTemplate(template: any): Promise<void> {
    // AWS SES template creation logic
    const templateData = {
      TemplateName: template.id,
      TemplateData: {
        SubjectPart: template.subject,
        HtmlPart: template.htmlContent,
        TextPart: template.textContent,
      },
    };

    console.log('Creating SES template:', templateData);
  }

  /**
   * Send transactional emails
   */
  async sendOrderConfirmation(orderId: string, customerEmail: string): Promise<void> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        customer: true,
      },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    const templateData = {
      customerName: order.customer.name,
      orderId: order.id,
      orderTotal: order.total,
      orderItems: order.items.map(item => ({
        name: item.product.name,
        quantity: item.quantity,
        price: item.price,
        total: item.quantity * item.price,
      })),
      orderDate: order.createdAt.toLocaleDateString(),
    };

    await this.sendEmail({
      to: customerEmail,
      subject: `Order Confirmation - #${order.id}`,
      templateId: 'order-confirmation',
      templateData,
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

    const templateData = {
      customerName: order.customer.name,
      orderId: order.id,
      trackingNumber,
      trackingUrl: `https://track.smartstore.ai/${trackingNumber}`,
    };

    await this.sendEmail({
      to: order.customer.email,
      subject: `Your order has shipped - #${order.id}`,
      templateId: 'shipping-notification',
      templateData,
    });
  }

  async sendPasswordReset(email: string, resetToken: string): Promise<void> {
    const resetUrl = `${process.env.NEXTAUTH_URL}/auth/reset-password?token=${resetToken}`;

    await this.sendEmail({
      to: email,
      subject: 'Reset your password',
      templateId: 'password-reset',
      templateData: {
        resetUrl,
        expiresIn: '1 hour',
      },
    });
  }

  async sendWelcomeEmail(email: string, name: string): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: 'Welcome to SmartStore AI!',
      templateId: 'welcome',
      templateData: {
        name,
        dashboardUrl: `${process.env.NEXTAUTH_URL}/dashboard`,
        supportEmail: process.env.SUPPORT_EMAIL || 'support@smartstore.ai',
      },
    });
  }

  async sendInvoice(orderId: string, invoicePdf: Buffer): Promise<void> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    await this.sendEmail({
      to: order.customer.email,
      subject: `Invoice for Order #${order.id}`,
      templateId: 'invoice',
      templateData: {
        customerName: order.customer.name,
        orderId: order.id,
        orderTotal: order.total,
      },
      attachments: [{
        filename: `invoice-${order.id}.pdf`,
        content: invoicePdf.toString('base64'),
        type: 'application/pdf',
        disposition: 'attachment',
      }],
    });
  }

  /**
   * Get email analytics
   */
  async getEmailAnalytics(startDate: Date, endDate: Date): Promise<EmailAnalytics> {
    try {
      // This would integrate with your email provider's analytics API
      // For now, returning mock data
      return {
        sent: 1250,
        delivered: 1200,
        opened: 480,
        clicked: 120,
        bounced: 25,
        unsubscribed: 5,
        openRate: 40.0,
        clickRate: 10.0,
        bounceRate: 2.1,
      };
    } catch (error) {
      console.error('Error getting email analytics:', error);
      throw new Error('Failed to get email analytics');
    }
  }

  /**
   * Manage email lists and subscriptions
   */
  async addToMailingList(email: string, listId: string, customFields?: Record<string, any>): Promise<void> {
    try {
      await prisma.emailSubscription.upsert({
        where: {
          email_listId: {
            email,
            listId,
          },
        },
        update: {
          isActive: true,
          customFields,
          updatedAt: new Date(),
        },
        create: {
          email,
          listId,
          isActive: true,
          customFields,
        },
      });
    } catch (error) {
      console.error('Error adding to mailing list:', error);
      throw new Error('Failed to add to mailing list');
    }
  }

  async removeFromMailingList(email: string, listId: string): Promise<void> {
    try {
      await prisma.emailSubscription.updateMany({
        where: { email, listId },
        data: { isActive: false },
      });
    } catch (error) {
      console.error('Error removing from mailing list:', error);
      throw new Error('Failed to remove from mailing list');
    }
  }

  /**
   * Send marketing campaigns
   */
  async sendCampaign(campaignId: string): Promise<{ success: boolean; recipientCount: number }> {
    try {
      const campaign = await prisma.emailCampaign.findUnique({
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
          email: sub.email,
          templateData: sub.customFields || {},
        }))
      );

      const result = await this.sendBulkEmail({
        templateId: campaign.template.id,
        from: {
          email: process.env.FROM_EMAIL!,
          name: process.env.FROM_NAME || 'SmartStore AI',
        },
        recipients,
        subject: campaign.subject,
      });

      // Update campaign status
      await prisma.emailCampaign.update({
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
      console.error('Error sending campaign:', error);
      throw new Error('Failed to send campaign');
    }
  }
}

export const emailService = new EmailService();
