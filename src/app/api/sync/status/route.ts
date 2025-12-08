import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { validateOrganizationId } from '@/lib/prisma';
import { handleApiError, validateSession } from '@/lib/api-error-handler';
import { realTimeSyncService } from '@/lib/sync/realTimeSyncService';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const sessionValidation = validateSession(session);
    if (!sessionValidation.valid) {
      return NextResponse.json({ error: sessionValidation.error || 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationIdParam = searchParams.get('organizationId');
    const organizationId = organizationIdParam || validateOrganizationId(session?.user?.organizationId);

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    const status = await realTimeSyncService.getSyncStatus(organizationId);
    
    return NextResponse.json(status);
  } catch (error) {
    const session = await getServerSession(authOptions).catch(() => null);
    return handleApiError(error, request, session);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, organizationId } = body;

    switch (action) {
      case 'force_sync':
        await realTimeSyncService.forceSync(organizationId);
        return NextResponse.json({ success: true, message: 'Sync completed' });

      case 'resolve_conflict':
        const { conflictId, resolution } = body;
        await realTimeSyncService.resolveConflict(conflictId, resolution);
        return NextResponse.json({ success: true, message: 'Conflict resolved' });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Sync action error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 