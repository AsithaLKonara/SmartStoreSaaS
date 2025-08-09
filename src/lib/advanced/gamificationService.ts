import { prisma } from '@/lib/prisma';
import { realTimeSyncService } from '@/lib/sync/realTimeSyncService';
import { emailService } from '@/lib/email/emailService';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  type: 'milestone' | 'streak' | 'challenge' | 'social' | 'spending';
  category: 'shopping' | 'loyalty' | 'social' | 'engagement';
  points: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  requirements: {
    type: 'purchase_count' | 'total_spent' | 'days_active' | 'reviews_written' | 'referrals' | 'custom';
    value: number;
    timeframe?: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'all_time';
    conditions?: Record<string, any>;
  };
  rewards: {
    points: number;
    badges: string[];
    discounts?: Array<{
      type: 'percentage' | 'fixed';
      value: number;
      minPurchase?: number;
      validUntil?: Date;
    }>;
    freeShipping?: boolean;
    earlyAccess?: boolean;
  };
  isActive: boolean;
  createdAt: Date;
}

export interface UserAchievement {
  id: string;
  userId: string;
  achievementId: string;
  earnedAt: Date;
  progress?: number;
  isNotified: boolean;
}

export interface Leaderboard {
  id: string;
  name: string;
  description: string;
  type: 'points' | 'purchases' | 'reviews' | 'referrals' | 'streak';
  period: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'all_time';
  maxEntries: number;
  isActive: boolean;
  entries: LeaderboardEntry[];
  lastUpdated: Date;
}

export interface LeaderboardEntry {
  userId: string;
  userName: string;
  userAvatar?: string;
  score: number;
  rank: number;
  change: number; // Change from previous period
  badges: string[];
}

export interface Challenge {
  id: string;
  name: string;
  description: string;
  type: 'individual' | 'team' | 'community';
  category: 'shopping' | 'social' | 'engagement' | 'seasonal';
  startDate: Date;
  endDate: Date;
  requirements: {
    target: number;
    metric: 'purchases' | 'amount_spent' | 'products_reviewed' | 'days_active' | 'referrals';
    conditions?: Record<string, any>;
  };
  rewards: {
    winner: {
      points: number;
      badges: string[];
      prizes?: string[];
    };
    participant: {
      points: number;
      badges: string[];
    };
  };
  participants: string[];
  winners: string[];
  status: 'upcoming' | 'active' | 'completed' | 'cancelled';
}

export interface UserStats {
  userId: string;
  totalPoints: number;
  currentLevel: number;
  pointsToNextLevel: number;
  totalAchievements: number;
  currentStreak: number;
  longestStreak: number;
  badges: string[];
  rank: number;
  lifetimeStats: {
    totalPurchases: number;
    totalSpent: number;
    reviewsWritten: number;
    referralsMade: number;
    daysActive: number;
  };
  recentActivity: Array<{
    type: 'achievement' | 'points' | 'level_up' | 'badge';
    description: string;
    points?: number;
    timestamp: Date;
  }>;
}

export interface QuestLine {
  id: string;
  name: string;
  description: string;
  category: 'onboarding' | 'shopping' | 'social' | 'seasonal';
  steps: QuestStep[];
  totalRewards: {
    points: number;
    badges: string[];
    prizes?: string[];
  };
  isActive: boolean;
  prerequisites?: string[];
}

export interface QuestStep {
  id: string;
  name: string;
  description: string;
  order: number;
  requirements: {
    type: string;
    target: number;
    conditions?: Record<string, any>;
  };
  rewards: {
    points: number;
    badges?: string[];
  };
  isCompleted: boolean;
}

export class GamificationService {
  /**
   * Initialize user's gamification profile
   */
  async initializeUserGamification(userId: string): Promise<UserStats> {
    try {
      // Check if user already has gamification profile
      const existingProfile = await prisma.userGamification.findUnique({
        where: { userId },
      });

      if (existingProfile) {
        return this.getUserStats(userId);
      }

      // Create new gamification profile
      const profile = await prisma.userGamification.create({
        data: {
          userId,
          totalPoints: 0,
          currentLevel: 1,
          currentStreak: 0,
          longestStreak: 0,
          badges: [],
          lifetimeStats: {
            totalPurchases: 0,
            totalSpent: 0,
            reviewsWritten: 0,
            referralsMade: 0,
            daysActive: 0,
          },
          recentActivity: [],
        },
      });

      // Award welcome achievement
      await this.checkAndAwardAchievement(userId, 'welcome_aboard');

      // Start onboarding quest
      await this.startQuestLine(userId, 'onboarding');

      return this.getUserStats(userId);
    } catch (error) {
      console.error('Error initializing user gamification:', error);
      throw new Error('Failed to initialize gamification profile');
    }
  }

  /**
   * Award points to user
   */
  async awardPoints(
    userId: string,
    points: number,
    reason: string,
    metadata?: Record<string, any>
  ): Promise<{
    newTotal: number;
    levelUp: boolean;
    newLevel?: number;
    achievements?: string[];
  }> {
    try {
      const profile = await prisma.userGamification.findUnique({
        where: { userId },
      });

      if (!profile) {
        await this.initializeUserGamification(userId);
        return this.awardPoints(userId, points, reason, metadata);
      }

      const oldPoints = profile.totalPoints;
      const newTotal = oldPoints + points;
      const oldLevel = profile.currentLevel;
      const newLevel = this.calculateLevel(newTotal);
      const levelUp = newLevel > oldLevel;

      // Update profile
      await prisma.userGamification.update({
        where: { userId },
        data: {
          totalPoints: newTotal,
          currentLevel: newLevel,
          recentActivity: {
            push: {
              type: 'points',
              description: reason,
              points,
              timestamp: new Date(),
            },
          },
        },
      });

      // Check for achievements
      const newAchievements = await this.checkAllAchievements(userId);

      // Level up rewards
      if (levelUp) {
        await this.handleLevelUp(userId, oldLevel, newLevel);
      }

      // Broadcast event
      await realTimeSyncService.broadcastEvent({
        type: 'points_awarded',
        entityId: userId,
        entityType: 'user_gamification',
        organizationId: 'gamification',
        data: { userId, points, reason, newTotal, levelUp, newLevel },
        timestamp: new Date(),
      });

      return {
        newTotal,
        levelUp,
        newLevel: levelUp ? newLevel : undefined,
        achievements: newAchievements,
      };
    } catch (error) {
      console.error('Error awarding points:', error);
      throw new Error('Failed to award points');
    }
  }

  /**
   * Check and award achievement
   */
  async checkAndAwardAchievement(userId: string, achievementId: string): Promise<boolean> {
    try {
      // Check if user already has this achievement
      const existingAchievement = await prisma.userAchievement.findFirst({
        where: { userId, achievementId },
      });

      if (existingAchievement) {
        return false;
      }

      // Get achievement details
      const achievement = await prisma.achievement.findUnique({
        where: { id: achievementId },
      });

      if (!achievement || !achievement.isActive) {
        return false;
      }

      // Check if user meets requirements
      const meetsRequirements = await this.checkAchievementRequirements(userId, achievement);

      if (!meetsRequirements) {
        return false;
      }

      // Award achievement
      await prisma.userAchievement.create({
        data: {
          userId,
          achievementId,
          earnedAt: new Date(),
          isNotified: false,
        },
      });

      // Award points and badges
      await this.awardPoints(userId, achievement.rewards.points, `Achievement: ${achievement.name}`);

      if (achievement.rewards.badges.length > 0) {
        await this.awardBadges(userId, achievement.rewards.badges);
      }

      // Apply discounts if any
      if (achievement.rewards.discounts) {
        await this.applyAchievementDiscounts(userId, achievement.rewards.discounts);
      }

      // Send notification
      await this.sendAchievementNotification(userId, achievement);

      return true;
    } catch (error) {
      console.error('Error checking achievement:', error);
      return false;
    }
  }

  /**
   * Update leaderboard
   */
  async updateLeaderboards(userId: string, metric: string, value: number): Promise<void> {
    try {
      const leaderboards = await prisma.leaderboard.findMany({
        where: {
          type: metric,
          isActive: true,
        },
      });

      for (const leaderboard of leaderboards) {
        await this.updateLeaderboardEntry(leaderboard.id, userId, value);
      }
    } catch (error) {
      console.error('Error updating leaderboards:', error);
    }
  }

  /**
   * Create challenge
   */
  async createChallenge(challengeData: Omit<Challenge, 'id' | 'participants' | 'winners' | 'status'>): Promise<Challenge> {
    try {
      const challenge = await prisma.challenge.create({
        data: {
          name: challengeData.name,
          description: challengeData.description,
          type: challengeData.type,
          category: challengeData.category,
          startDate: challengeData.startDate,
          endDate: challengeData.endDate,
          requirements: challengeData.requirements,
          rewards: challengeData.rewards,
          participants: [],
          winners: [],
          status: challengeData.startDate > new Date() ? 'upcoming' : 'active',
        },
      });

      return {
        id: challenge.id,
        name: challenge.name,
        description: challenge.description,
        type: challenge.type as Challenge['type'],
        category: challenge.category as Challenge['category'],
        startDate: challenge.startDate,
        endDate: challenge.endDate,
        requirements: challenge.requirements as Challenge['requirements'],
        rewards: challenge.rewards as Challenge['rewards'],
        participants: challenge.participants as string[],
        winners: challenge.winners as string[],
        status: challenge.status as Challenge['status'],
      };
    } catch (error) {
      console.error('Error creating challenge:', error);
      throw new Error('Failed to create challenge');
    }
  }

  /**
   * Join challenge
   */
  async joinChallenge(userId: string, challengeId: string): Promise<boolean> {
    try {
      const challenge = await prisma.challenge.findUnique({
        where: { id: challengeId },
      });

      if (!challenge || challenge.status !== 'active') {
        return false;
      }

      const participants = challenge.participants as string[];
      
      if (participants.includes(userId)) {
        return false;
      }

      await prisma.challenge.update({
        where: { id: challengeId },
        data: {
          participants: [...participants, userId],
        },
      });

      return true;
    } catch (error) {
      console.error('Error joining challenge:', error);
      return false;
    }
  }

  /**
   * Get user statistics
   */
  async getUserStats(userId: string): Promise<UserStats> {
    try {
      const profile = await prisma.userGamification.findUnique({
        where: { userId },
      });

      if (!profile) {
        return await this.initializeUserGamification(userId);
      }

      const currentLevel = profile.currentLevel;
      const pointsToNextLevel = this.getPointsForLevel(currentLevel + 1) - profile.totalPoints;
      
      // Get user rank
      const rank = await this.getUserRank(userId);

      // Get achievements count
      const achievementsCount = await prisma.userAchievement.count({
        where: { userId },
      });

      return {
        userId,
        totalPoints: profile.totalPoints,
        currentLevel,
        pointsToNextLevel: Math.max(0, pointsToNextLevel),
        totalAchievements: achievementsCount,
        currentStreak: profile.currentStreak,
        longestStreak: profile.longestStreak,
        badges: profile.badges as string[],
        rank,
        lifetimeStats: profile.lifetimeStats as UserStats['lifetimeStats'],
        recentActivity: (profile.recentActivity as UserStats['recentActivity']).slice(-10),
      };
    } catch (error) {
      console.error('Error getting user stats:', error);
      throw new Error('Failed to get user stats');
    }
  }

  /**
   * Get leaderboard
   */
  async getLeaderboard(
    type: string,
    period: string = 'all_time',
    limit: number = 50
  ): Promise<Leaderboard> {
    try {
      const leaderboard = await prisma.leaderboard.findFirst({
        where: { type, period, isActive: true },
      });

      if (!leaderboard) {
        throw new Error('Leaderboard not found');
      }

      const entries = await this.calculateLeaderboardEntries(type, period, limit);

      return {
        id: leaderboard.id,
        name: leaderboard.name,
        description: leaderboard.description,
        type: leaderboard.type,
        period: leaderboard.period,
        maxEntries: leaderboard.maxEntries,
        isActive: leaderboard.isActive,
        entries,
        lastUpdated: new Date(),
      };
    } catch (error) {
      console.error('Error getting leaderboard:', error);
      throw new Error('Failed to get leaderboard');
    }
  }

  /**
   * Private helper methods
   */
  private calculateLevel(points: number): number {
    // Level formula: sqrt(points / 100)
    return Math.floor(Math.sqrt(points / 100)) + 1;
  }

  private getPointsForLevel(level: number): number {
    // Inverse of level formula
    return Math.pow(level - 1, 2) * 100;
  }

  private async checkAchievementRequirements(userId: string, achievement: any): Promise<boolean> {
    const requirements = achievement.requirements;
    
    switch (requirements.type) {
      case 'purchase_count':
        const purchaseCount = await prisma.order.count({
          where: { customerId: userId, status: 'COMPLETED' },
        });
        return purchaseCount >= requirements.value;
      
      case 'total_spent':
        const totalSpent = await prisma.order.aggregate({
          where: { customerId: userId, status: 'COMPLETED' },
          _sum: { total: true },
        });
        return (totalSpent._sum.total || 0) >= requirements.value;
      
      case 'reviews_written':
        const reviewCount = await prisma.review.count({
          where: { userId },
        });
        return reviewCount >= requirements.value;
      
      default:
        return false;
    }
  }

  private async checkAllAchievements(userId: string): Promise<string[]> {
    const newAchievements: string[] = [];
    
    const achievements = await prisma.achievement.findMany({
      where: { isActive: true },
    });

    for (const achievement of achievements) {
      const awarded = await this.checkAndAwardAchievement(userId, achievement.id);
      if (awarded) {
        newAchievements.push(achievement.id);
      }
    }

    return newAchievements;
  }

  private async handleLevelUp(userId: string, oldLevel: number, newLevel: number): Promise<void> {
    // Award level up points
    const bonusPoints = newLevel * 10;
    
    await prisma.userGamification.update({
      where: { userId },
      data: {
        recentActivity: {
          push: {
            type: 'level_up',
            description: `Reached level ${newLevel}!`,
            points: bonusPoints,
            timestamp: new Date(),
          },
        },
      },
    });

    // Send level up notification
    await this.sendLevelUpNotification(userId, newLevel);
  }

  private async awardBadges(userId: string, badges: string[]): Promise<void> {
    const profile = await prisma.userGamification.findUnique({
      where: { userId },
    });

    if (profile) {
      const currentBadges = profile.badges as string[];
      const newBadges = [...new Set([...currentBadges, ...badges])];

      await prisma.userGamification.update({
        where: { userId },
        data: { badges: newBadges },
      });
    }
  }

  private async applyAchievementDiscounts(userId: string, discounts: any[]): Promise<void> {
    // Apply achievement-based discounts
    for (const discount of discounts) {
      await prisma.userDiscount.create({
        data: {
          userId,
          type: discount.type,
          value: discount.value,
          minPurchase: discount.minPurchase,
          validUntil: discount.validUntil,
          source: 'achievement',
        },
      });
    }
  }

  private async sendAchievementNotification(userId: string, achievement: any): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.email) return;

    await emailService.sendEmail({
      to: user.email,
      subject: `🏆 Achievement Unlocked: ${achievement.name}!`,
      templateId: 'achievement-unlocked',
      templateData: {
        userName: user.name,
        achievementName: achievement.name,
        achievementDescription: achievement.description,
        points: achievement.rewards.points,
        dashboardUrl: `${process.env.NEXTAUTH_URL}/dashboard/gamification`,
      },
    });
  }

  private async sendLevelUpNotification(userId: string, level: number): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.email) return;

    await emailService.sendEmail({
      to: user.email,
      subject: `🎉 Level Up! You've reached Level ${level}!`,
      templateId: 'level-up',
      templateData: {
        userName: user.name,
        level,
        bonusPoints: level * 10,
        dashboardUrl: `${process.env.NEXTAUTH_URL}/dashboard/gamification`,
      },
    });
  }

  private async getUserRank(userId: string): Promise<number> {
    const profile = await prisma.userGamification.findUnique({
      where: { userId },
    });

    if (!profile) return 0;

    const rank = await prisma.userGamification.count({
      where: {
        totalPoints: { gt: profile.totalPoints },
      },
    });

    return rank + 1;
  }

  private async updateLeaderboardEntry(leaderboardId: string, userId: string, score: number): Promise<void> {
    // Update leaderboard entry logic
    console.log(`Updating leaderboard ${leaderboardId} for user ${userId} with score ${score}`);
  }

  private async calculateLeaderboardEntries(type: string, period: string, limit: number): Promise<LeaderboardEntry[]> {
    // Calculate leaderboard entries based on type and period
    const entries: LeaderboardEntry[] = [];
    
    const profiles = await prisma.userGamification.findMany({
      take: limit,
      orderBy: { totalPoints: 'desc' },
      include: { user: true },
    });

    profiles.forEach((profile, index) => {
      entries.push({
        userId: profile.userId,
        userName: profile.user.name || 'Anonymous',
        userAvatar: profile.user.image,
        score: profile.totalPoints,
        rank: index + 1,
        change: 0, // Would calculate based on previous period
        badges: profile.badges as string[],
      });
    });

    return entries;
  }

  private async startQuestLine(userId: string, questLineId: string): Promise<void> {
    // Start quest line for user
    console.log(`Starting quest line ${questLineId} for user ${userId}`);
  }
}

export const gamificationService = new GamificationService();
