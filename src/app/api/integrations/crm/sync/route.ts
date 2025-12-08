import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { CRMSyncService } from '@/lib/integrations/crm/crmSyncService';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { type } = body; // 'customers', 'leads', 'opportunities', 'all'

    const syncService = new CRMSyncService();
    const results = await syncService.syncToCRM(
      session?.user?.organizationId,
      type || 'all'
    );

    return NextResponse.json({
      message: 'Sync completed',
      results,
    });
  } catch (error) {
    console.error('Error syncing CRM data:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

