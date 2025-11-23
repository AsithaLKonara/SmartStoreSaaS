import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { VoiceCommerceService } from '@/lib/voice/voiceCommerceService';

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await _request.json();
    const { command } = body;

    if (!command) {
      return NextResponse.json(
        { message: 'Missing command parameter' },
        { status: 400 }
      );
    }

    const voiceService = new VoiceCommerceService();
    const result = await voiceService.processVoiceCommand(
      session.user.organizationId,
      session.user.id,
      command
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error processing voice command:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

