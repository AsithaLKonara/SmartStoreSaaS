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
      orderBy: { timestamp: 'asc' },
    });

    return NextResponse.json({ messages });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { conversationId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { content, sender } = body;

    if (!content || !sender) {
      return NextResponse.json({ message: 'Content and sender are required' }, { status: 400 });
    }

    const message = await prisma.chatMessage.create({
      data: {
        content,
        sender,
        channel: 'whatsapp', // This would be determined by the conversation
        customerId: params.conversationId,
        organizationId: session.user.organizationId,
        timestamp: new Date(),
        read: sender === 'agent', // Agent messages are read by default
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
    });

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    console.error('Error creating message:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
} 