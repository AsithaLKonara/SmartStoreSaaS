import { prisma } from '@/lib/prisma';

export interface FraudCheck {
  orderId: string;
  customerId: string;
  amount: number;
  paymentMethod: string;
  shippingAddress: Record<string, unknown>;
  billingAddress: Record<string, unknown>;
}

export interface FraudResult {
  isFraud: boolean;
  riskScore: number;
  reasons: string[];
  action: 'approve' | 'review' | 'reject';
}

export class FraudPreventionService {
  async checkFraud(check: FraudCheck): Promise<FraudResult> {
    let riskScore = 0;
    const reasons: string[] = [];

    // Check 1: Unusual order amount
    const customer = await prisma.customer.findUnique({
      where: { id: check.customerId },
      include: {
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (customer && customer.orders.length > 0) {
      const avgOrderValue = customer.orders.reduce(
        (sum, order) => sum + order.totalAmount,
        0
      ) / customer.orders.length;

      if (check.amount > avgOrderValue * 3) {
        riskScore += 30;
        reasons.push('Order amount significantly higher than average');
      }
    } else {
      // New customer with high-value order
      if (check.amount > 500) {
        riskScore += 20;
        reasons.push('New customer with high-value order');
      }
    }

    // Check 2: Address mismatch
    if (
      check.shippingAddress &&
      check.billingAddress &&
      this.addressesDiffer(check.shippingAddress, check.billingAddress)
    ) {
      riskScore += 15;
      reasons.push('Shipping and billing addresses differ');
    }

    // Check 3: Multiple orders in short time
    const recentOrders = await prisma.order.count({
      where: {
        customerId: check.customerId,
        createdAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000), // Last hour
        },
      },
    });

    if (recentOrders > 3) {
      riskScore += 25;
      reasons.push('Multiple orders in short time period');
    }

    // Check 4: Payment method risk
    if (check.paymentMethod === 'credit_card' && check.amount > 1000) {
      riskScore += 10;
      reasons.push('High-value credit card transaction');
    }

    // Check 5: Velocity check
    const velocityRisk = await this.checkVelocity(check.customerId);
    if (velocityRisk > 0) {
      riskScore += velocityRisk;
      reasons.push('Unusual transaction velocity');
    }

    // Determine action based on risk score
    let action: 'approve' | 'review' | 'reject' = 'approve';
    if (riskScore >= 70) {
      action = 'reject';
    } else if (riskScore >= 40) {
      action = 'review';
    }

    return {
      isFraud: riskScore >= 70,
      riskScore,
      reasons,
      action,
    };
  }

  private addressesDiffer(address1: Record<string, unknown>, address2: Record<string, unknown>): boolean {
    const fields = ['street', 'city', 'state', 'zip', 'country'];
    return fields.some(field => {
      const val1 = address1[field]?.toLowerCase().trim();
      const val2 = address2[field]?.toLowerCase().trim();
      return val1 && val2 && val1 !== val2;
    });
  }

  private async checkVelocity(customerId: string): Promise<number> {
    const orders = await prisma.order.findMany({
      where: {
        customerId,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        },
      },
    });

    if (orders.length > 10) {
      return 20; // High velocity
    } else if (orders.length > 5) {
      return 10; // Medium velocity
    }

    return 0;
  }
}

