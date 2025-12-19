import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { Session } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma, validateOrganizationId } from '@/lib/prisma';
import { handleApiError, validateSession } from '@/lib/api-error-handler';

export async function GET(request: NextRequest) {
  try {
    const session = (await getServerSession(authOptions)) as Session | null;
    const sessionValidation = validateSession(session);
    if (!sessionValidation.valid) {
      return NextResponse.json({ message: sessionValidation.error || 'Unauthorized' }, { status: 401 });
    }

    const organizationId = validateOrganizationId(session?.user?.organizationId);

    const operations = await prisma.bulkOperation.findMany({
      where: {
        organizationId,
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
    const session = (await getServerSession(authOptions).catch(() => null)) as Session | null;
    return handleApiError(error, request, session);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = (await getServerSession(authOptions)) as Session | null;
    const sessionValidation = validateSession(session);
    if (!sessionValidation.valid) {
      return NextResponse.json({ message: sessionValidation.error || 'Unauthorized' }, { status: 401 });
    }

    const organizationId = validateOrganizationId(session?.user?.organizationId);

    const body = await request.json();
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
        organizationId,
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
    const session = (await getServerSession(authOptions).catch(() => null)) as Session | null;
    return handleApiError(error, request, session);
  }
} 