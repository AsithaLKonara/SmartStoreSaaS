import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { BlockchainService } from '@/lib/blockchain/blockchainService';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { type, action } = body;

    const service = new BlockchainService();

    if (type === 'payment' && action === 'create') {
      const { orderId, amount, currency, fromAddress } = body;
      const txHash = await service.processCryptoPayment(
        session?.user?.organizationId,
        orderId,
        amount,
        currency,
        fromAddress
      );
      return NextResponse.json({ txHash });
    } else if (type === 'supply_chain' && action === 'track') {
      const { productId, fromLocation, toLocation, metadata } = body;
      const txHash = await service.trackSupplyChain(
        session?.user?.organizationId,
        productId,
        fromLocation,
        toLocation,
        metadata
      );
      return NextResponse.json({ txHash });
    } else if (type === 'nft' && action === 'create') {
      const { productId, metadata } = body;
      const txHash = await service.createNFTCertificate(
        session?.user?.organizationId,
        productId,
        metadata
      );
      return NextResponse.json({ txHash });
    }

    return NextResponse.json({ message: 'Invalid type or action' }, { status: 400 });
  } catch (error) {
    console.error('Error processing blockchain transaction:', error);
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
    const txHash = searchParams.get('txHash');

    if (!txHash) {
      return NextResponse.json({ message: 'Missing txHash parameter' }, { status: 400 });
    }

    const service = new BlockchainService();
    const status = await service.getTransactionStatus(txHash);

    return NextResponse.json(status);
  } catch (error) {
    console.error('Error fetching transaction status:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

