import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma, executePrismaQuery, validateOrganizationId } from '@/lib/prisma';
import { handleApiError, validateSession } from '@/lib/api-error-handler';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const sessionValidation = validateSession(session);
    if (!sessionValidation.valid) {
      return NextResponse.json({ message: sessionValidation.error || 'Unauthorized' }, { status: 401 });
    }
    
    const organizationId = validateOrganizationId(session?.user?.organizationId);

    const campaigns = await executePrismaQuery(() =>
      prisma.campaign.findMany({
        where: { organizationId },
      orderBy: { createdAt: 'desc' },
      include: {
        metrics: true,
      },
      })
    );

    // Get stats from CampaignMetric or use defaults
    const campaignsWithStats = campaigns.map((campaign) => {
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
    const session = await getServerSession(authOptions).catch(() => null);
    return handleApiError(error, request, session);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const sessionValidation = validateSession(session);
    if (!sessionValidation.valid) {
      return NextResponse.json({ message: sessionValidation.error || 'Unauthorized' }, { status: 401 });
    }
    
    const organizationId = validateOrganizationId(session?.user?.organizationId);

    const body = await request.json();
    const { name, type, content, settings } = body;

    if (!name || !type || !content) {
      return NextResponse.json({ message: 'Name, type, and content are required' }, { status: 400 });
    }

    const campaign = await executePrismaQuery(() =>
      prisma.campaign.create({
      data: {
        name,
        type: type as 'EMAIL' | 'SMS' | 'PUSH' | 'IN_APP',
        content,
        settings: settings || {},
          organizationId,
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
      })
    );

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
    const session = await getServerSession(authOptions).catch(() => null);
    return handleApiError(error, request, session);
  }
} 