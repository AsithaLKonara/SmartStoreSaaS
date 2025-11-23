import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { aiChatService } from '@/lib/ai/chatService';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { message, conversationId, customerId } = body;

    if (!message || !conversationId) {
      return NextResponse.json({ message: 'Message and conversation ID are required' }, { status: 400 });
    }

    // Get conversation context
    const conversation = await prisma.customerConversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { timestamp: 'asc' },
          take: 10, // Last 10 messages for context
        },
        customer: true,
      },
    });
    
    // Get chat messages for context
    const chatMessages = await prisma.chatMessage.findMany({
      where: { customerId: conversation?.customerId },
      orderBy: { createdAt: 'asc' },
      take: 10,
    });

    if (!conversation) {
      return NextResponse.json({ message: 'Conversation not found' }, { status: 404 });
    }

    // Analyze message intent and sentiment
    const sentiment = await aiChatService.analyzeCustomerSentiment(message);
    const isUrgent = await aiChatService.detectUrgentIssues({
      id: conversation.id,
      status: conversation.status,
      priority: conversation.priority || 'MEDIUM',
      customerId: conversation.customerId,
        messages: conversation.messages.map((msg) => ({
          id: msg.id,
          content: (msg as { message: string }).message || '',
          role: (msg as { isIncoming: boolean }).isIncoming ? 'user' : 'assistant',
          timestamp: (msg as { timestamp: Date }).timestamp
        })),
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt
    });

    let aiResponse = '';
    let action = null;

    // Check for specific intents
    if (message.toLowerCase().includes('order') && message.toLowerCase().includes('status')) {
      // Extract order number from message
      const orderMatch = message.match(/#?([A-Z0-9-]+)/);
      if (orderMatch) {
        aiResponse = await aiChatService.provideOrderStatus(orderMatch[1], session.user.organizationId);
      } else {
        aiResponse = "I'd be happy to help you check your order status. Could you please provide your order number?";
      }
    } else if (message.toLowerCase().includes('product') || message.toLowerCase().includes('item')) {
      // Product discovery
      const recommendations = await aiChatService.findProductsByDescription(message, session.user.organizationId);
      if (recommendations.length > 0) {
        aiResponse = `I found some products that might interest you:\n\n${recommendations
          .slice(0, 3)
          .map(rec => `• ${rec.name} - $${rec.price} (${Math.round(rec.confidence * 100)}% match)`)
          .join('\n')}\n\nWould you like me to show you more details about any of these products?`;
      } else {
        aiResponse = "I couldn't find any products matching your description. Could you try different keywords or browse our catalog?";
      }
    } else if (message.toLowerCase().includes('buy') || message.toLowerCase().includes('purchase')) {
      // Order creation from chat
      const orderData = await aiChatService.createOrderFromChat({
        id: conversation.id,
        status: conversation.status,
        priority: conversation.priority || 'MEDIUM',
        customerId: conversation.customerId,
        messages: conversation.messages.map((msg) => ({
          id: msg.id,
          content: (msg as { message: string }).message || '',
          role: (msg as { isIncoming: boolean }).isIncoming ? 'user' : 'assistant',
          timestamp: (msg as { timestamp: Date }).timestamp
        })),
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt
      });
      if (orderData) {
        action = {
          type: 'create_order',
          data: orderData,
        };
        aiResponse = "I can help you create an order! I've identified the items you're interested in. Would you like me to proceed with creating the order?";
      } else {
        aiResponse = "I'd be happy to help you place an order. Could you please specify which products you'd like to purchase and the quantities?";
      }
    } else if (message.toLowerCase().includes('help') || message.toLowerCase().includes('support')) {
      // FAQ handling
      aiResponse = await aiChatService.answerFAQ(message, session.user.organizationId);
    } else if (customerId && (message.toLowerCase().includes('recommend') || message.toLowerCase().includes('suggest'))) {
      // Product recommendations based on customer history
      const recommendations = await aiChatService.recommendProducts(customerId, message, session.user.organizationId);
      if (recommendations.length > 0) {
        aiResponse = `Based on your preferences, here are some recommendations:\n\n${recommendations
          .slice(0, 3)
          .map(rec => `• ${rec.name} - $${rec.price}`)
          .join('\n')}\n\nWould you like to know more about any of these products?`;
      } else {
        aiResponse = "I don't have enough information to make personalized recommendations yet. Feel free to browse our catalog or ask about specific products!";
      }
    } else {
      // General conversation - use AI to generate contextual response
      const context = chatMessages
        .map((msg) => `${msg.direction}: ${msg.content}`)
        .join('\n');

      aiResponse = await generateContextualResponse(message, context, session.user.organizationId);
    }

    // Save AI response to conversation
    const aiMessage = await prisma.chatMessage.create({
      data: {
        content: aiResponse,
        direction: 'OUTBOUND',
        type: 'TEXT',
        status: 'SENT',
        customerId: conversation?.customerId || '',
        organizationId: session.user.organizationId,
        metadata: {
          sentiment: sentiment as any,
          isUrgent,
          confidence: 0.9,
          aiGenerated: true,
        } as any,
      },
    });

    // If urgent issue detected, create notification
    if (isUrgent) {
      await createUrgentIssueNotification(conversation, message, session.user.organizationId);
    }

    // Update conversation
    await prisma.customerConversation.update({
      where: { id: conversationId },
      data: {
        updatedAt: new Date(),
        status: isUrgent ? 'urgent' : 'active',
      },
    });

    return NextResponse.json({
      message: aiMessage,
      action,
      sentiment,
      isUrgent,
    });
  } catch {
    console.error('Error in AI chat');
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// Generate contextual response using AI
async function generateContextualResponse(message: string, context: string, organizationId: string): Promise<string> {
  try {
    const prompt = `
      You are a helpful customer service assistant for SmartStore AI, an e-commerce platform.
      
      Previous conversation context:
      ${context}
      
      Customer message: "${message}"
      
      Provide a helpful, friendly, and professional response. Be concise but informative.
      If the customer is asking about products, orders, or general questions, provide helpful guidance.
      If you're unsure about something, politely ask for clarification.
      
      Response:`;

    // This would use the AI service to generate a response
    // For now, returning a generic helpful response
    return "Thank you for your message! I'm here to help you with any questions about our products, orders, or services. How can I assist you today?";
  } catch {
    console.error('Error generating contextual response');
    return "I apologize, but I'm having trouble processing your request right now. Please try again or contact our support team for immediate assistance.";
  }
}

// Create urgent issue notification
async function createUrgentIssueNotification(conversation: any, message: string, organizationId: string): Promise<void> {
  try {
    // Create notification for urgent issues
    await prisma.notification.create({
      data: {
        type: 'URGENT_CHAT',
        title: 'Urgent Customer Issue',
        message: `Urgent issue in conversation #${conversation.id}: ${message.substring(0, 100)}...`,
        organizationId,
        userId: conversation.customerId,
        priority: 'HIGH',
        metadata: {
          conversationId: conversation.id,
          customerId: conversation.customerId,
          priority: 'high',
        },
      },
    });

    // Send email notification to support team
    // await sendEmail({
    //   to: 'support@smartstore.ai',
    //   subject: `Urgent Issue - Conversation #${conversation.id}`,
    //   template: 'urgent-issue',
    //   data: { conversation, message },
    // });
  } catch {
    console.error('Error creating urgent issue notification');
  }
}

// GET endpoint for AI capabilities
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'capabilities':
        return NextResponse.json({
          capabilities: [
            'Product discovery and recommendations',
            'Order status checking',
            'Order creation from chat',
            'FAQ and support',
            'Sentiment analysis',
            'Urgent issue detection',
            'Personalized recommendations',
          ],
        });

      case 'stats':
        const stats = await getAIChatStats(session.user.organizationId);
        return NextResponse.json(stats);

      default:
        return NextResponse.json({ message: 'Invalid action' }, { status: 400 });
    }
  } catch {
    console.error('Error in AI chat GET');
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// Get AI chat statistics
async function getAIChatStats(organizationId: string): Promise<any> {
  try {
    const totalMessages = await prisma.chatMessage.count({
      where: {
        organizationId,
        direction: 'OUTBOUND',
        metadata: { equals: { aiGenerated: true } },
      },
    });

    const urgentIssues = await prisma.chatMessage.count({
      where: {
        organizationId,
        metadata: { equals: { isUrgent: true } },
      },
    });

    const conversations = await prisma.customerConversation.count({
      where: { organizationId },
    });

    const avgResponseTime = await calculateAverageResponseTime(organizationId);

    return {
      totalAIMessages: totalMessages,
      urgentIssues,
      totalConversations: conversations,
      averageResponseTime: avgResponseTime,
      aiUtilizationRate: conversations > 0 ? (totalMessages / conversations) : 0,
    };
  } catch {
    console.error('Error getting AI chat stats');
    return {};
  }
}

// Calculate average response time
async function calculateAverageResponseTime(organizationId: string): Promise<number> {
  try {
    const messages = await prisma.chatMessage.findMany({
      where: {
        organizationId,
        direction: 'OUTBOUND',
        metadata: { equals: { aiGenerated: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    let totalResponseTime = 0;
    let responseCount = 0;

    for (let i = 1; i < messages.length; i++) {
      const currentMessage = messages[i];
      const previousMessage = messages[i - 1];

      if (currentMessage.direction === 'OUTBOUND' && previousMessage.direction === 'INBOUND') {
        const responseTime = currentMessage.createdAt.getTime() - previousMessage.createdAt.getTime();
        totalResponseTime += responseTime;
        responseCount++;
      }
    }

    return responseCount > 0 ? totalResponseTime / responseCount : 0;
  } catch {
    console.error('Error calculating average response time');
    return 0;
  }
} 