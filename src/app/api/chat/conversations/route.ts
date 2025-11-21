import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const conversations = await prisma.chatMessage.groupBy({
      by: ['customerId'],
      where: {
        organizationId: session.user.organizationId,
      },
      _count: {
        id: true,
      },
      _max: {
        createdAt: true,
      },
    });

    // Get conversation details with customer info
    const conversationsWithDetails = await Promise.all(
      conversations.map(async (conv) => {
        const customer = await prisma.customer.findUnique({
          where: { id: conv.customerId },
        });

        const lastMessage = await prisma.chatMessage.findFirst({
          where: { customerId: conv.customerId },
          orderBy: { createdAt: 'desc' },
        });

        const unreadCount = await prisma.chatMessage.count({
          where: {
            customerId: conv.customerId,
            direction: 'INBOUND',
            status: 'SENT',
          },
        });

        return {
          id: conv.customerId,
          customerId: conv.customerId,
          customer: {
            name: customer?.name || 'Unknown',
            phone: customer?.phone || '',
            email: customer?.email || '',
          },
          lastMessage: lastMessage?.content || '',
          lastMessageTime: lastMessage?.createdAt || conv._max.createdAt || new Date().toISOString(),
          unreadCount,
          status: 'active', // This would be determined by business logic
          channel: 'whatsapp', // This would come from the message channel
          tags: customer?.tags || [],
        };
      })
    );

    return NextResponse.json({ conversations: conversationsWithDetails });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
} 