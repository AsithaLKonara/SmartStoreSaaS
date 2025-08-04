import { prisma } from '@/lib/prisma';
import { generateRandomString } from '@/lib/utils';

interface RewardTier {
  id: string;
  name: string;
  pointsRequired: number;
  benefits: string[];
  discountPercentage?: number;
  freeShipping?: boolean;
  prioritySupport?: boolean;
}

interface LoyaltyTransaction {
  id: string;
  customerId: string;
  type: 'earn' | 'redeem' | 'expire' | 'bonus';
  points: number;
  reason: string;
  orderId?: string;
  referralId?: string;
  expiresAt?: Date;
  createdAt: Date;
}

interface ReferralProgram {
  id: string;
  referrerId: string;
  referredId: string;
  status: 'pending' | 'completed' | 'expired';
  referrerReward: number;
  referredReward: number;
  completedAt?: Date;
  expiresAt: Date;
}

export class LoyaltySystem {
  private rewardTiers: RewardTier[] = [
    {
      id: 'bronze',
      name: 'Bronze',
      pointsRequired: 0,
      benefits: ['Basic rewards'],
      discountPercentage: 0,
    },
    {
      id: 'silver',
      name: 'Silver',
      pointsRequired: 1000,
      benefits: ['5% discount on all orders', 'Free shipping on orders over $50'],
      discountPercentage: 5,
      freeShipping: true,
    },
    {
      id: 'gold',
      name: 'Gold',
      pointsRequired: 5000,
      benefits: ['10% discount on all orders', 'Free shipping on all orders', 'Priority customer support'],
      discountPercentage: 10,
      freeShipping: true,
      prioritySupport: true,
    },
    {
      id: 'platinum',
      name: 'Platinum',
      pointsRequired: 15000,
      benefits: ['15% discount on all orders', 'Free shipping on all orders', 'Priority customer support', 'Exclusive products access'],
      discountPercentage: 15,
      freeShipping: true,
      prioritySupport: true,
    },
  ];

  // Points Management
  async awardPoints(customerId: string, amount: number, reason: string, orderId?: string): Promise<void> {
    try {
      // Create loyalty transaction
      const transaction = await prisma.loyaltyTransaction.create({
        data: {
          customerId,
          type: 'earn',
          points: amount,
          reason,
          orderId,
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year expiry
        },
      });

      // Update customer points
      await prisma.customer.update({
        where: { id: customerId },
        data: {
          loyaltyPoints: {
            increment: amount,
          },
        },
      });

      // Check for tier upgrade
      await this.checkTierUpgrade(customerId);

      console.log(`Awarded ${amount} points to customer ${customerId} for: ${reason}`);
    } catch (error) {
      console.error('Error awarding points:', error);
      throw error;
    }
  }

  async redeemPoints(customerId: string, amount: number, reason: string): Promise<boolean> {
    try {
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
      });

      if (!customer || customer.loyaltyPoints < amount) {
        throw new Error('Insufficient points');
      }

      // Create loyalty transaction
      await prisma.loyaltyTransaction.create({
        data: {
          customerId,
          type: 'redeem',
          points: -amount,
          reason,
        },
      });

      // Update customer points
      await prisma.customer.update({
        where: { id: customerId },
        data: {
          loyaltyPoints: {
            decrement: amount,
          },
        },
      });

      console.log(`Redeemed ${amount} points from customer ${customerId} for: ${reason}`);
      return true;
    } catch (error) {
      console.error('Error redeeming points:', error);
      return false;
    }
  }

  async getCustomerPoints(customerId: string): Promise<number> {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { loyaltyPoints: true },
    });

    return customer?.loyaltyPoints || 0;
  }

  async getPointsHistory(customerId: string): Promise<LoyaltyTransaction[]> {
    const transactions = await prisma.loyaltyTransaction.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    });

    return transactions;
  }

  // Reward Tiers
  async createRewardTier(tier: Omit<RewardTier, 'id'>): Promise<RewardTier> {
    const newTier: RewardTier = {
      ...tier,
      id: generateRandomString(8),
    };

    this.rewardTiers.push(newTier);
    return newTier;
  }

  async assignCustomerToTier(customerId: string, tierId: string): Promise<void> {
    const tier = this.rewardTiers.find(t => t.id === tierId);
    if (!tier) {
      throw new Error('Tier not found');
    }

    await prisma.customer.update({
      where: { id: customerId },
      data: {
        loyaltyTier: tierId,
      },
    });
  }

  async getCustomerTier(customerId: string): Promise<RewardTier | null> {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { loyaltyTier: true, loyaltyPoints: true },
    });

    if (!customer) return null;

    // Find the highest tier the customer qualifies for
    const qualifiedTier = this.rewardTiers
      .filter(tier => customer.loyaltyPoints >= tier.pointsRequired)
      .sort((a, b) => b.pointsRequired - a.pointsRequired)[0];

    return qualifiedTier || null;
  }

  async checkTierUpgrade(customerId: string): Promise<void> {
    const currentTier = await this.getCustomerTier(customerId);
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { loyaltyTier: true, loyaltyPoints: true },
    });

    if (!customer || !currentTier) return;

    // Check if customer should be upgraded
    if (customer.loyaltyTier !== currentTier.id) {
      await this.assignCustomerToTier(customerId, currentTier.id);
      
      // Send tier upgrade notification
      await this.sendTierUpgradeNotification(customerId, currentTier);
    }
  }

  async calculateOrderDiscount(customerId: string, orderAmount: number): Promise<number> {
    const tier = await this.getCustomerTier(customerId);
    if (!tier || !tier.discountPercentage) return 0;

    return (orderAmount * tier.discountPercentage) / 100;
  }

  async checkFreeShipping(customerId: string, orderAmount: number): Promise<boolean> {
    const tier = await this.getCustomerTier(customerId);
    if (!tier) return false;

    if (tier.freeShipping) return true;
    if (tier.name === 'Silver' && orderAmount >= 50) return true;

    return false;
  }

  // Referral System
  async generateReferralCode(customerId: string): Promise<string> {
    const code = generateRandomString(8).toUpperCase();
    
    await prisma.referralCode.create({
      data: {
        code,
        customerId,
        isActive: true,
      },
    });

    return code;
  }

  async processReferral(referralCode: string, newCustomerId: string): Promise<boolean> {
    try {
      const referralCodeRecord = await prisma.referralCode.findFirst({
        where: {
          code: referralCode,
          isActive: true,
        },
        include: {
          customer: true,
        },
      });

      if (!referralCodeRecord) {
        throw new Error('Invalid referral code');
      }

      if (referralCodeRecord.customerId === newCustomerId) {
        throw new Error('Cannot refer yourself');
      }

      // Create referral program
      const referralProgram = await prisma.referralProgram.create({
        data: {
          referrerId: referralCodeRecord.customerId,
          referredId: newCustomerId,
          status: 'pending',
          referrerReward: 500, // 500 points for referrer
          referredReward: 250, // 250 points for referred
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        },
      });

      // Award points to referred customer
      await this.awardPoints(newCustomerId, 250, 'Referral bonus');

      console.log(`Referral processed: ${referralCodeRecord.customerId} referred ${newCustomerId}`);
      return true;
    } catch (error) {
      console.error('Error processing referral:', error);
      return false;
    }
  }

  async completeReferral(referralId: string): Promise<void> {
    const referral = await prisma.referralProgram.findUnique({
      where: { id: referralId },
    });

    if (!referral || referral.status !== 'pending') return;

    // Award points to referrer
    await this.awardPoints(referral.referrerId, referral.referrerReward, 'Referral completed');

    // Update referral status
    await prisma.referralProgram.update({
      where: { id: referralId },
      data: {
        status: 'completed',
        completedAt: new Date(),
      },
    });
  }

  async getReferralStats(customerId: string): Promise<any> {
    const referrals = await prisma.referralProgram.findMany({
      where: { referrerId: customerId },
    });

    const completedReferrals = referrals.filter(r => r.status === 'completed');
    const pendingReferrals = referrals.filter(r => r.status === 'pending');

    return {
      totalReferrals: referrals.length,
      completedReferrals: completedReferrals.length,
      pendingReferrals: pendingReferrals.length,
      totalEarned: completedReferrals.reduce((sum, r) => sum + r.referrerReward, 0),
    };
  }

  // Special Promotions
  async createPromotion(promotion: {
    name: string;
    description: string;
    pointsMultiplier: number;
    startDate: Date;
    endDate: Date;
    minimumOrderAmount?: number;
    applicableProducts?: string[];
  }): Promise<string> {
    const promotionId = generateRandomString(8);

    await prisma.promotion.create({
      data: {
        id: promotionId,
        ...promotion,
      },
    });

    return promotionId;
  }

  async applyPromotionToOrder(orderId: string, promotionId: string): Promise<number> {
    const promotion = await prisma.promotion.findUnique({
      where: { id: promotionId },
    });

    if (!promotion) return 0;

    const now = new Date();
    if (now < promotion.startDate || now > promotion.endDate) return 0;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: true } } },
    });

    if (!order) return 0;

    if (promotion.minimumOrderAmount && order.totalAmount < promotion.minimumOrderAmount) {
      return 0;
    }

    // Calculate base points (1 point per dollar)
    const basePoints = Math.floor(order.totalAmount);
    
    // Apply multiplier
    const bonusPoints = Math.floor(basePoints * (promotion.pointsMultiplier - 1));

    if (bonusPoints > 0) {
      await this.awardPoints(order.customerId, bonusPoints, `Promotion: ${promotion.name}`);
    }

    return bonusPoints;
  }

  // Expiration Management
  async expirePoints(): Promise<void> {
    const expiredTransactions = await prisma.loyaltyTransaction.findMany({
      where: {
        type: 'earn',
        expiresAt: {
          lt: new Date(),
        },
        points: {
          gt: 0,
        },
      },
    });

    for (const transaction of expiredTransactions) {
      const customer = await prisma.customer.findUnique({
        where: { id: transaction.customerId },
      });

      if (customer && customer.loyaltyPoints >= transaction.points) {
        // Create expiration transaction
        await prisma.loyaltyTransaction.create({
          data: {
            customerId: transaction.customerId,
            type: 'expire',
            points: -transaction.points,
            reason: 'Points expired',
          },
        });

        // Update customer points
        await prisma.customer.update({
          where: { id: transaction.customerId },
          data: {
            loyaltyPoints: {
              decrement: transaction.points,
            },
          },
        });
      }
    }
  }

  // Notifications
  private async sendTierUpgradeNotification(customerId: string, tier: RewardTier): Promise<void> {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) return;

    // Send email notification
    // await sendEmail({
    //   to: customer.email,
    //   subject: `Congratulations! You've reached ${tier.name} tier!`,
    //   template: 'tier-upgrade',
    //   data: { customer, tier },
    // });

    console.log(`Tier upgrade notification sent to ${customer.email}`);
  }

  // Analytics
  async getLoyaltyAnalytics(organizationId: string): Promise<any> {
    const customers = await prisma.customer.findMany({
      where: { organizationId },
      select: {
        loyaltyPoints: true,
        loyaltyTier: true,
      },
    });

    const totalPoints = customers.reduce((sum, c) => sum + c.loyaltyPoints, 0);
    const averagePoints = totalPoints / customers.length;
    const tierDistribution = this.rewardTiers.map(tier => ({
      tier: tier.name,
      count: customers.filter(c => c.loyaltyTier === tier.id).length,
    }));

    return {
      totalCustomers: customers.length,
      totalPoints,
      averagePoints,
      tierDistribution,
    };
  }
}

export const loyaltySystem = new LoyaltySystem(); 