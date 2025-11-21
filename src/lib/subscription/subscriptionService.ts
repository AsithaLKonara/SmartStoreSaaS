import { prisma } from '@/lib/prisma';
import { stripeService } from '@/lib/payments/stripeService';
import { emailService } from '@/lib/email/emailService';
import { realTimeSyncService } from '@/lib/sync/realTimeSyncService';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

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
  organizationId?: string;
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
        // Use Stripe API directly since createPrice doesn't exist in StripeService
        const stripePrice = await stripe.prices.create({
          unit_amount: plan.price * 100, // Convert to cents
          currency: plan.currency,
          recurring: {
            interval: plan.interval as 'month' | 'year' | 'week' | 'day',
            interval_count: plan.intervalCount,
          },
          product_data: {
            name: plan.name,
            description: plan.description,
          },
        });
        stripePriceId = stripePrice.id;
      } catch (error) {
        console.warn('Failed to create Stripe price:', error);
      }

      // Store plan in Organization settings instead of separate model
      if (!plan.organizationId) {
        throw new Error('Organization ID is required');
      }
      const organization = await prisma.organization.findUnique({
        where: { id: plan.organizationId },
      });
      if (!organization) {
        throw new Error('Organization not found');
      }
      const settings = (organization.settings as any) || {};
      const subscriptionPlans = settings.subscriptionPlans || [];
      const planData = {
        id: `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...plan,
        stripePriceId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      subscriptionPlans.push(planData);
      await prisma.organization.update({
        where: { id: organization.id },
        data: {
          settings: {
            ...settings,
            subscriptionPlans,
          } as any,
        },
      });
      return {
        id: planData.id,
        name: planData.name,
        description: planData.description,
        price: planData.price,
        currency: planData.currency,
        interval: planData.interval as 'month' | 'year' | 'week' | 'day',
        intervalCount: planData.intervalCount,
        trialPeriodDays: planData.trialPeriodDays,
        features: planData.features,
        limits: planData.limits,
        isActive: planData.isActive,
        isPopular: planData.isPopular,
        stripePriceId: planData.stripePriceId,
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
      // Get user and organization
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user || !user.organizationId) {
        throw new Error('User not found or has no organization');
      }

      // Get plan from Organization settings
      const organization = await prisma.organization.findUnique({
        where: { id: user.organizationId },
      });
      if (!organization) {
        throw new Error('Organization not found');
      }
      const settings = (organization.settings as any) || {};
      const subscriptionPlans = settings.subscriptionPlans || [];
      const plan = subscriptionPlans.find((p: any) => p.id === planId);

      if (!plan || !plan.isActive) {
        throw new Error('Plan not found or inactive');
      }

      // Get or create customer for this user
      let customer = await prisma.customer.findFirst({
        where: {
          organizationId: user.organizationId,
          email: user.email,
        },
      });

      if (!customer) {
        // Create customer for user
        customer = await prisma.customer.create({
          data: {
            organizationId: user.organizationId,
            email: user.email,
            name: user.name,
            isActive: true,
          },
        });
      }

      // Get stripeCustomerId from UserPreference
      const userPref = await prisma.userPreference.findUnique({
        where: { userId },
      });
      const stripeCustomerId = (userPref?.notifications as any)?.stripeCustomerId;

      let stripeSubscriptionId;
      let paypalSubscriptionId;

      if (paymentMethod === 'stripe' && plan.stripePriceId && stripeCustomerId) {
        // Create Stripe subscription
        const stripeSubscription = await stripeService.createSubscription(
          stripeCustomerId,
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
          customerId: customer.id,
          status: trialDays ? 'trialing' : 'active',
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          stripeSubscriptionId,
          metadata: {
            userId,
            planId,
            trialStart: trialDays ? now.toISOString() : undefined,
            trialEnd: trialEnd?.toISOString(),
            paypalSubscriptionId,
            createdVia: paymentMethod,
            originalPlan: plan.name,
          } as any,
        },
      });

      // Store subscriptionId in UserPreference
      await prisma.userPreference.upsert({
        where: { userId },
        update: {
          notifications: {
            ...(userPref?.notifications as any || {}),
            subscriptionId: subscription.id,
          } as any,
        },
        create: {
          userId,
          notifications: {
            subscriptionId: subscription.id,
          } as any,
        },
      });

      // Send welcome email
      await this.sendSubscriptionWelcomeEmail(userId, plan);

      // Broadcast event
      await realTimeSyncService.queueEvent({
        type: 'message',
        action: 'create',
        entityId: subscription.id,
        organizationId: user.organizationId || '',
        data: subscription,
        timestamp: new Date(),
      });

      const subMetadata = (subscription.metadata as any) || {};
      return {
        id: subscription.id,
        userId: subMetadata.userId || '',
        planId: subMetadata.planId || '',
        status: subscription.status as any,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        trialStart: subMetadata.trialStart ? new Date(subMetadata.trialStart) : undefined,
        trialEnd: subMetadata.trialEnd ? new Date(subMetadata.trialEnd) : undefined,
        stripeSubscriptionId: subscription.stripeSubscriptionId,
        paypalSubscriptionId: subMetadata.paypalSubscriptionId,
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
        include: { customer: true },
      });

      if (!subscription) {
        throw new Error('Subscription not found');
      }

      // Cancel with payment provider
      if (subscription.stripeSubscriptionId) {
        await stripeService.cancelSubscription(subscription.stripeSubscriptionId);
      }

      const now = new Date();
      const cancelAt = immediate ? now : subscription.currentPeriodEnd;
      const subMetadata = (subscription.metadata as any) || {};

      // Update subscription
      const updatedSubscription = await prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          status: immediate ? 'canceled' : 'active',
          cancelAtPeriodEnd: !immediate,
          metadata: {
            ...subMetadata,
            cancelAt: cancelAt.toISOString(),
            canceledAt: immediate ? now.toISOString() : undefined,
            cancellationReason: reason,
          } as any,
        },
      });

      // Get user and plan for email
      const userId = subMetadata.userId;
      const planId = subMetadata.planId;
      const user = userId ? await prisma.user.findUnique({ where: { id: userId } }) : null;
      const organization = subscription.customer?.organizationId ? await prisma.organization.findUnique({
        where: { id: subscription.customer.organizationId },
      }) : null;
      const plan = planId && organization ? ((organization.settings as any)?.subscriptionPlans || []).find((p: any) => p.id === planId) : null;

      // Send cancellation email
      if (user && plan) {
        await this.sendCancellationEmail(user, plan, immediate);
      }

      const updatedMetadata = (updatedSubscription.metadata as any) || {};
      return {
        id: updatedSubscription.id,
        userId: updatedMetadata.userId || '',
        planId: updatedMetadata.planId || '',
        status: updatedSubscription.status as any,
        currentPeriodStart: updatedSubscription.currentPeriodStart,
        currentPeriodEnd: updatedSubscription.currentPeriodEnd,
        cancelAt: updatedMetadata.cancelAt ? new Date(updatedMetadata.cancelAt) : undefined,
        canceledAt: updatedMetadata.canceledAt ? new Date(updatedMetadata.canceledAt) : undefined,
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
      // Store usage record in Subscription metadata
      const subscription = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
      });
      if (!subscription) {
        throw new Error('Subscription not found');
      }
      const subMetadata = (subscription.metadata as any) || {};
      const usageRecords = subMetadata.usageRecords || [];
      const usageRecord = {
        id: `usage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        subscriptionId,
        metricType,
        quantity,
        timestamp: new Date().toISOString(),
        metadata,
      };
      usageRecords.push(usageRecord);
      await prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          metadata: {
            ...subMetadata,
            usageRecords,
          } as any,
        },
      });

      // Check if usage limits are exceeded
      await this.checkUsageLimits(subscriptionId, metricType);

      return {
        id: usageRecord.id,
        subscriptionId: usageRecord.subscriptionId,
        metricType: usageRecord.metricType,
        quantity: usageRecord.quantity,
        timestamp: new Date(usageRecord.timestamp),
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
      // Store membership tier in Organization settings
      if (!tier.organizationId) {
        throw new Error('Organization ID is required');
      }
      const organization = await prisma.organization.findUnique({
        where: { id: tier.organizationId },
      });
      if (!organization) {
        throw new Error('Organization not found');
      }
      const settings = (organization.settings as any) || {};
      const membershipTiers = settings.membershipTiers || [];
      const tierData = {
        id: `tier_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...tier,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      membershipTiers.push(tierData);
      await prisma.organization.update({
        where: { id: organization.id },
        data: {
          settings: {
            ...settings,
            membershipTiers,
          } as any,
        },
      });
      const createdTier = tierData;

      return {
        id: createdTier.id,
        name: createdTier.name,
        level: createdTier.level,
        benefits: createdTier.benefits,
        requirements: createdTier.requirements,
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
      });

      if (!user || !user.organizationId) return null;

      // Get customer and their orders
      const customer = await prisma.customer.findFirst({
        where: {
          organizationId: user.organizationId,
          email: user.email,
        },
        include: {
          orders: {
            where: { status: 'COMPLETED' },
          },
        },
      });

      if (!customer) return null;

      // Calculate totals
      const totalSpent = customer.orders.reduce((sum, order) => sum + order.totalAmount, 0);
      const totalOrders = customer.orders.length;

      // Get membership status from UserPreference
      const userPref = await prisma.userPreference.findUnique({
        where: { userId },
      });
      const membershipData = (userPref?.notifications as any)?.membershipStatus || {};
      const memberSince = membershipData.memberSince ? new Date(membershipData.memberSince) : user.createdAt;

      // Get all tiers from Organization settings
      const organization = await prisma.organization.findUnique({
        where: { id: user.organizationId },
      });
      if (!organization) return null;
      const settings = (organization.settings as any) || {};
      const tiers = (settings.membershipTiers || []).sort((a: any, b: any) => a.level - b.level);

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

      // Store membership status in UserPreference
      const membershipStatus = {
        userId,
        tierId: currentTier.id,
        level: currentTier.level,
        totalSpent,
        totalOrders,
        memberSince: memberSince.toISOString(),
        nextTierProgress,
      };

      await prisma.userPreference.upsert({
        where: { userId },
        update: {
          notifications: {
            ...(userPref?.notifications as any || {}),
            membershipStatus,
          } as any,
        },
        create: {
          userId,
          notifications: {
            membershipStatus,
          } as any,
        },
      });

      return {
        userId: membershipStatus.userId,
        tierId: membershipStatus.tierId,
        level: membershipStatus.level,
        totalSpent: membershipStatus.totalSpent,
        totalOrders: membershipStatus.totalOrders,
        memberSince: new Date(membershipStatus.memberSince),
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
      // Store subscription box in Organization settings
      if (!box.organizationId) {
        throw new Error('Organization ID is required');
      }
      const organization = await prisma.organization.findUnique({
        where: { id: box.organizationId },
      });
      if (!organization) {
        throw new Error('Organization not found');
      }
      const settings = (organization.settings as any) || {};
      const subscriptionBoxes = settings.subscriptionBoxes || [];
      const boxData = {
        id: `box_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...box,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      subscriptionBoxes.push(boxData);
      await prisma.organization.update({
        where: { id: organization.id },
        data: {
          settings: {
            ...settings,
            subscriptionBoxes,
          } as any,
        },
      });
      const createdBox = boxData;

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
      include: { customer: true },
    });

    if (!subscription || !subscription.customer?.organizationId) return;

    // Get plan from Organization settings
    const organization = await prisma.organization.findUnique({
      where: { id: subscription.customer.organizationId },
    });
    if (!organization) return;

    const subMetadata = (subscription.metadata as any) || {};
    const planId = subMetadata.planId;
    if (!planId) return;

    const settings = (organization.settings as any) || {};
    const subscriptionPlans = settings.subscriptionPlans || [];
    const plan = subscriptionPlans.find((p: any) => p.id === planId);
    if (!plan) return;

    const limits = plan.limits || {};
    const limit = limits[metricType];

    if (!limit) return;

    // Get usage for current period from metadata
    const usageRecords = subMetadata.usageRecords || [];
    const periodStart = subscription.currentPeriodStart.getTime();
    const periodEnd = subscription.currentPeriodEnd.getTime();
    const periodUsage = usageRecords
      .filter((r: any) => {
        const timestamp = new Date(r.timestamp).getTime();
        return r.metricType === metricType && timestamp >= periodStart && timestamp <= periodEnd;
      })
      .reduce((sum: number, r: any) => sum + (r.quantity || 0), 0);
    const usage = { _sum: { quantity: periodUsage } };

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
