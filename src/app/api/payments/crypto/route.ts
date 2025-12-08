import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { CryptoPaymentService } from '@/lib/payments/cryptoPaymentService';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { amount, currency, cryptoCurrency, orderId } = body;

    if (!amount || !currency || !cryptoCurrency || !orderId) {
      return NextResponse.json(
        { message: 'Missing required fields' },
        { status: 400 }
      );
    }

    const cryptoService = new CryptoPaymentService();
    const payment = await cryptoService.createPayment(
      amount,
      currency,
      cryptoCurrency,
      orderId
    );

    return NextResponse.json(payment);
  } catch (error) {
    console.error('Error creating crypto payment:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const paymentId = searchParams.get('paymentId');
    const cryptoCurrency = searchParams.get('cryptoCurrency');

    if (!paymentId || !cryptoCurrency) {
      return NextResponse.json(
        { message: 'Missing paymentId or cryptoCurrency' },
        { status: 400 }
      );
    }

    const cryptoService = new CryptoPaymentService();
    const status = await cryptoService.checkPaymentStatus(paymentId, cryptoCurrency);

    return NextResponse.json(status);
  } catch (error) {
    console.error('Error checking crypto payment status:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

