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

    const expenses = await prisma.expense.findMany({
      where: { organizationId: session.user.organizationId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(expenses);
  } catch (error) {
    console.error('Error fetching expenses:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

<<<<<<< HEAD
    const body = await _request.json();
    const { title, description, amount, category, type, paymentMethod, vendor, tags } = body;
=======
    const body = await request.json();
    const { description, amount, category, date, metadata } = body;
>>>>>>> 08d9e1855dc7fd2c99e5d62def516239ff37a9a7

    if (!description || !amount || !date) {
      return NextResponse.json({ message: 'Description, amount, and date are required' }, { status: 400 });
    }

    const expense = await prisma.expense.create({
      data: {
<<<<<<< HEAD
        description: title || description || 'Expense',
        amount: parseFloat(amount),
        category: category || null,
        date: new Date(),
=======
        description,
        amount: parseFloat(amount),
        category: category || null,
        date: new Date(date),
        metadata: metadata || {},
>>>>>>> 08d9e1855dc7fd2c99e5d62def516239ff37a9a7
        organizationId: session.user.organizationId,
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
    console.error('Error creating expense:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
} 