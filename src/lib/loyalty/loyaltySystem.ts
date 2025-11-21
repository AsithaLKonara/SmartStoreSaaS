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
      // Update customer points using the existing points field
      await prisma.customer.update({
        where: { id: customerId },
        data: {
          points: {
            increment: amount,
          },
        },
      });

      console.log(`Awarded ${amount} points to customer ${customerId} for: ${reason}`);
    } catch (error) {
      console.error('Error awarding loyalty points:', error);
      throw new Error('Failed to award loyalty points');
    }
  }

  async redeemPoints(customerId: string, amount: number, reason: string): Promise<boolean> {
    try {
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { points: true }
      });

      if (!customer || customer.points < amount) {
        return false; // Insufficient points
      }

      // Update customer points
      await prisma.customer.update({
        where: { id: customerId },
        data: {
          points: {
            decrement: amount,
          },
        },
      });

      console.log(`Redeemed ${amount} points from customer ${customerId} for: ${reason}`);
      return true;
    } catch (error) {
      console.error('Error redeeming loyalty points:', error);
      throw new Error('Failed to redeem loyalty points');
    }
  }

  async getCustomerPoints(customerId: string): Promise<number> {
    try {
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { points: true }
      });

      return customer?.points || 0;
    } catch (error) {
      console.error('Error getting customer points:', error);
      return 0;
    }
  }

  async getPointsHistory(customerId: string): Promise<LoyaltyTransaction[]> {
    try {
      // Since we don't have a metadata field, return empty history for now
      // In a real implementation, you'd create a LoyaltyTransaction model
      return [];
    } catch (error) {
      console.error('Error getting points history:', error);
      return [];
    }
  }

  async createRewardTier(tier: Omit<RewardTier, 'id'>): Promise<RewardTier> {
    const newTier: RewardTier = {
      id: generateRandomString(8),
      ...tier,
    };
    this.rewardTiers.push(newTier);
    return newTier;
  }

  async assignCustomerToTier(customerId: string, tierId: string): Promise<void> {
    try {
      const tier = this.rewardTiers.find(t => t.id === tierId);
      if (!tier) {
        throw new Error('Invalid tier ID');
      }

      // Store tier assignment in customer tags for now
      await prisma.customer.update({
        where: { id: customerId },
        data: {
          tags: {
            push: `tier:${tier.id}`,
          },
        },
      });

      console.log(`Assigned customer ${customerId} to tier ${tier.name}`);
    } catch (error) {
      console.error('Error assigning customer to tier:', error);
      throw new Error('Failed to assign customer to tier');
    }
  }

  async getCustomerTier(customerId: string): Promise<RewardTier | null> {
    try {
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { tags: true }
      });

      if (!customer) return null;

      // Find tier from customer tags
      const tierTag = customer.tags.find((tag: string) => tag.startsWith('tier:'));
      if (!tierTag) return null;

      const tierId = tierTag.split(':')[1];
      return this.rewardTiers.find(t => t.id === tierId) || null;
    } catch (error) {
      console.error('Error getting customer tier:', error);
      return null;
    }
  }

  async checkTierUpgrade(customerId: string): Promise<void> {
    try {
      const currentPoints = await this.getCustomerPoints(customerId);
      const currentTier = await this.getCustomerTier(customerId);
      
      // Find the highest tier the customer qualifies for
      let newTier: RewardTier | null = null;
      for (const tier of this.rewardTiers) {
        if (currentPoints >= tier.pointsRequired) {
          newTier = tier;
        } else {
          break;
        }
      }

      if (newTier && (!currentTier || newTier.pointsRequired > currentTier.pointsRequired)) {
        await this.assignCustomerToTier(customerId, newTier.id);
        await this.sendTierUpgradeNotification(customerId, newTier);
      }
    } catch (error) {
      console.error('Error checking tier upgrade:', error);
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
    
    // Check if order amount meets minimum for free shipping
    return orderAmount >= 50; // $50 minimum for Silver tier
  }

  async generateReferralCode(customerId: string): Promise<string> {
    try {
      const referralCode = generateRandomString(8).toUpperCase();
      
      // Store referral code in customer tags
      await prisma.customer.update({
        where: { id: customerId },
        data: {
          tags: {
            push: `referral:${referralCode}`,
          },
        },
      });

      return referralCode;
    } catch (error) {
      console.error('Error generating referral code:', error);
      throw new Error('Failed to generate referral code');
    }
  }

  async processReferral(referralCode: string, newCustomerId: string): Promise<boolean> {
    try {
      // Find customer with this referral code
      const referrer = await prisma.customer.findFirst({
        where: {
          tags: {
            has: `referral:${referralCode}`,
          },
        },
      });

      if (!referrer) {
        return false; // Invalid referral code
      }

      // Store referral in customer tags
      await prisma.customer.update({
        where: { id: referrer.id },
        data: {
          tags: {
            push: `referred:${newCustomerId}`,
          },
        },
      });

      await prisma.customer.update({
        where: { id: newCustomerId },
        data: {
          tags: {
            push: `referredBy:${referrer.id}`,
          },
        },
      });

      return true;
    } catch (error) {
      console.error('Error processing referral:', error);
      return false;
    }
  }

  async completeReferral(referralId: string): Promise<void> {
    try {
      // Find referral in customer tags
      const customers = await prisma.customer.findMany({
        where: {
          tags: {
            has: `referred:${referralId}`,
          },
        },
      });

      for (const customer of customers) {
        // Award points based on referral completion
        await this.awardPoints(
          customer.id,
          500, // 500 points for referrer
          'Referral bonus - referred customer made first purchase'
        );

        // Update tags to mark as completed
        const updatedTags = customer.tags.filter((tag: string) => !tag.startsWith('referred:'));
        updatedTags.push(`referred:${referralId}:completed`);

        await prisma.customer.update({
          where: { id: customer.id },
          data: { tags: updatedTags },
        });
      }

      // Award points to new customer
      await this.awardPoints(
        referralId,
        1000, // 1000 points for new customer
        'Welcome bonus - referred by existing customer'
      );
    } catch (error) {
      console.error('Error completing referral:', error);
    }
  }

  async getReferralStats(customerId: string): Promise<any> {
    try {
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { tags: true }
      });

      if (!customer) return { totalReferrals: 0, completedReferrals: 0, pendingReferrals: 0, totalPointsEarned: 0 };

      const referrals = customer.tags.filter(tag => tag.startsWith('referred:'));
      const completedReferrals = customer.tags.filter(tag => tag.includes(':completed'));
      
      const stats = {
        totalReferrals: referrals.length,
        completedReferrals: completedReferrals.length,
        pendingReferrals: referrals.length - completedReferrals.length,
        totalPointsEarned: completedReferrals.length * 500, // 500 points per completed referral
      };

      return stats;
    } catch (error) {
      console.error('Error getting referral stats:', error);
      return {
        totalReferrals: 0,
        completedReferrals: 0,
        pendingReferrals: 0,
        totalPointsEarned: 0,
      };
    }
  }

  async createPromotion(promotion: {
    name: string;
    description: string;
    pointsMultiplier: number;
    startDate: Date;
    endDate: Date;
    minimumOrderAmount?: number;
    applicableProducts?: string[];
  }): Promise<string> {
    try {
      // Store promotion in a global promotions list
      // In a real implementation, you'd have a Promotions table
      const promotionId = generateRandomString(16);
      
      // For now, store in a static promotions map
      (this as any).promotions = (this as any).promotions || new Map();
      (this as any).promotions.set(promotionId, {
        id: promotionId,
        ...promotion,
        createdAt: new Date(),
        isActive: true,
      });

      return promotionId;
    } catch (error) {
      console.error('Error creating promotion:', error);
      throw new Error('Failed to create promotion');
    }
  }

  async applyPromotionToOrder(orderId: string, promotionId: string): Promise<number> {
    try {
      const promotion = (this as any).promotions?.get(promotionId);
      if (!promotion || !promotion.isActive) {
        return 0; // No promotion applied
      }

      const now = new Date();
      if (now < promotion.startDate || now > promotion.endDate) {
        return 0; // Promotion not active
      }

      // Get order details
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { totalAmount: true, customerId: true }
      });

      if (!order) return 0;

      // Check minimum order amount
      if (promotion.minimumOrderAmount && order.totalAmount < promotion.minimumOrderAmount) {
        return 0;
      }

      // Calculate bonus points
      const basePoints = Math.floor(order.totalAmount);
      const bonusPoints = Math.floor(basePoints * (promotion.pointsMultiplier - 1));

      if (bonusPoints > 0) {
        await this.awardPoints(
          order.customerId,
          bonusPoints,
          `Promotion bonus: ${promotion.name}`
        );
      }

      return bonusPoints;
    } catch (error) {
      console.error('Error applying promotion to order:', error);
      return 0;
    }
  }

  async expirePoints(): Promise<void> {
    try {
      // Since we don't have a metadata field with expiry dates,
      // this is a simplified implementation
      console.log('Checking for expired points...');
      
      // In a real implementation, you'd have a separate table for point transactions
      // with expiry dates and would expire points based on those dates
    } catch (error) {
      console.error('Error expiring points:', error);
    }
  }

  private async sendTierUpgradeNotification(customerId: string, tier: RewardTier): Promise<void> {
    try {
      // TODO: Send notification when notification service is available
      console.log(`Customer ${customerId} upgraded to ${tier.name} tier!`);
      
      // In production, this would send an email, SMS, or push notification
      // to congratulate the customer on their tier upgrade
    } catch (error) {
      console.error('Error sending tier upgrade notification:', error);
    }
  }

  async getLoyaltyAnalytics(organizationId: string): Promise<any> {
    try {
      // Get loyalty analytics for the organization
      const customers = await prisma.customer.findMany({
        where: { organizationId },
        select: { points: true, tags: true }
      });

      const analytics = {
        totalCustomers: customers.length,
        totalPointsIssued: customers.reduce((sum: number, c: any) => sum + c.points, 0),
        averagePointsPerCustomer: customers.length > 0 ? customers.reduce((sum: number, c: any) => sum + c.points, 0) / customers.length : 0,
        tierDistribution: {
          bronze: 0,
          silver: 0,
          gold: 0,
          platinum: 0,
        },
        activeReferrals: 0,
        totalReferrals: 0,
      };

      // Calculate tier distribution from tags
      for (const customer of customers) {
        const tierTag = customer.tags.find((tag: string) => tag.startsWith('tier:'));
        if (tierTag) {
          const tierName = tierTag.split(':')[1];
          if (analytics.tierDistribution[tierName as keyof typeof analytics.tierDistribution] !== undefined) {
            analytics.tierDistribution[tierName as keyof typeof analytics.tierDistribution]++;
          }
        }

        // Count referrals from tags
        const referrals = customer.tags.filter((tag: string) => tag.startsWith('referred:'));
        analytics.totalReferrals += referrals.length;
        analytics.activeReferrals += referrals.filter((tag: string) => !tag.includes(':completed')).length;
      }

      return analytics;
    } catch (error) {
      console.error('Error getting loyalty analytics:', error);
      return {
        totalCustomers: 0,
        totalPointsIssued: 0,
        averagePointsPerCustomer: 0,
        tierDistribution: { bronze: 0, silver: 0, gold: 0, platinum: 0 },
        activeReferrals: 0,
        totalReferrals: 0,
      };
    }
  }
}

export const loyaltySystem = new LoyaltySystem(); 