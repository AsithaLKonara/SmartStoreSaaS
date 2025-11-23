import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { BuyNowPayLaterService } from '@/lib/payments/buyNowPayLaterService';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { provider, amount, currency, orderId, customerInfo } = body;

    if (!provider || !amount || !currency || !orderId) {
      return NextResponse.json(
        { message: 'Missing required fields' },
        { status: 400 }
      );
    }

    const bnplService = new BuyNowPayLaterService();
    const bnplSession = await bnplService.createSession(
      provider,
      amount,
      currency,
      orderId,
      customerInfo || {}
    );

    return NextResponse.json(bnplSession);
  } catch (error) {
    console.error('Error creating BNPL session:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

