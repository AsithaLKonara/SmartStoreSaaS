import { prisma } from '@/lib/prisma';
import { realTimeSyncService } from '@/lib/sync/realTimeSyncService';
import { emailService } from '@/lib/email/emailService';
import { randomUUID } from 'crypto';

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
      // Check if user already has gamification profile in UserPreference
      const userPref = await prisma.userPreference.findUnique({
        where: { userId },
      });

      const gamificationData = (userPref?.notifications as any)?.gamification;
      if (gamificationData) {
        return this.getUserStats(userId);
      }

      // Create new gamification profile in UserPreference metadata
      const defaultGamification = {
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
      };

      await prisma.userPreference.upsert({
        where: { userId },
        update: {
          notifications: {
            ...(userPref?.notifications as Record<string, unknown> || {}),
            gamification: defaultGamification,
          } as Record<string, unknown>,
        },
        create: {
          userId,
          notifications: {
            gamification: defaultGamification,
          } as Record<string, unknown>,
        },
      });

      // Award welcome achievement
      await this.checkAndAwardAchievement(userId, 'welcome_aboard');

      // Start onboarding quest
      await this.startQuestLine(userId, 'onboarding');

      return this.getUserStats(userId);
     } catch {
       console.error('Error initializing user gamification');
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
      const userPref = await prisma.userPreference.findUnique({
        where: { userId },
      });

      const gamificationData = (userPref?.notifications as Record<string, unknown> & { gamification?: unknown })?.gamification || null;

      if (!gamificationData) {
        await this.initializeUserGamification(userId);
        return this.awardPoints(userId, points, reason, metadata);
      }

      const oldPoints = gamificationData.totalPoints || 0;
      const newTotal = oldPoints + points;
      const oldLevel = gamificationData.currentLevel || 1;
      const newLevel = this.calculateLevel(newTotal);
      const levelUp = newLevel > oldLevel;

      // Update profile in UserPreference metadata
      const updatedGamification = {
        ...gamificationData,
        totalPoints: newTotal,
        currentLevel: newLevel,
        recentActivity: [
          ...(gamificationData.recentActivity || []),
          {
            type: 'points',
            description: reason,
            points,
            timestamp: new Date(),
          },
        ].slice(-50), // Keep last 50 activities
      };

      await prisma.userPreference.update({
        where: { userId },
        data: {
          notifications: {
            ...(userPref?.notifications as Record<string, unknown> || {}),
            gamification: updatedGamification,
          } as Record<string, unknown>,
        },
      });

      // Check for achievements
      const newAchievements = await this.checkAllAchievements(userId);

      // Level up rewards
      if (levelUp) {
        await this.handleLevelUp(userId, oldLevel, newLevel);
      }

      // Broadcast event
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { organizationId: true },
      });
      await realTimeSyncService.queueEvent({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'message',
        action: 'update',
        entityId: userId,
        organizationId: user?.organizationId || '',
        data: { userId, points, reason, newTotal, levelUp, newLevel },
        timestamp: new Date(),
        source: 'gamification'
      });

      return {
        newTotal,
        levelUp,
        newLevel: levelUp ? newLevel : undefined,
        achievements: newAchievements,
      };
     } catch {
       console.error('Error awarding points');
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
          unlockedAt: new Date(),
        },
      });

      // Award points and badges - rewards stored in criteria metadata
      const rewards = (achievement.criteria as Record<string, unknown> & { rewards?: { points?: number; badges?: unknown[]; discounts?: unknown[] } })?.rewards || { points: achievement.points || 0, badges: [], discounts: [] };
      await this.awardPoints(userId, rewards.points || achievement.points || 0, `Achievement: ${achievement.name}`);

      if (rewards.badges && rewards.badges.length > 0) {
        await this.awardBadges(userId, rewards.badges);
      }

      // Apply discounts if any
      if (rewards.discounts && rewards.discounts.length > 0) {
        await this.applyAchievementDiscounts(userId, rewards.discounts);
      }

      // Send notification
      await this.sendAchievementNotification(userId, achievement);

      return true;
     } catch {
       console.error('Error checking achievement');
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
     } catch {
       console.error('Error updating leaderboards');
    }
  }

  /**
   * Create challenge
   */
  async createChallenge(
    organizationId: string,
    challengeData: Omit<Challenge, 'id' | 'participants' | 'winners' | 'status'>
  ): Promise<Challenge> {
    try {
      // Store challenge in Organization metadata
      const challengeId = randomUUID();
      const challenge: Challenge = {
        id: challengeId,
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
      };

      // Get organization and update metadata with challenges
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { settings: true },
      });

      const settings = (organization?.settings as Record<string, unknown>) || {};
      const challenges = settings.challenges || [];
      
      // Add new challenge to the list
      challenges.push(challenge);

      // Update organization metadata
      await prisma.organization.update({
        where: { id: organizationId },
        data: {
          settings: {
            ...settings,
            challenges,
          } as Record<string, unknown>,
        },
      });

      return challenge;
     } catch (error) {
       console.error('Error creating challenge:', error);
      throw new Error('Failed to create challenge');
    }
  }

  /**
   * Join challenge
   */
  async joinChallenge(userId: string, challengeId: string, organizationId: string): Promise<boolean> {
    try {
      // Retrieve challenge from Organization metadata
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { settings: true },
      });

      const settings = (organization?.settings as Record<string, unknown>) || {};
      const challenges: Challenge[] = settings.challenges || [];
      
      const challengeIndex = challenges.findIndex((c: Challenge) => c.id === challengeId);
      if (challengeIndex === -1) {
        return false;
      }

      const challenge = challenges[challengeIndex];
      if (challenge.status !== 'active') {
        return false;
      }

      // Check if user is already a participant
      if (challenge.participants.includes(userId)) {
        return false;
      }

      // Add user to participants
      challenges[challengeIndex] = {
        ...challenge,
        participants: [...challenge.participants, userId],
      };

      // Update organization metadata
      await prisma.organization.update({
        where: { id: organizationId },
        data: {
          settings: {
            ...settings,
            challenges,
          } as Record<string, unknown>,
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
      const userPref = await prisma.userPreference.findUnique({
        where: { userId },
      });

      const gamificationData = (userPref?.notifications as any)?.gamification;

      if (!gamificationData) {
        return await this.initializeUserGamification(userId);
      }

      const currentLevel = gamificationData.currentLevel || 1;
      const pointsToNextLevel = this.getPointsForLevel(currentLevel + 1) - (gamificationData.totalPoints || 0);
      
      // Get user rank
      const rank = await this.getUserRank(userId);

      // Get achievements count
      const achievementsCount = await prisma.userAchievement.count({
        where: { userId },
      });

      return {
        userId,
        totalPoints: gamificationData.totalPoints || 0,
        currentLevel,
        pointsToNextLevel: Math.max(0, pointsToNextLevel),
        totalAchievements: achievementsCount,
        currentStreak: gamificationData.currentStreak || 0,
        longestStreak: gamificationData.longestStreak || 0,
        badges: (gamificationData.badges || []) as string[],
        rank,
        lifetimeStats: (gamificationData.lifetimeStats || {
          totalPurchases: 0,
          totalSpent: 0,
          reviewsWritten: 0,
          referralsMade: 0,
          daysActive: 0,
        }) as UserStats['lifetimeStats'],
        recentActivity: ((gamificationData.recentActivity || []) as UserStats['recentActivity']).slice(-10),
      };
     } catch {
       console.error('Error getting user stats');
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

      const entries = await this.calculateLeaderboardEntries(leaderboard.type, period, limit);

      return {
        id: leaderboard.id,
        name: leaderboard.name,
        description: (leaderboard.entries as any)?.description || '', // Store description in entries metadata
        type: leaderboard.type as 'streak' | 'referrals' | 'points' | 'purchases' | 'reviews',
        period: leaderboard.period as 'daily' | 'weekly' | 'monthly' | 'yearly' | 'all_time',
        maxEntries: (leaderboard.entries as any)?.maxEntries || 50, // Store maxEntries in entries metadata
        isActive: leaderboard.isActive,
        entries,
        lastUpdated: new Date(),
      };
     } catch {
       console.error('Error getting leaderboard');
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
          _sum: { totalAmount: true },
        });
        return (totalSpent._sum.totalAmount || 0) >= requirements.value;
      
      case 'reviews_written':
        const reviewCount = await prisma.review.count({
          where: { customerId: userId },
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
    
    const userPref = await prisma.userPreference.findUnique({
      where: { userId },
    });

    const gamificationData = (userPref?.notifications as any)?.gamification || {};
    const updatedGamification = {
      ...gamificationData,
      recentActivity: [
        ...(gamificationData.recentActivity || []),
        {
          type: 'level_up',
          description: `Reached level ${newLevel}!`,
          points: bonusPoints,
          timestamp: new Date(),
        },
      ].slice(-50),
    };

    await prisma.userPreference.update({
      where: { userId },
      data: {
        notifications: {
          ...(userPref?.notifications as any || {}),
          gamification: updatedGamification,
        } as any,
      },
    });

    // Send level up notification
    await this.sendLevelUpNotification(userId, newLevel);
  }

  private async awardBadges(userId: string, badges: string[]): Promise<void> {
    const userPref = await prisma.userPreference.findUnique({
      where: { userId },
    });

    if (userPref) {
      const gamificationData = (userPref.notifications as any)?.gamification || {};
      const currentBadges = (gamificationData.badges || []) as string[];
      const newBadges = Array.from(new Set([...currentBadges, ...badges]));

      await prisma.userPreference.update({
        where: { userId },
        data: {
          notifications: {
            ...(userPref.notifications as any || {}),
            gamification: {
              ...gamificationData,
              badges: newBadges,
            },
          } as Record<string, unknown>,
        },
      });
    }
  }

  private async applyAchievementDiscounts(userId: string, discounts: any[]): Promise<void> {
    // Apply achievement-based discounts - store in UserPreference metadata
    const userPref = await prisma.userPreference.findUnique({
      where: { userId },
    });

    const existingDiscounts = (userPref?.notifications as any)?.discounts || [];
    const newDiscounts = discounts.map(d => ({
      userId,
      type: d.type,
      value: d.value,
      minPurchase: d.minPurchase,
      validUntil: d.validUntil,
      source: 'achievement',
      createdAt: new Date(),
    }));

    await prisma.userPreference.update({
      where: { userId },
      data: {
        notifications: {
          ...(userPref?.notifications as any || {}),
          discounts: [...existingDiscounts, ...newDiscounts],
        } as any,
      },
    });
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
    const userPref = await prisma.userPreference.findUnique({
      where: { userId },
    });

    const gamificationData = (userPref?.notifications as any)?.gamification;
    if (!gamificationData) return 0;

    const userPoints = gamificationData.totalPoints || 0;

    // Count users with more points (stored in UserPreference metadata)
    // Note: This is a simplified ranking - for better performance, consider caching leaderboards
    const allUserPrefs = await prisma.userPreference.findMany({
      where: {
        notifications: {
          path: ['gamification', 'totalPoints'],
          gt: userPoints,
        } as any,
      },
    });

    return allUserPrefs.length + 1;
  }

  private async updateLeaderboardEntry(leaderboardId: string, userId: string, score: number): Promise<void> {
    // Update leaderboard entry logic
    console.log(`Updating leaderboard ${leaderboardId} for user ${userId} with score ${score}`);
  }

  private async calculateLeaderboardEntries(type: string, period: string, limit: number): Promise<LeaderboardEntry[]> {
    // Calculate leaderboard entries based on type and period
    // Note: This is a simplified implementation - for production, consider caching leaderboards
    const entries: LeaderboardEntry[] = [];
    
    // Get all user preferences with gamification data
    const allUserPrefs = await prisma.userPreference.findMany({
      include: { user: true },
    });

    // Extract and sort by points
    const profiles = allUserPrefs
      .map(up => ({
        user: up.user,
        gamification: (up.notifications as any)?.gamification,
      }))
      .filter(p => p.gamification?.totalPoints !== undefined)
      .sort((a, b) => (b.gamification?.totalPoints || 0) - (a.gamification?.totalPoints || 0))
      .slice(0, limit);

    profiles.forEach((profile, index) => {
      entries.push({
        userId: profile.user.id,
        userName: profile.user.name || 'Anonymous',
        userAvatar: profile.user.image || undefined,
        score: profile.gamification?.totalPoints || 0,
        rank: index + 1,
        change: 0, // Would calculate based on previous period
        badges: (profile.gamification?.badges || []) as string[],
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
