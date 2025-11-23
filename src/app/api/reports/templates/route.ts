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

    // Get both system templates (organizationId null) and organization-specific templates
    const templates = await prisma.reportTemplate.findMany({
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
    console.error('Error fetching report templates:', error);
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
    const { name, description, type, category, parameters } = body;

    if (!name || !description || !type || !category) {
      return NextResponse.json({ message: 'Required fields are missing' }, { status: 400 });
    }

    const template = await prisma.reportTemplate.create({
      data: {
        name,
        description,
        type,
        category,
        parameters: parameters || [],
        organizationId: session.user.organizationId,
      },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error('Error creating report template:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
} 