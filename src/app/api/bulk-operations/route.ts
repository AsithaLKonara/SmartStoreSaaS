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

    const operations = await prisma.bulkOperation.findMany({
      where: {
        organizationId: session.user.organizationId,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate progress percentage for each operation
    const operationsWithProgress = operations.map(op => ({
      ...op,
      progress: op.totalRecords > 0 
        ? Math.round((op.processedRecords / op.totalRecords) * 100)
        : 0,
      successCount: op.successRecords,
      errorCount: op.failedRecords,
      errorLog: op.errors,
    }));

    return NextResponse.json(operationsWithProgress);
  } catch (error) {
    console.error('Error fetching bulk operations:', error);
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
    const { name, type, entity, templateId, fileUrl } = body;

    if (!name || !type || !entity) {
      return NextResponse.json({ message: 'Required fields are missing' }, { status: 400 });
    }

    const operation = await prisma.bulkOperation.create({
      data: {
        name,
        type: type.toLowerCase(),
        entity: entity.toUpperCase(),
        status: 'pending',
        totalRecords: 0,
        processedRecords: 0,
        successRecords: 0,
        failedRecords: 0,
        fileUrl: fileUrl || null,
        errors: [],
        metadata: templateId ? { templateId } : {},
        organizationId: session.user.organizationId,
      },
    });

    return NextResponse.json({
      ...operation,
      progress: 0,
      successCount: operation.successRecords,
      errorCount: operation.failedRecords,
      errorLog: operation.errors,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating bulk operation:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
} 