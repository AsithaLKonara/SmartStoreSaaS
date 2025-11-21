import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { OmnichannelService } from '@/lib/omnichannel/omnichannelService';

const omnichannelService = new OmnichannelService();

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const conversationId = searchParams.get('conversationId');
    const customerId = searchParams.get('customerId');

    switch (action) {
      case 'inbox':
        const user = await prisma.user.findUnique({
          where: { email: session.user.email },
          include: { organization: true }
        });
        
        if (!user?.organizationId) {
          return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        const inbox = await omnichannelService.getUnifiedInbox(user.organizationId);
        return NextResponse.json({ inbox });

      case 'conversation':
        if (!conversationId) {
          return NextResponse.json({ error: 'Conversation ID required' }, { status: 400 });
        }
        const conversation = await omnichannelService.getConversation(conversationId);
        return NextResponse.json({ conversation });

      case 'customer-history':
        if (!customerId) {
          return NextResponse.json({ error: 'Customer ID required' }, { status: 400 });
        }
        const history = await omnichannelService.getCustomerHistory(customerId);
        return NextResponse.json({ history });

      case 'integrations':
        const userForIntegrations = await prisma.user.findUnique({
          where: { email: session.user.email },
          include: { organization: true }
        });
        
        if (!userForIntegrations?.organizationId) {
          return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        const integrations = await omnichannelService.getChannelIntegrations(userForIntegrations.organizationId);
        return NextResponse.json({ integrations });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Omnichannel API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await _request.json();
    const { action, ...data } = body;

    switch (action) {
      case 'send-message':
        const message = await omnichannelService.sendMessage(
          data.conversationId,
          data.message,
          data.channel
        );
        return NextResponse.json({ message });

      case 'assign-agent':
        await omnichannelService.assignAgent(data.conversationId, data.agentId);
        return NextResponse.json({ success: true });

      case 'update-status':
        await omnichannelService.updateConversationStatus(data.conversationId, data.status);
        return NextResponse.json({ success: true });

      case 'add-tags':
        await omnichannelService.addConversationTags(data.conversationId, data.tags);
        return NextResponse.json({ success: true });

      case 'create-conversation':
        const conversation = await omnichannelService.createConversation(
          data.customerId,
          data.channel,
          data.initialMessage
        );
        return NextResponse.json({ conversation });

      case 'update-integration':
        const userForIntegration = await prisma.user.findUnique({
          where: { email: session.user.email },
          include: { organization: true }
        });
        
        if (!userForIntegration?.organizationId) {
          return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        await omnichannelService.updateChannelIntegration(
          userForIntegration.organizationId,
          data.channel,
          data.config
        );
        return NextResponse.json({ success: true });

      case 'sync-channel':
        const userForSync = await prisma.user.findUnique({
          where: { email: session.user.email },
          include: { organization: true }
        });
        
        if (!userForSync?.organizationId) {
          return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        await omnichannelService.syncChannelMessages(userForSync.organizationId, data.channel);
        return NextResponse.json({ success: true });

      case 'bulk-assign':
        const { conversationIds, agentId } = data;
        for (const conversationId of conversationIds) {
          await omnichannelService.assignAgent(conversationId, agentId);
        }
        return NextResponse.json({ success: true });

      case 'bulk-update-status':
        const { conversationIds: ids, status } = data;
        for (const conversationId of ids) {
          await omnichannelService.updateConversationStatus(conversationId, status);
        }
        return NextResponse.json({ success: true });

      case 'search-conversations':
        const userForSearch = await prisma.user.findUnique({
          where: { email: session.user.email },
          include: { organization: true }
        });
        
        if (!userForSearch?.organizationId) {
          return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        const searchResults = await prisma.customerConversation.findMany({
          where: {
            organizationId: userForSearch.organizationId,
            OR: [
              { customer: { name: { contains: data.query, mode: 'insensitive' } } },
              { customer: { email: { contains: data.query, mode: 'insensitive' } } },
              { messages: { some: { message: { contains: data.query, mode: 'insensitive' } } } },
              { tags: { hasSome: [data.query] } }
            ]
          },
          include: {
            customer: true,
            messages: {
              orderBy: { timestamp: 'desc' },
              take: 1
            },
            assignedAgent: true
          },
          orderBy: { updatedAt: 'desc' }
        });

        return NextResponse.json({ conversations: searchResults });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Omnichannel API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 