import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { GamificationService } from '@/lib/gamification/gamificationService';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    const service = new GamificationService();

    if (type === 'achievements') {
      const achievements = await service.getUserAchievements(session.user.id);
      return NextResponse.json(achievements);
    } else if (type === 'leaderboard') {
      const organizationId = session.user.organizationId;
      if (!organizationId) {
        return NextResponse.json({ message: 'Organization not found' }, { status: 400 });
      }

      const period = (searchParams.get('period') as any) || 'all-time';
      const leaderboardType = (searchParams.get('leaderboardType') as any) || 'points';
      
      const leaderboard = await service.getLeaderboard(organizationId, period, leaderboardType);
      return NextResponse.json(leaderboard);
    }

    return NextResponse.json({ message: 'Invalid type parameter' }, { status: 400 });
  } catch (error) {
    console.error('Error fetching gamification data:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId || !session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await _request.json();
    const { action, eventType, eventData } = body;

    const service = new GamificationService();

    if (action === 'check') {
      const unlocked = await service.checkAndUnlockAchievements(
        session.user.organizationId,
        session.user.id,
        eventType,
        eventData
      );
      return NextResponse.json({ unlocked });
    } else if (action === 'redeem') {
      const { rewardId } = body;
      const result = await service.redeemReward(session.user.id, rewardId);
      return NextResponse.json(result);
    }

    return NextResponse.json({ message: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error processing gamification action:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

