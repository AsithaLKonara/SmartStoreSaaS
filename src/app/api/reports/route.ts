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

    const reports = await prisma.report.findMany({
      where: {
        organizationId: session.user.organizationId,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(reports);
  } catch (error) {
    console.error('Error fetching reports:', error);
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
    const { name, type, format, parameters } = body;

    if (!name || !type || !format) {
      return NextResponse.json({ message: 'Required fields are missing' }, { status: 400 });
    }

    const report = await prisma.report.create({
      data: {
        name,
        type,
        status: 'GENERATING',
        format,
        parameters: parameters || {},
        organizationId: session.user.organizationId,
      },
    });

    return NextResponse.json(report, { status: 201 });
  } catch (error) {
    console.error('Error creating report:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
} 