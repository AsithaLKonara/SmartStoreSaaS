import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ThreatDetectionService, ThreatEvent } from '@/lib/security/threatDetectionService';
import { FraudPreventionService } from '@/lib/security/fraudPreventionService';

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await _request.json();
    const { type, check } = body;

    if (type === 'threat') {
      const threatService = new ThreatDetectionService();
      const threatEvent: ThreatEvent = {
        type: check.type,
        severity: check.severity,
        source: check.source,
        details: check.details,
        timestamp: new Date(),
      };

      const result = await threatService.detectThreats(
        session.user.organizationId,
        threatEvent
      );

      if (result.isThreat) {
        await threatService.logThreat(session.user.organizationId, threatEvent);
      }

      return NextResponse.json(result);
    } else if (type === 'fraud') {
      const fraudService = new FraudPreventionService();
      const result = await fraudService.checkFraud(check);
      return NextResponse.json(result);
    }

    return NextResponse.json({ message: 'Invalid type' }, { status: 400 });
  } catch (error) {
    console.error('Error checking security:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

