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

    const campaigns = await prisma.campaign.findMany({
      where: { organizationId: session.user.organizationId },
      orderBy: { createdAt: 'desc' },
    });

    // Add mock stats for demonstration
    const campaignsWithStats = campaigns.map((campaign: any) => ({
      ...campaign,
      stats: {
        sent: Math.floor(Math.random() * 1000) + 100,
        delivered: Math.floor(Math.random() * 900) + 80,
        opened: Math.floor(Math.random() * 500) + 50,
        clicked: Math.floor(Math.random() * 100) + 10,
        bounced: Math.floor(Math.random() * 20) + 1,
      },
    }));

    return NextResponse.json(campaignsWithStats);
  } catch (error) {
    console.error('Error fetching campaigns:', error);
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
    const { name, type, content, settings } = body;

    if (!name || !type || !content) {
      return NextResponse.json({ message: 'Name, type, and content are required' }, { status: 400 });
    }

    const campaign = await prisma.campaign.create({
      data: {
        name,
        type: type as any,
        content,
        settings: settings || {},
        organizationId: session.user.organizationId,
      },
    });

    return NextResponse.json(campaign, { status: 201 });
  } catch (error) {
    console.error('Error creating campaign:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
} 