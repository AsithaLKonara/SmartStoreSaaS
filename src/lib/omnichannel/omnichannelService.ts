import { prisma } from '@/lib/prisma';

export interface ChannelMessage {
  id: string;
  channel: string;
  message: string;
  timestamp: Date;
  isIncoming: boolean;
  status: string;
  metadata?: Record<string, unknown>;
}

export interface CustomerConversation {
  id: string;
  customerId: string;
  channel: string;
  messages: ChannelMessage[];
  status: string;
  assignedAgent?: string | null;
  priority: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  organizationId: string;
  assignedAgentId?: string | null;
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
  config: Record<string, unknown>;
  lastSync: Date;
}

export class OmnichannelService {
  async getUnifiedInbox(organizationId: string): Promise<UnifiedInbox> {
    const conversations = await prisma.customerConversation.findMany({
      where: { organizationId },
      include: {
        customer: true,
        assignedAgent: true,
        messages: {
          orderBy: { timestamp: 'desc' },
          take: 1
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    // Transform Prisma results to match interface
    const transformedConversations: CustomerConversation[] = conversations.map((c) => ({
      id: c.id,
      customerId: c.customerId,
      channel: c.channel,
      messages: c.messages || [],
      status: c.status,
      assignedAgent: c.assignedAgent?.id || null,
      priority: c.priority,
      tags: c.tags || [],
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      organizationId: c.organizationId,
      assignedAgentId: c.assignedAgentId
    }));

    const unreadCount = transformedConversations.filter((c) => 
      c.messages.some((m) => !m.isIncoming && m.status === 'sent')
    ).length;

    const pendingCount = transformedConversations.filter((c) => c.status === 'pending').length;
    const urgentCount = transformedConversations.filter((c) => c.priority === 'urgent').length;

    return {
      conversations: transformedConversations,
      unreadCount,
      pendingCount,
      urgentCount
    };
  }

  async getConversation(conversationId: string): Promise<CustomerConversation | null> {
    const conversation = await prisma.customerConversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { timestamp: 'asc' }
        },
        customer: true,
        assignedAgent: true
      }
    });

    if (!conversation) return null;

    // Transform Prisma result to match interface
    return {
      id: conversation.id,
      customerId: conversation.customerId,
      channel: conversation.channel,
      messages: conversation.messages || [],
      status: conversation.status,
      assignedAgent: conversation.assignedAgent?.id || null,
      priority: conversation.priority,
      tags: conversation.tags || [],
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      organizationId: conversation.organizationId,
      assignedAgentId: conversation.assignedAgentId
    };
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

    const updatedTags = Array.from(new Set([...conversation.tags, ...tags]));
    
    await prisma.customerConversation.update({
      where: { id: conversationId },
      data: { tags: updatedTags }
    });
  }

  async getChannelIntegrations(organizationId: string): Promise<ChannelIntegration[]> {
    const integrations = await prisma.channelIntegration.findMany({
      where: { organizationId }
    });

    return integrations.map((integration) => ({
      channel: integration.channel,
      isActive: integration.isActive,
      config: integration.config,
      lastSync: integration.lastSync
    }));
  }

  async updateChannelIntegration(organizationId: string, channel: string, config: Record<string, unknown>): Promise<void> {
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
    const conversation = await prisma.customerConversation.create({
      data: {
        customerId,
        channel,
        status: 'active',
        priority: 'medium',
        tags: [],
        organizationId: 'default-org' // You should implement proper organization resolution
        // Note: messages relationship doesn't exist in Prisma schema
        // Consider implementing this functionality when the relationship is available
      },
      include: {
        messages: true,
        customer: true
      }
    });

    // Transform to match interface
    return {
      id: conversation.id,
      customerId: conversation.customerId,
      channel: conversation.channel,
      messages: conversation.messages || [],
      status: conversation.status,
      assignedAgent: null,
      priority: conversation.priority,
      tags: conversation.tags || [],
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      organizationId: conversation.organizationId,
      assignedAgentId: conversation.assignedAgentId
    };
  }

  private async sendToChannel(channel: string, customerId: string, message: string): Promise<Record<string, unknown>> {
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

  private async fetchChannelMessages(channel: string, config: Record<string, unknown>): Promise<Array<Record<string, unknown>>> {
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

  private async processIncomingMessage(organizationId: string, channel: string, message: Record<string, unknown> & { customerId?: string; content?: string; senderId?: string }): Promise<void> {
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

    // Ensure conversation exists
    if (!conversation) {
      throw new Error('Failed to create or find conversation');
    }

    // Save incoming message
    await prisma.channelMessage.create({
      data: {
        conversationId: conversation.id,
        channel,
        message: message.text,
        timestamp: new Date(),
        isIncoming: true,
        status: 'delivered'
      },
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
    const integration = await prisma.instagramIntegration.findFirst({
      where: { organizationId: customerId }, // This needs to be updated to get organizationId properly
    });

    if (!integration || !integration.isActive) {
      throw new Error('Instagram integration not found or inactive');
    }

    const axios = (await import('axios')).default;
    const response = await axios.post(
      `https://graph.facebook.com/v18.0/${integration.businessAccountId}/messages`,
      {
        recipient: { id: customerId },
        message: { text: message },
      },
      {
        headers: {
          Authorization: `Bearer ${integration.accessToken}`,
        },
      }
    );

    return response.data;
  }

  private async sendEmailMessage(customerId: string, message: string): Promise<any> {
    // Email service implementation
    return { status: 'sent', messageId: `email_${Date.now()}` };
  }

  private async sendSMSMessage(customerId: string, message: string): Promise<any> {
    // SMS service implementation
    return { status: 'sent', messageId: `sms_${Date.now()}` };
  }

  private async fetchWhatsAppMessages(config: Record<string, unknown>): Promise<Array<Record<string, unknown>>> {
    // WhatsApp Business API message fetching
    return [];
  }

  private async fetchFacebookMessages(config: Record<string, unknown>): Promise<Array<Record<string, unknown>>> {
    // Facebook Messenger API message fetching
    return [];
  }

  private async fetchInstagramMessages(config: any): Promise<any[]> {
    const integration = await prisma.instagramIntegration.findFirst({
      where: { organizationId: config.organizationId },
    });

    if (!integration || !integration.isActive) {
      return [];
    }

    try {
      const axios = (await import('axios')).default;
      const response = await axios.get(
        `https://graph.facebook.com/v18.0/${integration.businessAccountId}/conversations`,
        {
          headers: {
            Authorization: `Bearer ${integration.accessToken}`,
          },
        }
      );

      return response.data.data || [];
    } catch (error) {
      console.error('Error fetching Instagram messages:', error);
      return [];
    }
  }
} 