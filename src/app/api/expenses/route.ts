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

    const expenses = await prisma.expense.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(expenses);
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
    const { title, description, amount, category, type, paymentMethod, vendor, tags } = body;

    if (!description || !amount) {
      return NextResponse.json({ message: 'Description and amount are required' }, { status: 400 });
    }

    const expense = await prisma.expense.create({
      data: {
        description: title || description || 'Expense',
        amount: parseFloat(amount),
        category: category || null,
        date: new Date(),
        organizationId,
        metadata: {
          type,
          paymentMethod,
          vendor,
          tags: tags || [],
          status: 'PENDING',
        },
      },
    });

    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    const session = await getServerSession(authOptions).catch(() => null);
    return handleApiError(error, request, session);
  }
} 