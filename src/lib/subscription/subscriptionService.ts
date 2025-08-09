import { prisma } from '@/lib/prisma';
import { stripeService } from '@/lib/payments/stripeService';
import { emailService } from '@/lib/email/emailService';
import { realTimeSyncService } from '@/lib/sync/realTimeSyncService';

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  interval: 'month' | 'year' | 'week' | 'day';
  intervalCount: number;
  trialPeriodDays?: number;
  features: string[];
  limits: {
    products?: number;
    orders?: number;
    storage?: number; // in GB
    apiCalls?: number;
    users?: number;
    warehouses?: number;
  };
  isActive: boolean;
  isPopular?: boolean;
  stripePriceId?: string;
  paypalPlanId?: string;
}

export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  status: 'active' | 'canceled' | 'past_due' | 'unpaid' | 'trialing' | 'paused';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialStart?: Date;
  trialEnd?: Date;
  cancelAt?: Date;
  canceledAt?: Date;
  pausedAt?: Date;
  resumeAt?: Date;
  stripeSubscriptionId?: string;
  paypalSubscriptionId?: string;
  metadata?: Record<string, any>;
}

export interface UsageRecord {
  id: string;
  subscriptionId: string;
  metricType: string;
  quantity: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface MembershipTier {
  id: string;
  name: string;
  level: number;
  benefits: string[];
  requirements: {
    minSpent?: number;
    minOrders?: number;
    membershipDuration?: number; // in days
  };
  discountPercentage?: number;
  freeShipping?: boolean;
  prioritySupport?: boolean;
  earlyAccess?: boolean;
}

export interface MembershipStatus {
  userId: string;
  tierId: string;
  level: number;
  totalSpent: number;
  totalOrders: number;
  memberSince: Date;
  nextTierProgress?: {
    nextTierId: string;
    currentProgress: number;
    requiredAmount: number;
  };
}

export interface SubscriptionBox {
  id: string;
  name: string;
  description: string;
  price: number;
  frequency: 'weekly' | 'monthly' | 'quarterly';
  categories: string[];
  customizable: boolean;
  minItems: number;
  maxItems: number;
  isActive: boolean;
}

export interface BoxSubscription {
  id: string;
  userId: string;
  boxId: string;
  preferences: {
    categories?: string[];
    excludeItems?: string[];
    allergies?: string[];
    dietaryRestrictions?: string[];
  };
  deliveryAddress: any;
  nextDelivery: Date;
  status: 'active' | 'paused' | 'canceled';
}

export class SubscriptionService {
  /**
   * Create subscription plan
   */
  async createPlan(plan: Omit<SubscriptionPlan, 'id' | 'stripePriceId' | 'paypalPlanId'>): Promise<SubscriptionPlan> {
    try {
      // Create Stripe price
      let stripePriceId;
      try {
        const stripePrice = await stripeService.createPrice({
          amount: plan.price * 100, // Convert to cents
          currency: plan.currency,
          interval: plan.interval,
          intervalCount: plan.intervalCount,
          productName: plan.name,
          productDescription: plan.description,
        });
        stripePriceId = stripePrice.id;
      } catch (error) {
        console.warn('Failed to create Stripe price:', error);
      }

      // Create database record
      const createdPlan = await prisma.subscriptionPlan.create({
        data: {
          name: plan.name,
          description: plan.description,
          price: plan.price,
          currency: plan.currency,
          interval: plan.interval,
          intervalCount: plan.intervalCount,
          trialPeriodDays: plan.trialPeriodDays,
          features: plan.features,
          limits: plan.limits,
          isActive: plan.isActive,
          isPopular: plan.isPopular,
          stripePriceId,
        },
      });

      return {
        id: createdPlan.id,
        name: createdPlan.name,
        description: createdPlan.description,
        price: createdPlan.price,
        currency: createdPlan.currency,
        interval: createdPlan.interval as 'month' | 'year' | 'week' | 'day',
        intervalCount: createdPlan.intervalCount,
        trialPeriodDays: createdPlan.trialPeriodDays,
        features: createdPlan.features as string[],
        limits: createdPlan.limits as any,
        isActive: createdPlan.isActive,
        isPopular: createdPlan.isPopular,
        stripePriceId: createdPlan.stripePriceId,
      };
    } catch (error) {
      console.error('Error creating subscription plan:', error);
      throw new Error('Failed to create subscription plan');
    }
  }

  /**
   * Subscribe user to plan
   */
  async createSubscription(
    userId: string,
    planId: string,
    paymentMethod: 'stripe' | 'paypal' = 'stripe',
    trialDays?: number
  ): Promise<Subscription> {
    try {
      const plan = await prisma.subscriptionPlan.findUnique({
        where: { id: planId },
      });

      if (!plan || !plan.isActive) {
        throw new Error('Plan not found or inactive');
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new Error('User not found');
      }

      let stripeSubscriptionId;
      let paypalSubscriptionId;

      if (paymentMethod === 'stripe' && plan.stripePriceId) {
        // Create Stripe subscription
        const stripeSubscription = await stripeService.createSubscription(
          user.stripeCustomerId!,
          plan.stripePriceId,
          {
            userId,
            planId,
            trialPeriodDays: trialDays || plan.trialPeriodDays,
          }
        );
        stripeSubscriptionId = stripeSubscription.id;
      }

      // Calculate period dates
      const now = new Date();
      const trialEnd = trialDays ? new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000) : undefined;
      const periodStart = trialEnd || now;
      const periodEnd = new Date(
        periodStart.getTime() + 
        this.getIntervalMilliseconds(plan.interval as any, plan.intervalCount)
      );

      // Create subscription record
      const subscription = await prisma.subscription.create({
        data: {
          userId,
          planId,
          status: trialDays ? 'trialing' : 'active',
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          trialStart: trialDays ? now : undefined,
          trialEnd: trialEnd,
          stripeSubscriptionId,
          paypalSubscriptionId,
          metadata: {
            createdVia: paymentMethod,
            originalPlan: plan.name,
          },
        },
      });

      // Update user's subscription status
      await prisma.user.update({
        where: { id: userId },
        data: {
          subscriptionId: subscription.id,
          subscriptionStatus: subscription.status,
        },
      });

      // Send welcome email
      await this.sendSubscriptionWelcomeEmail(userId, plan);

      // Broadcast event
      await realTimeSyncService.broadcastEvent({
        type: 'subscription_created',
        entityId: subscription.id,
        entityType: 'subscription',
        organizationId: user.organizationId,
        data: subscription,
        timestamp: new Date(),
      });

      return {
        id: subscription.id,
        userId: subscription.userId,
        planId: subscription.planId,
        status: subscription.status as any,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        trialStart: subscription.trialStart,
        trialEnd: subscription.trialEnd,
        stripeSubscriptionId: subscription.stripeSubscriptionId,
        paypalSubscriptionId: subscription.paypalSubscriptionId,
        metadata: subscription.metadata as any,
      };
    } catch (error) {
      console.error('Error creating subscription:', error);
      throw new Error('Failed to create subscription');
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(
    subscriptionId: string,
    immediate: boolean = false,
    reason?: string
  ): Promise<Subscription> {
    try {
      const subscription = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
        include: { user: true, plan: true },
      });

      if (!subscription) {
        throw new Error('Subscription not found');
      }

      // Cancel with payment provider
      if (subscription.stripeSubscriptionId) {
        await stripeService.cancelSubscription(subscription.stripeSubscriptionId, immediate);
      }

      const now = new Date();
      const cancelAt = immediate ? now : subscription.currentPeriodEnd;

      // Update subscription
      const updatedSubscription = await prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          status: immediate ? 'canceled' : 'active',
          cancelAt: immediate ? undefined : cancelAt,
          canceledAt: immediate ? now : undefined,
          metadata: {
            ...subscription.metadata as any,
            cancellationReason: reason,
            canceledAt: now.toISOString(),
          },
        },
      });

      // Send cancellation email
      await this.sendCancellationEmail(subscription.user, subscription.plan, immediate);

      return {
        id: updatedSubscription.id,
        userId: updatedSubscription.userId,
        planId: updatedSubscription.planId,
        status: updatedSubscription.status as any,
        currentPeriodStart: updatedSubscription.currentPeriodStart,
        currentPeriodEnd: updatedSubscription.currentPeriodEnd,
        cancelAt: updatedSubscription.cancelAt,
        canceledAt: updatedSubscription.canceledAt,
        stripeSubscriptionId: updatedSubscription.stripeSubscriptionId,
        metadata: updatedSubscription.metadata as any,
      };
    } catch (error) {
      console.error('Error canceling subscription:', error);
      throw new Error('Failed to cancel subscription');
    }
  }

  /**
   * Track usage for metered billing
   */
  async recordUsage(
    subscriptionId: string,
    metricType: string,
    quantity: number,
    metadata?: Record<string, any>
  ): Promise<UsageRecord> {
    try {
      const usageRecord = await prisma.usageRecord.create({
        data: {
          subscriptionId,
          metricType,
          quantity,
          timestamp: new Date(),
          metadata,
        },
      });

      // Check if usage limits are exceeded
      await this.checkUsageLimits(subscriptionId, metricType);

      return {
        id: usageRecord.id,
        subscriptionId: usageRecord.subscriptionId,
        metricType: usageRecord.metricType,
        quantity: usageRecord.quantity,
        timestamp: usageRecord.timestamp,
        metadata: usageRecord.metadata as any,
      };
    } catch (error) {
      console.error('Error recording usage:', error);
      throw new Error('Failed to record usage');
    }
  }

  /**
   * Create membership tiers
   */
  async createMembershipTier(tier: Omit<MembershipTier, 'id'>): Promise<MembershipTier> {
    try {
      const createdTier = await prisma.membershipTier.create({
        data: {
          name: tier.name,
          level: tier.level,
          benefits: tier.benefits,
          requirements: tier.requirements,
          discountPercentage: tier.discountPercentage,
          freeShipping: tier.freeShipping,
          prioritySupport: tier.prioritySupport,
          earlyAccess: tier.earlyAccess,
        },
      });

      return {
        id: createdTier.id,
        name: createdTier.name,
        level: createdTier.level,
        benefits: createdTier.benefits as string[],
        requirements: createdTier.requirements as any,
        discountPercentage: createdTier.discountPercentage,
        freeShipping: createdTier.freeShipping,
        prioritySupport: createdTier.prioritySupport,
        earlyAccess: createdTier.earlyAccess,
      };
    } catch (error) {
      console.error('Error creating membership tier:', error);
      throw new Error('Failed to create membership tier');
    }
  }

  /**
   * Update user membership status
   */
  async updateMembershipStatus(userId: string): Promise<MembershipStatus | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          orders: {
            where: { status: 'COMPLETED' },
          },
          membership: true,
        },
      });

      if (!user) return null;

      // Calculate totals
      const totalSpent = user.orders.reduce((sum, order) => sum + order.total, 0);
      const totalOrders = user.orders.length;
      const memberSince = user.membership?.createdAt || user.createdAt;

      // Get all tiers ordered by level
      const tiers = await prisma.membershipTier.findMany({
        orderBy: { level: 'asc' },
      });

      // Find appropriate tier
      let currentTier = tiers[0]; // Default to lowest tier
      
      for (const tier of tiers) {
        const requirements = tier.requirements as any;
        const meetsSpending = !requirements.minSpent || totalSpent >= requirements.minSpent;
        const meetsOrders = !requirements.minOrders || totalOrders >= requirements.minOrders;
        const meetsDuration = !requirements.membershipDuration || 
          (Date.now() - memberSince.getTime()) >= (requirements.membershipDuration * 24 * 60 * 60 * 1000);

        if (meetsSpending && meetsOrders && meetsDuration) {
          currentTier = tier;
        }
      }

      // Find next tier
      const nextTier = tiers.find(tier => tier.level > currentTier.level);
      
      let nextTierProgress;
      if (nextTier) {
        const nextRequirements = nextTier.requirements as any;
        const requiredAmount = nextRequirements.minSpent || 0;
        const currentProgress = Math.min(totalSpent, requiredAmount);
        
        nextTierProgress = {
          nextTierId: nextTier.id,
          currentProgress,
          requiredAmount,
        };
      }

      // Update or create membership record
      const membershipStatus = await prisma.membershipStatus.upsert({
        where: { userId },
        update: {
          tierId: currentTier.id,
          level: currentTier.level,
          totalSpent,
          totalOrders,
        },
        create: {
          userId,
          tierId: currentTier.id,
          level: currentTier.level,
          totalSpent,
          totalOrders,
          memberSince,
        },
      });

      return {
        userId: membershipStatus.userId,
        tierId: membershipStatus.tierId,
        level: membershipStatus.level,
        totalSpent: membershipStatus.totalSpent,
        totalOrders: membershipStatus.totalOrders,
        memberSince: membershipStatus.memberSince,
        nextTierProgress,
      };
    } catch (error) {
      console.error('Error updating membership status:', error);
      throw new Error('Failed to update membership status');
    }
  }

  /**
   * Create subscription box
   */
  async createSubscriptionBox(box: Omit<SubscriptionBox, 'id'>): Promise<SubscriptionBox> {
    try {
      const createdBox = await prisma.subscriptionBox.create({
        data: {
          name: box.name,
          description: box.description,
          price: box.price,
          frequency: box.frequency,
          categories: box.categories,
          customizable: box.customizable,
          minItems: box.minItems,
          maxItems: box.maxItems,
          isActive: box.isActive,
        },
      });

      return {
        id: createdBox.id,
        name: createdBox.name,
        description: createdBox.description,
        price: createdBox.price,
        frequency: createdBox.frequency as any,
        categories: createdBox.categories as string[],
        customizable: createdBox.customizable,
        minItems: createdBox.minItems,
        maxItems: createdBox.maxItems,
        isActive: createdBox.isActive,
      };
    } catch (error) {
      console.error('Error creating subscription box:', error);
      throw new Error('Failed to create subscription box');
    }
  }

  /**
   * Private helper methods
   */
  private getIntervalMilliseconds(interval: 'month' | 'year' | 'week' | 'day', count: number): number {
    const intervals = {
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000, // Approximate
      year: 365 * 24 * 60 * 60 * 1000, // Approximate
    };

    return intervals[interval] * count;
  }

  private async checkUsageLimits(subscriptionId: string, metricType: string): Promise<void> {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { plan: true },
    });

    if (!subscription) return;

    const limits = subscription.plan.limits as any;
    const limit = limits[metricType];

    if (!limit) return;

    // Get usage for current period
    const usage = await prisma.usageRecord.aggregate({
      where: {
        subscriptionId,
        metricType,
        timestamp: {
          gte: subscription.currentPeriodStart,
          lte: subscription.currentPeriodEnd,
        },
      },
      _sum: { quantity: true },
    });

    const totalUsage = usage._sum.quantity || 0;

    if (totalUsage >= limit) {
      // Send usage limit notification
      await this.sendUsageLimitEmail(subscription.userId, metricType, totalUsage, limit);
    }
  }

  private async sendSubscriptionWelcomeEmail(userId: string, plan: any): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.email) return;

    await emailService.sendEmail({
      to: user.email,
      subject: `Welcome to ${plan.name}!`,
      templateId: 'subscription-welcome',
      templateData: {
        userName: user.name,
        planName: plan.name,
        features: plan.features,
        dashboardUrl: `${process.env.NEXTAUTH_URL}/dashboard/subscription`,
      },
    });
  }

  private async sendCancellationEmail(user: any, plan: any, immediate: boolean): Promise<void> {
    if (!user.email) return;

    await emailService.sendEmail({
      to: user.email,
      subject: 'Subscription Canceled',
      templateId: 'subscription-canceled',
      templateData: {
        userName: user.name,
        planName: plan.name,
        immediate,
        endDate: immediate ? new Date() : plan.currentPeriodEnd,
      },
    });
  }

  private async sendUsageLimitEmail(userId: string, metricType: string, usage: number, limit: number): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.email) return;

    await emailService.sendEmail({
      to: user.email,
      subject: 'Usage Limit Reached',
      templateId: 'usage-limit',
      templateData: {
        userName: user.name,
        metricType,
        usage,
        limit,
        upgradeUrl: `${process.env.NEXTAUTH_URL}/dashboard/subscription/upgrade`,
      },
    });
  }
}

export const subscriptionService = new SubscriptionService();
