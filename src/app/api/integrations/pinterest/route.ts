import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PinterestService } from '@/lib/integrations/pinterest/pinterestService';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const integration = await prisma.pinterestIntegration.findFirst({
      where: { organizationId: session.user.organizationId },
    });

    if (!integration) {
      return NextResponse.json({ message: 'Integration not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: integration.id,
      boardId: integration.boardId,
      isActive: integration.isActive,
      lastSync: integration.lastSync,
    });
  } catch (error) {
    console.error('Error fetching Pinterest integration:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { accessToken, boardId } = body;

    if (!accessToken) {
      return NextResponse.json(
        { message: 'Missing required field: accessToken' },
        { status: 400 }
      );
    }

    // Test connection
    const pinterestService = new PinterestService('temp', accessToken);
    const isConnected = await pinterestService.testConnection();

    if (!isConnected) {
      return NextResponse.json(
        { message: 'Failed to connect to Pinterest' },
        { status: 400 }
      );
    }

    // Get boards if boardId not provided
    let finalBoardId = boardId;
    if (!finalBoardId) {
      const boards = await pinterestService.getBoards();
      if (boards.length > 0) {
        finalBoardId = boards[0].id;
      }
    }

    // Create or update integration
    const integration = await prisma.pinterestIntegration.upsert({
      where: { organizationId: session.user.organizationId },
      create: {
        organizationId: session.user.organizationId,
        boardId: finalBoardId || null,
        accessToken,
        isActive: true,
      },
      update: {
        boardId: finalBoardId || undefined,
        accessToken,
        isActive: true,
      },
    });

    return NextResponse.json({
      id: integration.id,
      boardId: integration.boardId,
      isActive: integration.isActive,
      message: 'Pinterest integration configured successfully',
    }, { status: 201 });
  } catch (error) {
    console.error('Error setting up Pinterest integration:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

