import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { CurrencyService } from '@/lib/currency/currencyService';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from') || 'USD';
    const to = searchParams.get('to') || 'EUR';
    const amount = parseFloat(searchParams.get('amount') || '1');

    const currencyService = new CurrencyService();
    const result = await currencyService.convertCurrency(
      session?.user?.organizationId,
      from,
      to,
      amount
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error converting currency:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

