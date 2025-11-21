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

<<<<<<< HEAD
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
=======
    const conversations = await prisma.chatConversation.findMany({
      where: { organizationId: session.user.organizationId },
      include: {
        customer: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
>>>>>>> 08d9e1855dc7fd2c99e5d62def516239ff37a9a7
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get conversation details with customer info
    const conversationsWithDetails = await Promise.all(
      conversations.map(async (conv: any) => {
        const customer = await prisma.customer.findUnique({
          where: { id: conv.customerId },
        });

<<<<<<< HEAD
        const lastMessage = await prisma.chatMessage.findFirst({
          where: { customerId: conv.customerId },
          orderBy: { createdAt: 'desc' },
        });
=======
        const lastMessage = conv.messages[0];
        const lastActivity = lastMessage ? lastMessage.createdAt : conv.createdAt;
>>>>>>> 08d9e1855dc7fd2c99e5d62def516239ff37a9a7

        const unreadCount = await prisma.chatMessage.count({
          where: {
            customerId: conv.customerId,
            direction: 'INBOUND',
<<<<<<< HEAD
            status: 'SENT',
=======
>>>>>>> 08d9e1855dc7fd2c99e5d62def516239ff37a9a7
          },
        });

        return {
          id: conv.id,
          customerId: conv.customerId,
          customerName: conv.customer?.name || 'Unknown',
          customerPhone: conv.customer?.phone || '',
          customerEmail: conv.customer?.email || '',
          lastMessage: lastMessage?.content || '',
<<<<<<< HEAD
          lastMessageTime: lastMessage?.createdAt || conv._max.createdAt || new Date().toISOString(),
=======
          lastMessageTime: lastActivity || new Date().toISOString(),
>>>>>>> 08d9e1855dc7fd2c99e5d62def516239ff37a9a7
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