import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // Get both system templates (organizationId null) and organization-specific templates
    const templates = await prisma.bulkOperationTemplate.findMany({
      where: {
        OR: [
          { organizationId: null }, // System templates
          { organizationId: session?.user?.organizationId }, // Organization templates
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(templates);
  } catch (error) {
    console.error('Error fetching bulk operation templates:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, type, entity, fields, sampleFile } = body;

    if (!name || !description || !type || !entity) {
      return NextResponse.json({ message: 'Required fields are missing' }, { status: 400 });
    }

    const template = await prisma.bulkOperationTemplate.create({
      data: {
        name,
        description,
        type: type.toUpperCase(),
        entity: entity.toUpperCase(),
        fields: fields || [],
        sampleFile: sampleFile || `/templates/${entity.toLowerCase()}-${type.toLowerCase()}-sample.csv`,
        organizationId: session?.user?.organizationId,
      },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error('Error creating bulk operation template:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
} 