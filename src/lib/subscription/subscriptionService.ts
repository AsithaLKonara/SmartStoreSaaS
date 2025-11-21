import { prisma } from '@/lib/prisma';
import { stripeService } from '@/lib/payments/stripeService';
import { emailService } from '@/lib/email/emailService';
import { realTimeSyncService } from '@/lib/sync/realTimeSyncService';
<<<<<<< HEAD
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});
=======
import crypto from 'crypto';
>>>>>>> 08d9e1855dc7fd2c99e5d62def516239ff37a9a7

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
  customerId: string;
  status: string; // Changed to string to match Prisma schema
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  stripeSubscriptionId?: string | null;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
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
  async createPlan(plan: Omit<SubscriptionPlan, 'id' | 'stripePriceId' | 'paypalPlanId'>): Promise<SubscriptionPlan> {
    try {
<<<<<<< HEAD
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
=======
      // Since subscriptionPlan doesn't exist in schema, we'll store it in metadata
      const createdPlan = await prisma.subscription.create({
        data: {
          customerId: 'temp', // This will need to be fixed based on actual requirements
          status: 'active',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          cancelAtPeriodEnd: false,
          metadata: {
            plan: plan,
            type: 'plan_definition'
          }
        }
>>>>>>> 08d9e1855dc7fd2c99e5d62def516239ff37a9a7
      });
      return {
<<<<<<< HEAD
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
=======
        ...plan,
        id: createdPlan.id,
        stripePriceId: undefined,
        paypalPlanId: undefined
>>>>>>> 08d9e1855dc7fd2c99e5d62def516239ff37a9a7
      };
    } catch (error) {
      throw new Error(`Failed to create subscription plan: ${error}`);
    }
  }

  async createSubscription(
    customerId: string,
    planId: string,
    paymentMethod: 'stripe' | 'paypal' = 'stripe',
    trialDays?: number
  ): Promise<Subscription> {
    try {
<<<<<<< HEAD
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
=======
      let stripeSubscriptionId: string | null = null;

      if (paymentMethod === 'stripe') {
        // Create Stripe subscription - fixed method call
        const metadata: Record<string, string> = {
          planId,
          paymentMethod
        };
        
        if (trialDays !== undefined) {
          metadata.trialDays = trialDays.toString();
        }
        
        const stripeSubscription = await stripeService.createSubscription(
          customerId,
          planId,
          metadata
>>>>>>> 08d9e1855dc7fd2c99e5d62def516239ff37a9a7
        );
        stripeSubscriptionId = stripeSubscription.id;
      }

      const subscription = await prisma.subscription.create({
        data: {
<<<<<<< HEAD
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
=======
          customerId,
          status: 'active',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          cancelAtPeriodEnd: false,
          stripeSubscriptionId,
          metadata: {
            planId,
            paymentMethod,
            trialDays
          }
        }
      });

      // Broadcast real-time sync event
      try {
        await realTimeSyncService.broadcastEvent({
          id: crypto.randomUUID(),
          type: 'customer',
          action: 'create',
          entityId: customerId,
          organizationId: process.env.DEFAULT_ORGANIZATION_ID || 'default',
          timestamp: new Date(),
          source: 'subscription-service',
          data: {
            subscriptionId: subscription.id,
            customerId: subscription.customerId,
            status: subscription.status
          }
        });
      } catch (syncError) {
        console.warn('Failed to broadcast subscription event:', syncError);
      }

      return subscription as Subscription;
>>>>>>> 08d9e1855dc7fd2c99e5d62def516239ff37a9a7
    } catch (error) {
      throw new Error(`Failed to create subscription: ${error}`);
    }
  }

  async getSubscription(subscriptionId: string): Promise<Subscription | null> {
    try {
      const subscription = await prisma.subscription.findUnique({
        where: { id: subscriptionId }
      });
      return subscription as Subscription | null;
    } catch (error) {
      throw new Error(`Failed to get subscription: ${error}`);
    }
  }

  async updateSubscription(
    subscriptionId: string,
    updates: Partial<Subscription>
  ): Promise<Subscription> {
    try {
      const updatedSubscription = await prisma.subscription.update({
        where: { id: subscriptionId },
        data: updates
      });

      // Broadcast real-time sync event
      try {
        await realTimeSyncService.broadcastEvent({
          id: crypto.randomUUID(),
          type: 'customer',
          action: 'update',
          entityId: updatedSubscription.customerId,
          organizationId: process.env.DEFAULT_ORGANIZATION_ID || 'default',
          timestamp: new Date(),
          source: 'subscription-service',
          data: {
            subscriptionId: updatedSubscription.id,
            customerId: updatedSubscription.customerId,
            status: updatedSubscription.status
          }
        });
      } catch (syncError) {
        console.warn('Failed to broadcast subscription update event:', syncError);
      }

      return updatedSubscription as Subscription;
    } catch (error) {
      throw new Error(`Failed to update subscription: ${error}`);
    }
  }

  async cancelSubscription(
    subscriptionId: string,
    immediate: boolean = false,
    reason?: string
  ): Promise<Subscription> {
    try {
      const subscription = await prisma.subscription.findUnique({
<<<<<<< HEAD
        where: { id: subscriptionId },
        include: { customer: true },
=======
        where: { id: subscriptionId }
>>>>>>> 08d9e1855dc7fd2c99e5d62def516239ff37a9a7
      });

      if (!subscription) {
        throw new Error('Subscription not found');
      }

<<<<<<< HEAD
      // Cancel with payment provider
      if (subscription.stripeSubscriptionId) {
        await stripeService.cancelSubscription(subscription.stripeSubscriptionId);
      }

      const now = new Date();
      const cancelAt = immediate ? now : subscription.currentPeriodEnd;
      const subMetadata = (subscription.metadata as any) || {};
=======
      let cancelAt: Date | undefined;
      if (!immediate) {
        cancelAt = new Date(subscription.currentPeriodEnd);
      }

      // Cancel in Stripe if exists
      if (subscription.stripeSubscriptionId) {
        try {
          await stripeService.cancelSubscription(subscription.stripeSubscriptionId);
        } catch (stripeError) {
          console.warn('Failed to cancel Stripe subscription:', stripeError);
        }
      }
>>>>>>> 08d9e1855dc7fd2c99e5d62def516239ff37a9a7

      const updatedSubscription = await prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          status: immediate ? 'canceled' : 'active',
          cancelAtPeriodEnd: !immediate,
          metadata: {
<<<<<<< HEAD
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
=======
            ...(subscription.metadata as Record<string, any> || {}),
            cancelReason: reason,
            canceledAt: immediate ? new Date() : undefined
          }
        }
      });

      // Send cancellation email
      try {
        // Send cancellation email
        await this.sendCancellationEmail(subscription.id);
      } catch (emailError) {
        console.warn('Failed to send cancellation email:', emailError);
      }

      // Broadcast real-time sync event
      try {
        await realTimeSyncService.broadcastEvent({
          id: crypto.randomUUID(),
          type: 'customer',
          action: 'update',
          entityId: updatedSubscription.customerId,
          organizationId: process.env.DEFAULT_ORGANIZATION_ID || 'default',
          timestamp: new Date(),
          source: 'subscription-service',
          data: {
            subscriptionId: updatedSubscription.id,
            customerId: updatedSubscription.customerId,
            status: updatedSubscription.status,
            immediate
          }
        });
      } catch (syncError) {
        console.warn('Failed to broadcast subscription cancellation event:', syncError);
      }

      return updatedSubscription as Subscription;
>>>>>>> 08d9e1855dc7fd2c99e5d62def516239ff37a9a7
    } catch (error) {
      throw new Error(`Failed to cancel subscription: ${error}`);
    }
  }

  async recordUsage(
    subscriptionId: string,
    metricType: string,
    quantity: number,
    metadata?: Record<string, any>
  ): Promise<UsageRecord> {
    try {
<<<<<<< HEAD
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
=======
      // Check usage limits before recording
>>>>>>> 08d9e1855dc7fd2c99e5d62def516239ff37a9a7
      await this.checkUsageLimits(subscriptionId, metricType);

      // Get current subscription
      const subscription = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
        select: { metadata: true }
      });

      if (!subscription) {
        throw new Error('Subscription not found');
      }

      // Update usage in subscription metadata
      const currentUsage = (subscription.metadata as any)?.usage || {};
      const newUsage = {
        ...currentUsage,
        [metricType]: (currentUsage[metricType] || 0) + quantity,
        lastUpdated: new Date().toISOString()
      };

      await prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          metadata: {
            ...(subscription.metadata as Record<string, any> || {}),
            usage: newUsage
          }
        }
      });

      // Broadcast usage update event
      await realTimeSyncService.broadcastEvent({
        id: crypto.randomUUID(),
        type: 'customer',
        action: 'update',
        entityId: subscriptionId,
        organizationId: process.env.DEFAULT_ORGANIZATION_ID || 'default',
        timestamp: new Date(),
        source: 'subscription-service',
        data: {
          metricType,
          quantity,
          totalUsage: newUsage[metricType]
        }
      });

      // Return mock usage record since UsageRecord model doesn't exist
      return {
<<<<<<< HEAD
        id: usageRecord.id,
        subscriptionId: usageRecord.subscriptionId,
        metricType: usageRecord.metricType,
        quantity: usageRecord.quantity,
        timestamp: new Date(usageRecord.timestamp),
        metadata: usageRecord.metadata as any,
=======
        id: crypto.randomUUID(),
        subscriptionId,
        metricType,
        quantity,
        timestamp: new Date(),
        metadata
>>>>>>> 08d9e1855dc7fd2c99e5d62def516239ff37a9a7
      };
    } catch (error) {
      throw new Error(`Failed to record usage: ${error}`);
    }
  }

  async createMembershipTier(tier: Omit<MembershipTier, 'id'>): Promise<MembershipTier> {
    try {
<<<<<<< HEAD
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
=======
      // Since membershipTier doesn't exist in schema, we'll store it in metadata
      const createdTier = await prisma.subscription.create({
        data: {
          customerId: 'temp', // This will need to be fixed based on actual requirements
          status: 'active',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
          cancelAtPeriodEnd: false,
          metadata: {
            tier: tier,
            type: 'membership_tier'
          }
        }
>>>>>>> 08d9e1855dc7fd2c99e5d62def516239ff37a9a7
      });
      const createdTier = tierData;

      return {
<<<<<<< HEAD
        id: createdTier.id,
        name: createdTier.name,
        level: createdTier.level,
        benefits: createdTier.benefits,
        requirements: createdTier.requirements,
        discountPercentage: createdTier.discountPercentage,
        freeShipping: createdTier.freeShipping,
        prioritySupport: createdTier.prioritySupport,
        earlyAccess: createdTier.earlyAccess,
=======
        ...tier,
        id: createdTier.id
>>>>>>> 08d9e1855dc7fd2c99e5d62def516239ff37a9a7
      };
    } catch (error) {
      throw new Error(`Failed to create membership tier: ${error}`);
    }
  }

  async updateMembershipStatus(customerId: string): Promise<void> {
    try {
<<<<<<< HEAD
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
=======
      // Get customer with completed orders
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        include: {
          orders: {
            where: { status: 'COMPLETED' },
            select: { totalAmount: true, createdAt: true }
          }
        }
      });

      if (!customer) {
        throw new Error('Customer not found');
      }

      // Calculate total spent from completed orders
      const totalSpent = customer.orders.reduce((sum: number, order: any) => sum + order.totalAmount, 0);

      // Determine membership tier based on total spent
      const currentTier = this.getTierLevel(totalSpent);
      const nextTier = this.getNextTier(currentTier);
      const progress = this.calculateTierProgress(totalSpent, currentTier);
      const requiredForNextTier = this.getRequiredAmountForNextTier(nextTier);

      // Update customer metadata with membership info
      // Note: Customer model doesn't have metadata field, so we'll log this info
      console.log(`Customer ${customerId} membership status: Tier ${currentTier}, Progress ${progress}%, Next tier requires $${requiredForNextTier}`);

      // Update total spent
      await prisma.customer.update({
        where: { id: customerId },
        data: { totalSpent }
      });

      // Broadcast membership update
      realTimeSyncService.broadcastEvent({
        id: crypto.randomUUID(),
        type: 'customer',
        action: 'update',
        entityId: customerId,
        organizationId: process.env.DEFAULT_ORGANIZATION_ID || 'default',
        timestamp: new Date(),
        source: 'subscription-service',
        data: {
          type: 'membership_updated',
          tier: currentTier,
          progress,
          totalSpent
        }
      });

>>>>>>> 08d9e1855dc7fd2c99e5d62def516239ff37a9a7
    } catch (error) {
      console.error('Error updating membership status:', error);
      throw error;
    }
  }

  async createSubscriptionBox(box: Omit<SubscriptionBox, 'id'>): Promise<SubscriptionBox> {
    try {
<<<<<<< HEAD
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
=======
      // Since subscriptionBox doesn't exist in schema, we'll store it in metadata
      const createdBox = await prisma.subscription.create({
        data: {
          customerId: 'temp', // This will need to be fixed based on actual requirements
          status: 'active',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          cancelAtPeriodEnd: false,
          metadata: {
            box: box,
            type: 'subscription_box'
          }
        }
>>>>>>> 08d9e1855dc7fd2c99e5d62def516239ff37a9a7
      });
      const createdBox = boxData;

      return {
        ...box,
        id: createdBox.id
      };
    } catch (error) {
      throw new Error(`Failed to create subscription box: ${error}`);
    }
  }

  async getSubscriptionBoxes(customerId: string): Promise<any[]> {
    try {
      // Note: SubscriptionBox model doesn't exist in the schema
      // This functionality needs to be implemented with actual models
      console.warn('SubscriptionBox model not found in schema - returning empty array');
      return [];
    } catch (error) {
      console.error('Error getting subscription boxes:', error);
      throw error;
    }
  }

  private getIntervalMilliseconds(interval: 'month' | 'year' | 'week' | 'day', count: number): number {
    const multipliers = {
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
      year: 365 * 24 * 60 * 60 * 1000
    };

    return multipliers[interval] * count;
  }

  private async checkUsageLimits(subscriptionId: string, metricType: string): Promise<void> {
<<<<<<< HEAD
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
=======
    try {
      const subscription = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
        select: { metadata: true }
      });

      if (!subscription) return;

      const plan = (subscription.metadata as any)?.plan;
      if (!plan) {
        console.warn('No plan information found in subscription metadata');
        return;
      }
>>>>>>> 08d9e1855dc7fd2c99e5d62def516239ff37a9a7

      // Check usage limits based on plan
      const limits = plan.limits || {};
      const currentUsage = await this.getCurrentUsage(subscriptionId, metricType);
      const limit = limits[metricType];

<<<<<<< HEAD
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
=======
      if (limit && currentUsage >= limit) {
        throw new Error(`Usage limit exceeded for ${metricType}`);
      }
    } catch (error) {
      throw new Error(`Failed to check usage limits: ${error}`);
>>>>>>> 08d9e1855dc7fd2c99e5d62def516239ff37a9a7
    }
  }

  async sendSubscriptionWelcomeEmail(subscriptionId: string): Promise<void> {
    try {
      const subscription = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
        include: { customer: true }
      });

      if (!subscription || !subscription.customer) {
        throw new Error('Subscription or customer not found');
      }

      const customer = await prisma.customer.findUnique({
        where: { id: subscription.customerId }
      });

      if (!customer) {
        throw new Error('Customer not found');
      }

      await emailService.sendEmail({
        to: customer.email || '',
        subject: 'Welcome to Your Subscription!',
        templateId: 'subscription-welcome',
        templateData: {
          customerName: customer.name || 'Valued Customer',
          planName: (subscription.metadata as any)?.plan || 'Premium Plan',
          startDate: subscription.currentPeriodStart.toLocaleDateString(),
          endDate: subscription.currentPeriodEnd.toLocaleDateString()
        }
      });
    } catch (error) {
      console.error('Error sending welcome email:', error);
      throw error;
    }
  }

  async sendCancellationEmail(subscriptionId: string): Promise<void> {
    try {
      const subscription = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
        include: { customer: true }
      });

      if (!subscription || !subscription.customer) {
        throw new Error('Subscription or customer not found');
      }

      const customer = await prisma.customer.findUnique({
        where: { id: subscription.customerId }
      });

      if (!customer) {
        throw new Error('Customer not found');
      }

      await emailService.sendEmail({
        to: customer.email || '',
        subject: 'Subscription Cancelled',
        templateId: 'subscription-cancelled',
        templateData: {
          customerName: customer.name || 'Valued Customer',
          planName: (subscription.metadata as any)?.plan || 'Premium Plan',
          endDate: subscription.currentPeriodEnd.toLocaleDateString()
        }
      });
    } catch (error) {
      console.error('Error sending cancellation email:', error);
      throw error;
    }
  }

  async sendUsageLimitEmail(subscriptionId: string): Promise<void> {
    try {
      const subscription = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
        include: { customer: true }
      });

      if (!subscription || !subscription.customer) {
        throw new Error('Subscription or customer not found');
      }

      const customer = await prisma.customer.findUnique({
        where: { id: subscription.customerId }
      });

      if (!customer) {
        throw new Error('Customer not found');
      }

      await emailService.sendEmail({
        to: customer.email || '',
        subject: 'Usage Limit Reached',
        templateId: 'usage-limit-reached',
        templateData: {
          customerName: customer.name || 'Valued Customer',
          planName: (subscription.metadata as any)?.plan || 'Premium Plan',
          currentUsage: (subscription.metadata as any)?.usage || 0,
          usageLimit: (subscription.metadata as any)?.usageLimit || 'Unlimited'
        }
      });
    } catch (error) {
      console.error('Error sending usage limit email:', error);
      throw error;
    }
  }

  private async getCurrentUsage(subscriptionId: string, metricType: string): Promise<number> {
    try {
      const subscription = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
        select: { metadata: true }
      });

      if (!subscription) return 0;

      const usage = (subscription.metadata as any)?.usage || {};
      return usage[metricType] || 0;
    } catch (error) {
      console.warn('Failed to get current usage:', error);
      return 0;
    }
  }

  private getTierLevel(totalSpent: number): string {
    if (totalSpent >= 10000) return 'diamond';
    if (totalSpent >= 5000) return 'platinum';
    if (totalSpent >= 2000) return 'gold';
    if (totalSpent >= 500) return 'silver';
    return 'bronze';
  }

  private getNextTier(currentTier: string): string {
    const tierOrder = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];
    const currentIndex = tierOrder.indexOf(currentTier);
    return currentIndex < tierOrder.length - 1 ? tierOrder[currentIndex + 1] : currentTier;
  }

  private calculateTierProgress(totalSpent: number, currentTier: string): number {
    const tierThresholds: Record<string, number> = {
      bronze: 0,
      silver: 500,
      gold: 2000,
      platinum: 5000,
      diamond: 10000
    };
    
    const currentThreshold = tierThresholds[currentTier];
    const nextThreshold = tierThresholds[this.getNextTier(currentTier)] || currentThreshold;
    
    if (nextThreshold === currentThreshold) return 100;
    
    const progress = ((totalSpent - currentThreshold) / (nextThreshold - currentThreshold)) * 100;
    return Math.min(Math.max(progress, 0), 100);
  }

  private getRequiredAmountForNextTier(nextTier: string): number {
    const tierThresholds: Record<string, number> = {
      bronze: 500,
      silver: 2000,
      gold: 5000,
      platinum: 10000,
      diamond: 10000
    };
    return tierThresholds[nextTier] || 0;
  }
}

export const subscriptionService = new SubscriptionService();
