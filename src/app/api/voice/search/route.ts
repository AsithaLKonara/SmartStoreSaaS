import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { VoiceCommerceService } from '@/lib/voice/voiceCommerceService';

export async function POST(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await _request.json();
    const { query } = body;

    if (!query) {
      return NextResponse.json(
        { message: 'Missing query parameter' },
        { status: 400 }
      );
    }

    const voiceService = new VoiceCommerceService();
    const results = await voiceService.searchByVoice(session.user.organizationId, query);

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Error processing voice search:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

