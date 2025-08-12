import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const conversations = await prisma.chatConversation.findMany({
      where: { organizationId: session.user.organizationId },
      include: {
        customer: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get conversation details with customer info
    const conversationsWithDetails = await Promise.all(
      conversations.map(async (conv: any) => {
        const customer = await prisma.customer.findUnique({
          where: { id: conv.customerId },
        });

        const lastMessage = conv.messages[0];
        const lastActivity = lastMessage ? lastMessage.createdAt : conv.createdAt;

        const unreadCount = await prisma.chatMessage.count({
          where: {
            customerId: conv.customerId,
            direction: 'INBOUND',
          },
        });

        return {
          id: conv.id,
          customerId: conv.customerId,
          customerName: conv.customer?.name || 'Unknown',
          customerPhone: conv.customer?.phone || '',
          customerEmail: conv.customer?.email || '',
          lastMessage: lastMessage?.content || '',
          lastMessageTime: lastActivity || new Date().toISOString(),
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