import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const campaigns = await prisma.campaign.findMany({
      where: { organizationId: session.user.organizationId },
      orderBy: { createdAt: 'desc' },
      include: {
        metrics: true,
      },
    });

    // Get stats from CampaignMetric or use defaults
    const campaignsWithStats = campaigns.map((campaign: any) => {
      const metrics = campaign.metrics?.[0] || {
        sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        bounced: 0,
      };

      return {
        ...campaign,
        stats: {
          sent: metrics.sent || 0,
          delivered: metrics.delivered || 0,
          opened: metrics.opened || 0,
          clicked: metrics.clicked || 0,
          bounced: metrics.bounced || 0,
        },
      };
    });

    return NextResponse.json(campaignsWithStats);
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await _request.json();
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
        metrics: {
          create: {
            sent: 0,
            delivered: 0,
            opened: 0,
            clicked: 0,
            bounced: 0,
          },
        },
      },
      include: {
        metrics: true,
      },
    });

    return NextResponse.json({
      ...campaign,
      stats: {
        sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        bounced: 0,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating campaign:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
} 