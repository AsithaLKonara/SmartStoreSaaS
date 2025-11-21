import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { conversationId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const messages = await prisma.chatMessage.findMany({
<<<<<<< HEAD
      where: {
        customerId: params.conversationId,
        organizationId: session.user.organizationId,
      },
      include: {
        customer: {
          select: {
            name: true,
            phone: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
=======
      where: { conversationId: params.conversationId },
      orderBy: { createdAt: 'desc' },
      take: 50,
>>>>>>> 08d9e1855dc7fd2c99e5d62def516239ff37a9a7
    });

    return NextResponse.json({ messages });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: { conversationId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await _request.json();
    const { content, sender } = body;

    if (!content || !sender) {
      return NextResponse.json({ message: 'Content and sender are required' }, { status: 400 });
    }

    const message = await prisma.chatMessage.create({
      data: {
<<<<<<< HEAD
        content,
        direction: sender === 'agent' ? 'OUTBOUND' : 'INBOUND',
        type: 'TEXT',
        status: 'SENT',
        customerId: params.conversationId,
        organizationId: session.user.organizationId,
        metadata: {
          channel: 'whatsapp',
          sender,
        },
      },
      include: {
        customer: {
          select: {
            name: true,
            phone: true,
            email: true,
          },
        },
=======
        content: content,
        type: 'TEXT',
        direction: 'INBOUND',
        conversationId: params.conversationId,
        customerId: params.conversationId,
        organizationId: session.user.organizationId,
>>>>>>> 08d9e1855dc7fd2c99e5d62def516239ff37a9a7
      },
    });

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    console.error('Error creating message:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
} 