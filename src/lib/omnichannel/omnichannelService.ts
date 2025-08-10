import { prisma } from '@/lib/prisma';

export interface ChannelMessage {
  id: string;
  channel: string;
  message: string;
  timestamp: Date;
  isIncoming: boolean;
  status: string;
  metadata?: any;
}

export interface CustomerConversation {
  id: string;
  customerId: string;
  channel: string;
  messages: ChannelMessage[];
  status: string;
  assignedAgent?: string;
  priority: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface UnifiedInbox {
  conversations: CustomerConversation[];
  unreadCount: number;
  pendingCount: number;
  urgentCount: number;
}

export interface ChannelIntegration {
  channel: string;
  isActive: boolean;
  config: any;
  lastSync: Date;
}

export class OmnichannelService {
  async getUnifiedInbox(organizationId: string): Promise<UnifiedInbox> {
    const conversations = await prisma.customerConversation.findMany({
      where: { organizationId },
      include: {
        messages: {
          orderBy: { timestamp: 'desc' },
          take: 10
        },
        customer: true,
        assignedAgent: true
      },
      orderBy: { updatedAt: 'desc' }
    });

    const unreadCount = conversations.filter(c => 
      c.messages.some(m => !m.isIncoming && m.status === 'sent')
    ).length;

    const pendingCount = conversations.filter(c => c.status === 'pending').length;
    const urgentCount = conversations.filter(c => c.priority === 'urgent').length;

    return {
      conversations,
      unreadCount,
      pendingCount,
      urgentCount
    };
  }

  async getConversation(conversationId: string): Promise<CustomerConversation | null> {
    return await prisma.customerConversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { timestamp: 'asc' }
        },
        customer: true,
        assignedAgent: true
      }
    });
  }

  async sendMessage(conversationId: string, message: string, channel: string): Promise<ChannelMessage> {
    const conversation = await this.getConversation(conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    // Send message through appropriate channel
    const sentMessage = await this.sendToChannel(channel, conversation.customerId, message);

    // Save message to database
    const savedMessage = await prisma.channelMessage.create({
      data: {
        conversationId,
        channel,
        message,
        timestamp: new Date(),
        isIncoming: false,
        status: 'sent',
        metadata: sentMessage
      }
    });

    // Update conversation
    await prisma.customerConversation.update({
      where: { id: conversationId },
      data: { 
        status: 'active',
        updatedAt: new Date()
      }
    });

    return savedMessage;
  }

  async assignAgent(conversationId: string, agentId: string): Promise<void> {
    await prisma.customerConversation.update({
      where: { id: conversationId },
      data: { assignedAgentId: agentId }
    });
  }

  async updateConversationStatus(conversationId: string, status: string): Promise<void> {
    await prisma.customerConversation.update({
      where: { id: conversationId },
      data: { status }
    });
  }

  async addConversationTags(conversationId: string, tags: string[]): Promise<void> {
    const conversation = await prisma.customerConversation.findUnique({
      where: { id: conversationId }
    });

    if (!conversation) return;

    const updatedTags = [...new Set([...conversation.tags, ...tags])];
    
    await prisma.customerConversation.update({
      where: { id: conversationId },
      data: { tags: updatedTags }
    });
  }

  async getChannelIntegrations(organizationId: string): Promise<ChannelIntegration[]> {
    const integrations = await prisma.channelIntegration.findMany({
      where: { organizationId }
    });

    return integrations.map(integration => ({
      channel: integration.channel,
      isActive: integration.isActive,
      config: integration.config,
      lastSync: integration.lastSync
    }));
  }

  async updateChannelIntegration(organizationId: string, channel: string, config: any): Promise<void> {
    await prisma.channelIntegration.upsert({
      where: { 
        organizationId_channel: { organizationId, channel }
      },
      update: { 
        config,
        lastSync: new Date()
      },
      create: {
        organizationId,
        channel,
        config,
        isActive: true,
        lastSync: new Date()
      }
    });
  }

  async syncChannelMessages(organizationId: string, channel: string): Promise<void> {
    // Sync messages from external channel
    const integration = await prisma.channelIntegration.findUnique({
      where: { organizationId_channel: { organizationId, channel } }
    });

    if (!integration || !integration.isActive) {
      throw new Error(`Channel ${channel} not configured or inactive`);
    }

    // Fetch new messages from channel
    const newMessages = await this.fetchChannelMessages(channel, integration.config);

    // Process and save messages
    for (const message of newMessages) {
      await this.processIncomingMessage(organizationId, channel, message);
    }

    // Update last sync time
    await prisma.channelIntegration.update({
      where: { id: integration.id },
      data: { lastSync: new Date() }
    });
  }

  async getCustomerHistory(customerId: string): Promise<CustomerConversation[]> {
    return await prisma.customerConversation.findMany({
      where: { customerId },
      include: {
        messages: {
          orderBy: { timestamp: 'desc' },
          take: 5
        }
      },
      orderBy: { updatedAt: 'desc' }
    });
  }

  async createConversation(customerId: string, channel: string, initialMessage: string): Promise<CustomerConversation> {
    return await prisma.customerConversation.create({
      data: {
        customerId,
        channel,
        status: 'active',
        priority: 'medium',
        tags: [],
        messages: {
          create: {
            channel,
            customerId,
            message: initialMessage,
            timestamp: new Date(),
            isIncoming: true,
            status: 'delivered'
          }
        }
      },
      include: {
        messages: true,
        customer: true
      }
    });
  }

  private async sendToChannel(channel: string, customerId: string, message: string): Promise<any> {
    // Implementation for sending messages to different channels
    switch (channel) {
      case 'whatsapp':
        return await this.sendWhatsAppMessage(customerId, message);
      case 'facebook':
        return await this.sendFacebookMessage(customerId, message);
      case 'instagram':
        return await this.sendInstagramMessage(customerId, message);
      case 'email':
        return await this.sendEmailMessage(customerId, message);
      case 'sms':
        return await this.sendSMSMessage(customerId, message);
      default:
        throw new Error(`Unsupported channel: ${channel}`);
    }
  }

  private async fetchChannelMessages(channel: string, config: any): Promise<any[]> {
    // Implementation for fetching messages from different channels
    switch (channel) {
      case 'whatsapp':
        return await this.fetchWhatsAppMessages(config);
      case 'facebook':
        return await this.fetchFacebookMessages(config);
      case 'instagram':
        return await this.fetchInstagramMessages(config);
      default:
        return [];
    }
  }

  private async processIncomingMessage(organizationId: string, channel: string, message: any): Promise<void> {
    // Find or create conversation
    let conversation = await prisma.customerConversation.findFirst({
      where: {
        customerId: message.customerId,
        channel,
        status: { in: ['active', 'pending'] }
      }
    });

    if (!conversation) {
      conversation = await this.createConversation(message.customerId, channel, message.text);
    }

    // Save incoming message
    await prisma.channelMessage.create({
      data: {
        conversationId: conversation.id,
        channel,
        customerId: message.customerId,
        message: message.text,
        timestamp: new Date(),
        isIncoming: true,
        status: 'delivered',
        metadata: message
      }
    });

    // Update conversation
    await prisma.customerConversation.update({
      where: { id: conversation.id },
      data: { 
        status: 'active',
        updatedAt: new Date()
      }
    });
  }

  // Channel-specific implementations
  private async sendWhatsAppMessage(customerId: string, message: string): Promise<any> {
    // WhatsApp Business API implementation
    return { status: 'sent', messageId: `wa_${Date.now()}` };
  }

  private async sendFacebookMessage(customerId: string, message: string): Promise<any> {
    // Facebook Messenger API implementation
    return { status: 'sent', messageId: `fb_${Date.now()}` };
  }

  private async sendInstagramMessage(customerId: string, message: string): Promise<any> {
    // Instagram DM API implementation
    return { status: 'sent', messageId: `ig_${Date.now()}` };
  }

  private async sendEmailMessage(customerId: string, message: string): Promise<any> {
    // Email service implementation
    return { status: 'sent', messageId: `email_${Date.now()}` };
  }

  private async sendSMSMessage(customerId: string, message: string): Promise<any> {
    // SMS service implementation
    return { status: 'sent', messageId: `sms_${Date.now()}` };
  }

  private async fetchWhatsAppMessages(config: any): Promise<any[]> {
    // WhatsApp Business API message fetching
    return [];
  }

  private async fetchFacebookMessages(config: any): Promise<any[]> {
    // Facebook Messenger API message fetching
    return [];
  }

  private async fetchInstagramMessages(config: any): Promise<any[]> {
    // Instagram DM API message fetching
    return [];
  }
} 