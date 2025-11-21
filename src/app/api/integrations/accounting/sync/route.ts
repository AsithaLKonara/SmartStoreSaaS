import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { AccountingSyncService } from '@/lib/integrations/accounting/accountingSyncService';

export async function POST(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await _request.json();
    const { type } = body; // 'sales', 'expenses', 'all'

    const syncService = new AccountingSyncService();
    const results = await syncService.syncToAccounting(
      session.user.organizationId,
      type || 'all'
    );

    return NextResponse.json({
      message: 'Sync completed',
      results,
    });
  } catch (error) {
    console.error('Error syncing accounting data:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

