import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
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
    
    // Sort by most recent message after grouping
    conversations.sort((a, b) => {
      const aDate = a._max.createdAt || new Date(0);
      const bDate = b._max.createdAt || new Date(0);
      return bDate.getTime() - aDate.getTime();
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
          customerName: customer?.name || 'Unknown',
          customerPhone: customer?.phone || '',
          customerEmail: customer?.email || '',
          lastMessage: lastMessage?.content || '',
          lastMessageTime: lastMessage?.createdAt || conv._max.createdAt || new Date().toISOString(),
          unreadCount,
          status: 'active', // This would be determined by business logic
        };
      })
    );

    return NextResponse.json({ conversations: conversationsWithDetails });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
} 