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

    // Get both system templates (organizationId null) and organization-specific templates
    const templates = await prisma.campaignTemplate.findMany({
      where: {
        OR: [
          { organizationId: null }, // System templates
          { organizationId: session.user.organizationId }, // Organization templates
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(templates);
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await _request.json();
    const { name, type, content, variables } = body;

    if (!name || !type || !content) {
      return NextResponse.json({ message: 'Name, type, and content are required' }, { status: 400 });
    }

    const template = await prisma.campaignTemplate.create({
      data: {
        name,
        type: type as any,
        content,
        variables: variables || [],
        organizationId: session.user.organizationId,
      },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error('Error creating template:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
} 