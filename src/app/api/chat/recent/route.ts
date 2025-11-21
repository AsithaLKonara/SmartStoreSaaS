import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) {
    return `${diffInSeconds} seconds ago`;
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  } else {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');

    // Get recent conversations
    const conversations = await prisma.customerConversation.findMany({
      where: {
        organizationId: session.user.organizationId,
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        messages: {
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });

    // Format conversations for dashboard display
    const formattedChats = conversations.map(conv => {
      const lastMessage = conv.messages[0];
      const channel = conv.channel || 'website';
      
      return {
        id: conv.id,
        customer: conv.customer?.name || 'Unknown Customer',
        message: lastMessage?.message || 'No messages yet',
        channel: channel.toLowerCase(),
        time: lastMessage ? getTimeAgo(lastMessage.timestamp) : 'No activity',
        unread: conv.status === 'active' && lastMessage?.isIncoming === true,
      };
    });

    // If no conversations, try to get recent chat messages as fallback
    if (formattedChats.length === 0) {
      const recentMessages = await prisma.chatMessage.findMany({
        where: {
          organizationId: session.user.organizationId,
        },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      // Group by customer
      const messagesByCustomer = new Map();
      recentMessages.forEach(msg => {
        const customerId = msg.customerId;
        if (!messagesByCustomer.has(customerId)) {
          messagesByCustomer.set(customerId, {
            id: `msg-${customerId}`,
            customer: msg.customer?.name || 'Unknown Customer',
            message: msg.content,
            channel: 'website',
            time: getTimeAgo(msg.createdAt),
            unread: msg.direction === 'INBOUND' && msg.status === 'SENT',
          });
        }
      });

      return NextResponse.json(Array.from(messagesByCustomer.values()));
    }

    return NextResponse.json(formattedChats);
  } catch (error) {
    console.error('Error fetching recent chats:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

