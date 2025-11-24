import { prisma } from '@/lib/prisma';

export interface AchievementProgress {
  achievementId: string;
  name: string;
  description: string;
  progress: number;
  maxProgress: number;
  unlocked: boolean;
  unlockedAt?: Date;
}

export interface LeaderboardEntry {
  userId: string;
  userName: string;
  score: number;
  rank: number;
}

export class GamificationService {
  async checkAndUnlockAchievements(
    organizationId: string,
    userId: string,
    eventType: string,
    eventData: Record<string, unknown>
  ): Promise<string[]> {
    const achievements = await prisma.achievement.findMany({
      where: {
        organizationId,
        isActive: true,
      },
    });

    const unlockedAchievementIds: string[] = [];

    for (const achievement of achievements) {
      const criteria = achievement.criteria as Record<string, unknown>;
      
      // Check if achievement criteria is met
      if (this.checkCriteria(criteria, eventType, eventData)) {
        // Check if already unlocked
        const existing = await prisma.userAchievement.findUnique({
          where: {
            userId_achievementId: {
              userId,
              achievementId: achievement.id,
            },
          },
        });

        if (!existing) {
          // Unlock achievement
          await prisma.userAchievement.create({
            data: {
              userId,
              achievementId: achievement.id,
            },
          });
          unlockedAchievementIds.push(achievement.id);
        }
      }
    }

    return unlockedAchievementIds;
  }

  async getUserAchievements(userId: string): Promise<AchievementProgress[]> {
    const achievements = await prisma.achievement.findMany({
      where: {
        isActive: true,
      },
    });

    const userAchievements = await prisma.userAchievement.findMany({
      where: { userId },
    });

    const userAchievementMap = new Map(
      userAchievements.map(ua => [ua.achievementId, ua])
    );

    return achievements.map(achievement => {
      const userAchievement = userAchievementMap.get(achievement.id);
      const unlocked = !!userAchievement;
      return {
        achievementId: achievement.id,
        name: achievement.name,
        description: achievement.description,
        progress: unlocked ? 100 : 0,
        maxProgress: 100,
        unlocked,
        unlockedAt: unlocked ? userAchievement.unlockedAt : undefined,
      };
    });
  }

  async getLeaderboard(
    organizationId: string,
    period: 'daily' | 'weekly' | 'monthly' | 'all-time' = 'all-time',
    type: 'points' | 'purchases' | 'referrals' = 'points'
  ): Promise<LeaderboardEntry[]> {
    let startDate: Date | null = null;
    
    if (period === 'daily') {
      startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
    } else if (period === 'weekly') {
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
    } else if (period === 'monthly') {
      startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 1);
    }

    let entries: LeaderboardEntry[] = [];

    if (type === 'purchases') {
      const orders = await prisma.order.findMany({
        where: {
          organizationId,
          createdAt: startDate ? { gte: startDate } : undefined,
        },
        include: {
          createdBy: true,
        },
      });

      const userStats = new Map<string, { count: number; userName: string }>();
      orders.forEach(order => {
        const userId = order.createdById;
        const existing = userStats.get(userId) || { count: 0, userName: order.createdBy?.name || 'Unknown' };
        userStats.set(userId, {
          count: existing.count + 1,
          userName: existing.userName,
        });
      });

      entries = Array.from(userStats.entries())
        .map(([userId, stats], index) => ({
          userId,
          userName: stats.userName,
          score: stats.count,
          rank: index + 1,
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
    } else if (type === 'points') {
      // Calculate points based on achievements
      const userAchievements = await prisma.userAchievement.findMany({});
      const achievementIds = Array.from(new Set(userAchievements.map(ua => ua.achievementId)));
      const achievements = await prisma.achievement.findMany({
        where: { id: { in: achievementIds } },
      });
      const achievementMap = new Map(achievements.map(a => [a.id, a]));

      const userPoints = new Map<string, number>();
      userAchievements.forEach(ua => {
        const achievement = achievementMap.get(ua.achievementId);
        const points = achievement?.points || 0;
        userPoints.set(ua.userId, (userPoints.get(ua.userId) || 0) + points);
      });

      entries = Array.from(userPoints.entries())
        .map(([userId, score], index) => ({
          userId,
          userName: 'User', // Would fetch from user table
          score,
          rank: index + 1,
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
    }

    return entries;
  }

  async createReward(
    organizationId: string,
    name: string,
    description: string,
    type: string,
    value: unknown,
    pointsRequired?: number
  ): Promise<Record<string, unknown>> {
    const reward = await prisma.reward.create({
      data: {
        organizationId,
        name,
        description,
        type,
        value,
        pointsRequired: pointsRequired || null,
        isActive: true,
      },
    });

    return reward;
  }

  async redeemReward(
    userId: string,
    rewardId: string
  ): Promise<{ success: boolean; message: string }> {
    const reward = await prisma.reward.findUnique({
      where: { id: rewardId },
    });

    if (!reward || !reward.isActive) {
      return { success: false, message: 'Reward not found or inactive' };
    }

    if (reward.pointsRequired) {
      // Check if user has enough points
      const userPoints = await this.getUserPoints(userId);
      if (userPoints < reward.pointsRequired) {
        return {
          success: false,
          message: `Insufficient points. Required: ${reward.pointsRequired}, Available: ${userPoints}`,
        };
      }
    }

    // In production, would apply the reward (discount code, etc.)
    return {
      success: true,
      message: `Reward "${reward.name}" redeemed successfully!`,
    };
  }

  private async getUserPoints(userId: string): Promise<number> {
    const userAchievements = await prisma.userAchievement.findMany({
      where: { userId },
    });

    if (userAchievements.length === 0) return 0;

    const achievementIds = userAchievements.map(ua => ua.achievementId);
    const achievements = await prisma.achievement.findMany({
      where: { id: { in: achievementIds } },
    });

    const achievementMap = new Map(achievements.map(a => [a.id, a]));
    return userAchievements.reduce((sum, ua) => {
      const achievement = achievementMap.get(ua.achievementId);
      return sum + (achievement?.points || 0);
    }, 0);
  }

  private checkCriteria(criteria: Record<string, unknown>, eventType: string, eventData: Record<string, unknown>): boolean {
    if (!criteria) return false;

    // Example criteria checks
    if (criteria.eventType === eventType) {
      if (criteria.minValue && eventData.value < criteria.minValue) {
        return false;
      }
      if (criteria.maxValue && eventData.value > criteria.maxValue) {
        return false;
      }
      return true;
    }

    return false;
  }
}

