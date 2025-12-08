import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma, validateOrganizationId } from '@/lib/prisma';
import { handleApiError, validateSession } from '@/lib/api-error-handler';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const sessionValidation = validateSession(session);
    if (!sessionValidation.valid) {
      return NextResponse.json({ message: sessionValidation.error || 'Unauthorized' }, { status: 401 });
    }

    const organizationId = validateOrganizationId(session?.user?.organizationId);

    const categories = await prisma.category.findMany({
      where: {
        organizationId,
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ categories });
  } catch (error) {
    const session = await getServerSession(authOptions).catch(() => null);
    return handleApiError(error, request, session);
  }
} 