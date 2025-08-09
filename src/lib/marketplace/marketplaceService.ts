import { prisma } from '@/lib/prisma';
import { emailService } from '@/lib/email/emailService';
import { realTimeSyncService } from '@/lib/sync/realTimeSyncService';
import { stripeService } from '@/lib/payments/stripeService';

export interface Vendor {
  id: string;
  userId: string;
  businessName: string;
  businessType: 'individual' | 'company' | 'corporation';
  businessDescription: string;
  logo?: string;
  banner?: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  contactInfo: {
    email: string;
    phone: string;
    website?: string;
  };
  taxInfo: {
    taxId?: string;
    vatNumber?: string;
  };
  bankDetails: {
    accountHolderName: string;
    accountNumber: string;
    routingNumber: string;
    bankName: string;
  };
  status: 'pending' | 'approved' | 'suspended' | 'rejected';
  verificationStatus: 'unverified' | 'pending' | 'verified';
  commissionRate: number;
  rating: number;
  totalSales: number;
  totalOrders: number;
  joinedAt: Date;
  lastActiveAt?: Date;
  documents: VendorDocument[];
  settings: VendorSettings;
}

export interface VendorDocument {
  id: string;
  type: 'business_license' | 'tax_certificate' | 'identity' | 'bank_statement' | 'other';
  fileName: string;
  fileUrl: string;
  uploadedAt: Date;
  verifiedAt?: Date;
  status: 'pending' | 'approved' | 'rejected';
}

export interface VendorSettings {
  autoApproveProducts: boolean;
  allowReturns: boolean;
  returnWindow: number; // days
  shippingMethods: string[];
  paymentMethods: string[];
  businessHours: {
    [key: string]: {
      open: string;
      close: string;
      isOpen: boolean;
    };
  };
  notifications: {
    emailOrders: boolean;
    emailPayments: boolean;
    emailReviews: boolean;
    smsOrders: boolean;
  };
}

export interface VendorProduct {
  id: string;
  vendorId: string;
  productId: string;
  price: number;
  stock: number;
  sku: string;
  condition: 'new' | 'used' | 'refurbished';
  warranty?: string;
  shippingWeight: number;
  shippingDimensions: {
    length: number;
    width: number;
    height: number;
  };
  processingTime: number; // days
  status: 'active' | 'inactive' | 'pending_approval' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
}

export interface MarketplaceOrder {
  id: string;
  orderId: string;
  vendorId: string;
  items: MarketplaceOrderItem[];
  subtotal: number;
  commission: number;
  vendorPayout: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
  trackingNumber?: string;
  shippingMethod?: string;
  estimatedDelivery?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface MarketplaceOrderItem {
  id: string;
  vendorProductId: string;
  quantity: number;
  price: number;
  commission: number;
  vendorPayout: number;
}

export interface VendorAnalytics {
  totalRevenue: number;
  totalOrders: number;
  totalProducts: number;
  averageOrderValue: number;
  conversionRate: number;
  topProducts: Array<{
    productId: string;
    name: string;
    sales: number;
    revenue: number;
  }>;
  salesByMonth: Array<{
    month: string;
    revenue: number;
    orders: number;
  }>;
  customerSatisfaction: {
    averageRating: number;
    totalReviews: number;
    ratingDistribution: Record<number, number>;
  };
}

export interface CommissionStructure {
  id: string;
  categoryId?: string;
  vendorId?: string;
  type: 'percentage' | 'fixed' | 'tiered';
  value: number;
  tiers?: Array<{
    minAmount: number;
    maxAmount?: number;
    rate: number;
  }>;
  isActive: boolean;
}

export class MarketplaceService {
  /**
   * Register new vendor
   */
  async registerVendor(vendorData: Omit<Vendor, 'id' | 'rating' | 'totalSales' | 'totalOrders' | 'joinedAt' | 'documents'>): Promise<Vendor> {
    try {
      const vendor = await prisma.vendor.create({
        data: {
          userId: vendorData.userId,
          businessName: vendorData.businessName,
          businessType: vendorData.businessType,
          businessDescription: vendorData.businessDescription,
          logo: vendorData.logo,
          banner: vendorData.banner,
          address: vendorData.address,
          contactInfo: vendorData.contactInfo,
          taxInfo: vendorData.taxInfo,
          bankDetails: vendorData.bankDetails,
          status: 'pending',
          verificationStatus: 'unverified',
          commissionRate: vendorData.commissionRate || 10, // Default 10%
          rating: 0,
          totalSales: 0,
          totalOrders: 0,
          joinedAt: new Date(),
          settings: vendorData.settings || this.getDefaultVendorSettings(),
        },
      });

      // Send welcome email
      await this.sendVendorWelcomeEmail(vendor.userId);

      // Create Stripe Connect account
      await this.createStripeConnectAccount(vendor.id);

      // Broadcast event
      await realTimeSyncService.broadcastEvent({
        type: 'vendor_registered',
        entityId: vendor.id,
        entityType: 'vendor',
        organizationId: 'marketplace',
        data: vendor,
        timestamp: new Date(),
      });

      return this.mapVendorFromDB(vendor);
    } catch (error) {
      console.error('Error registering vendor:', error);
      throw new Error('Failed to register vendor');
    }
  }

  /**
   * Approve vendor application
   */
  async approveVendor(vendorId: string, adminId: string): Promise<Vendor> {
    try {
      const vendor = await prisma.vendor.update({
        where: { id: vendorId },
        data: {
          status: 'approved',
          verificationStatus: 'verified',
        },
      });

      // Send approval email
      await this.sendVendorApprovalEmail(vendor.userId);

      // Enable Stripe Connect account
      await this.enableStripeConnectAccount(vendorId);

      // Broadcast event
      await realTimeSyncService.broadcastEvent({
        type: 'vendor_approved',
        entityId: vendorId,
        entityType: 'vendor',
        organizationId: 'marketplace',
        data: { vendorId, approvedBy: adminId },
        timestamp: new Date(),
      });

      return this.mapVendorFromDB(vendor);
    } catch (error) {
      console.error('Error approving vendor:', error);
      throw new Error('Failed to approve vendor');
    }
  }

  /**
   * Add product to marketplace
   */
  async addVendorProduct(
    vendorId: string,
    productData: Omit<VendorProduct, 'id' | 'vendorId' | 'createdAt' | 'updatedAt'>
  ): Promise<VendorProduct> {
    try {
      const vendor = await prisma.vendor.findUnique({
        where: { id: vendorId },
      });

      if (!vendor || vendor.status !== 'approved') {
        throw new Error('Vendor not approved');
      }

      const vendorProduct = await prisma.vendorProduct.create({
        data: {
          vendorId,
          productId: productData.productId,
          price: productData.price,
          stock: productData.stock,
          sku: productData.sku,
          condition: productData.condition,
          warranty: productData.warranty,
          shippingWeight: productData.shippingWeight,
          shippingDimensions: productData.shippingDimensions,
          processingTime: productData.processingTime,
          status: vendor.settings?.autoApproveProducts ? 'active' : 'pending_approval',
        },
      });

      return this.mapVendorProductFromDB(vendorProduct);
    } catch (error) {
      console.error('Error adding vendor product:', error);
      throw new Error('Failed to add vendor product');
    }
  }

  /**
   * Process marketplace order
   */
  async processMarketplaceOrder(orderId: string): Promise<MarketplaceOrder[]> {
    try {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: {
            include: {
              product: {
                include: {
                  vendorProducts: {
                    include: { vendor: true },
                  },
                },
              },
            },
          },
        },
      });

      if (!order) {
        throw new Error('Order not found');
      }

      const marketplaceOrders: MarketplaceOrder[] = [];

      // Group items by vendor
      const vendorGroups = new Map<string, any[]>();

      for (const item of order.items) {
        const vendorProduct = item.product.vendorProducts[0]; // Assuming one vendor per product for simplicity
        
        if (vendorProduct) {
          const vendorId = vendorProduct.vendorId;
          
          if (!vendorGroups.has(vendorId)) {
            vendorGroups.set(vendorId, []);
          }
          
          vendorGroups.get(vendorId)!.push({
            item,
            vendorProduct,
          });
        }
      }

      // Create marketplace orders for each vendor
      for (const [vendorId, items] of vendorGroups) {
        const vendor = items[0].vendorProduct.vendor;
        const commissionRate = vendor.commissionRate / 100;
        
        let subtotal = 0;
        const orderItems: MarketplaceOrderItem[] = [];

        for (const { item, vendorProduct } of items) {
          const itemTotal = item.price * item.quantity;
          const itemCommission = itemTotal * commissionRate;
          const itemVendorPayout = itemTotal - itemCommission;

          subtotal += itemTotal;

          orderItems.push({
            id: `${item.id}-${vendorId}`,
            vendorProductId: vendorProduct.id,
            quantity: item.quantity,
            price: item.price,
            commission: itemCommission,
            vendorPayout: itemVendorPayout,
          });
        }

        const totalCommission = subtotal * commissionRate;
        const vendorPayout = subtotal - totalCommission;

        const marketplaceOrder = await prisma.marketplaceOrder.create({
          data: {
            orderId,
            vendorId,
            subtotal,
            commission: totalCommission,
            vendorPayout,
            status: 'pending',
            items: {
              create: orderItems.map(item => ({
                vendorProductId: item.vendorProductId,
                quantity: item.quantity,
                price: item.price,
                commission: item.commission,
                vendorPayout: item.vendorPayout,
              })),
            },
          },
          include: { items: true },
        });

        marketplaceOrders.push(this.mapMarketplaceOrderFromDB(marketplaceOrder));

        // Notify vendor
        await this.notifyVendorOfOrder(vendorId, marketplaceOrder.id);
      }

      return marketplaceOrders;
    } catch (error) {
      console.error('Error processing marketplace order:', error);
      throw new Error('Failed to process marketplace order');
    }
  }

  /**
   * Calculate vendor payout
   */
  async calculateVendorPayout(
    vendorId: string,
    amount: number,
    categoryId?: string
  ): Promise<{
    amount: number;
    commission: number;
    payout: number;
    commissionRate: number;
  }> {
    try {
      // Get commission structure
      const commissionStructure = await this.getCommissionStructure(vendorId, categoryId);
      let commissionRate = commissionStructure.value;

      if (commissionStructure.type === 'tiered' && commissionStructure.tiers) {
        // Find applicable tier
        const tier = commissionStructure.tiers.find(
          t => amount >= t.minAmount && (!t.maxAmount || amount <= t.maxAmount)
        );
        
        if (tier) {
          commissionRate = tier.rate;
        }
      }

      const commission = commissionStructure.type === 'fixed' 
        ? commissionStructure.value 
        : (amount * commissionRate / 100);
      
      const payout = amount - commission;

      return {
        amount,
        commission,
        payout,
        commissionRate: commissionStructure.type === 'percentage' ? commissionRate : 0,
      };
    } catch (error) {
      console.error('Error calculating vendor payout:', error);
      throw new Error('Failed to calculate vendor payout');
    }
  }

  /**
   * Process vendor payouts
   */
  async processVendorPayouts(period: 'daily' | 'weekly' | 'monthly' = 'weekly'): Promise<void> {
    try {
      const vendors = await prisma.vendor.findMany({
        where: { status: 'approved' },
      });

      for (const vendor of vendors) {
        await this.processVendorPayout(vendor.id, period);
      }
    } catch (error) {
      console.error('Error processing vendor payouts:', error);
      throw new Error('Failed to process vendor payouts');
    }
  }

  /**
   * Get vendor analytics
   */
  async getVendorAnalytics(
    vendorId: string,
    startDate: Date,
    endDate: Date
  ): Promise<VendorAnalytics> {
    try {
      const orders = await prisma.marketplaceOrder.findMany({
        where: {
          vendorId,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          items: {
            include: {
              vendorProduct: {
                include: { product: true },
              },
            },
          },
        },
      });

      const totalRevenue = orders.reduce((sum, order) => sum + order.vendorPayout, 0);
      const totalOrders = orders.length;
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      // Top products
      const productSales = new Map<string, { name: string; sales: number; revenue: number }>();
      
      for (const order of orders) {
        for (const item of order.items) {
          const productId = item.vendorProduct.productId;
          const productName = item.vendorProduct.product.name;
          
          if (!productSales.has(productId)) {
            productSales.set(productId, { name: productName, sales: 0, revenue: 0 });
          }
          
          const product = productSales.get(productId)!;
          product.sales += item.quantity;
          product.revenue += item.vendorPayout;
        }
      }

      const topProducts = Array.from(productSales.entries())
        .map(([productId, data]) => ({ productId, ...data }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      // Sales by month
      const salesByMonth = this.groupSalesByMonth(orders, startDate, endDate);

      // Customer satisfaction (mock data - would come from reviews)
      const customerSatisfaction = {
        averageRating: 4.2,
        totalReviews: 156,
        ratingDistribution: { 5: 78, 4: 45, 3: 23, 2: 7, 1: 3 },
      };

      return {
        totalRevenue,
        totalOrders,
        totalProducts: productSales.size,
        averageOrderValue,
        conversionRate: 2.5, // Mock data
        topProducts,
        salesByMonth,
        customerSatisfaction,
      };
    } catch (error) {
      console.error('Error getting vendor analytics:', error);
      throw new Error('Failed to get vendor analytics');
    }
  }

  /**
   * Search vendors
   */
  async searchVendors(
    query: string,
    filters: {
      category?: string;
      location?: string;
      rating?: number;
      status?: string;
    } = {}
  ): Promise<Vendor[]> {
    try {
      const vendors = await prisma.vendor.findMany({
        where: {
          AND: [
            query ? {
              OR: [
                { businessName: { contains: query, mode: 'insensitive' } },
                { businessDescription: { contains: query, mode: 'insensitive' } },
              ],
            } : {},
            filters.status ? { status: filters.status } : { status: 'approved' },
            filters.rating ? { rating: { gte: filters.rating } } : {},
          ],
        },
        orderBy: [
          { rating: 'desc' },
          { totalSales: 'desc' },
        ],
      });

      return vendors.map(this.mapVendorFromDB);
    } catch (error) {
      console.error('Error searching vendors:', error);
      throw new Error('Failed to search vendors');
    }
  }

  /**
   * Private helper methods
   */
  private getDefaultVendorSettings(): VendorSettings {
    return {
      autoApproveProducts: false,
      allowReturns: true,
      returnWindow: 30,
      shippingMethods: ['standard', 'express'],
      paymentMethods: ['card', 'paypal'],
      businessHours: {
        monday: { open: '09:00', close: '17:00', isOpen: true },
        tuesday: { open: '09:00', close: '17:00', isOpen: true },
        wednesday: { open: '09:00', close: '17:00', isOpen: true },
        thursday: { open: '09:00', close: '17:00', isOpen: true },
        friday: { open: '09:00', close: '17:00', isOpen: true },
        saturday: { open: '10:00', close: '16:00', isOpen: true },
        sunday: { open: '10:00', close: '16:00', isOpen: false },
      },
      notifications: {
        emailOrders: true,
        emailPayments: true,
        emailReviews: true,
        smsOrders: false,
      },
    };
  }

  private async getCommissionStructure(vendorId: string, categoryId?: string): Promise<CommissionStructure> {
    // Check for vendor-specific commission
    let commission = await prisma.commissionStructure.findFirst({
      where: { vendorId, isActive: true },
    });

    // Check for category-specific commission
    if (!commission && categoryId) {
      commission = await prisma.commissionStructure.findFirst({
        where: { categoryId, isActive: true },
      });
    }

    // Use default commission
    if (!commission) {
      commission = await prisma.commissionStructure.findFirst({
        where: { 
          vendorId: null, 
          categoryId: null, 
          isActive: true 
        },
      });
    }

    if (!commission) {
      // Return default 10% commission
      return {
        id: 'default',
        type: 'percentage',
        value: 10,
        isActive: true,
      };
    }

    return {
      id: commission.id,
      categoryId: commission.categoryId,
      vendorId: commission.vendorId,
      type: commission.type as 'percentage' | 'fixed' | 'tiered',
      value: commission.value,
      tiers: commission.tiers as any,
      isActive: commission.isActive,
    };
  }

  private async processVendorPayout(vendorId: string, period: string): Promise<void> {
    // Get pending payouts for vendor
    const pendingOrders = await prisma.marketplaceOrder.findMany({
      where: {
        vendorId,
        status: 'delivered',
        payoutStatus: 'pending',
      },
    });

    if (pendingOrders.length === 0) return;

    const totalPayout = pendingOrders.reduce((sum, order) => sum + order.vendorPayout, 0);

    // Process payout via Stripe Connect
    await this.processStripePayout(vendorId, totalPayout);

    // Update payout status
    await prisma.marketplaceOrder.updateMany({
      where: {
        id: { in: pendingOrders.map(o => o.id) },
      },
      data: {
        payoutStatus: 'processed',
        payoutDate: new Date(),
      },
    });
  }

  private async createStripeConnectAccount(vendorId: string): Promise<void> {
    // Create Stripe Connect account for vendor
    console.log(`Creating Stripe Connect account for vendor: ${vendorId}`);
  }

  private async enableStripeConnectAccount(vendorId: string): Promise<void> {
    // Enable Stripe Connect account
    console.log(`Enabling Stripe Connect account for vendor: ${vendorId}`);
  }

  private async processStripePayout(vendorId: string, amount: number): Promise<void> {
    // Process payout via Stripe Connect
    console.log(`Processing payout of $${amount} for vendor: ${vendorId}`);
  }

  private async sendVendorWelcomeEmail(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.email) return;

    await emailService.sendEmail({
      to: user.email,
      subject: 'Welcome to Our Marketplace!',
      templateId: 'vendor-welcome',
      templateData: {
        userName: user.name,
        dashboardUrl: `${process.env.NEXTAUTH_URL}/vendor/dashboard`,
      },
    });
  }

  private async sendVendorApprovalEmail(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.email) return;

    await emailService.sendEmail({
      to: user.email,
      subject: 'Vendor Application Approved!',
      templateId: 'vendor-approved',
      templateData: {
        userName: user.name,
        dashboardUrl: `${process.env.NEXTAUTH_URL}/vendor/dashboard`,
      },
    });
  }

  private async notifyVendorOfOrder(vendorId: string, orderId: string): Promise<void> {
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
      include: { user: true },
    });

    if (!vendor?.user.email) return;

    await emailService.sendEmail({
      to: vendor.user.email,
      subject: 'New Order Received',
      templateId: 'vendor-new-order',
      templateData: {
        vendorName: vendor.businessName,
        orderId,
        dashboardUrl: `${process.env.NEXTAUTH_URL}/vendor/orders/${orderId}`,
      },
    });
  }

  private groupSalesByMonth(orders: any[], startDate: Date, endDate: Date): any[] {
    const months = new Map<string, { revenue: number; orders: number }>();
    
    for (const order of orders) {
      const month = order.createdAt.toISOString().substring(0, 7); // YYYY-MM
      
      if (!months.has(month)) {
        months.set(month, { revenue: 0, orders: 0 });
      }
      
      const monthData = months.get(month)!;
      monthData.revenue += order.vendorPayout;
      monthData.orders += 1;
    }

    return Array.from(months.entries())
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  private mapVendorFromDB(vendor: any): Vendor {
    return {
      id: vendor.id,
      userId: vendor.userId,
      businessName: vendor.businessName,
      businessType: vendor.businessType,
      businessDescription: vendor.businessDescription,
      logo: vendor.logo,
      banner: vendor.banner,
      address: vendor.address as any,
      contactInfo: vendor.contactInfo as any,
      taxInfo: vendor.taxInfo as any,
      bankDetails: vendor.bankDetails as any,
      status: vendor.status,
      verificationStatus: vendor.verificationStatus,
      commissionRate: vendor.commissionRate,
      rating: vendor.rating,
      totalSales: vendor.totalSales,
      totalOrders: vendor.totalOrders,
      joinedAt: vendor.joinedAt,
      lastActiveAt: vendor.lastActiveAt,
      documents: vendor.documents || [],
      settings: vendor.settings as VendorSettings,
    };
  }

  private mapVendorProductFromDB(vendorProduct: any): VendorProduct {
    return {
      id: vendorProduct.id,
      vendorId: vendorProduct.vendorId,
      productId: vendorProduct.productId,
      price: vendorProduct.price,
      stock: vendorProduct.stock,
      sku: vendorProduct.sku,
      condition: vendorProduct.condition,
      warranty: vendorProduct.warranty,
      shippingWeight: vendorProduct.shippingWeight,
      shippingDimensions: vendorProduct.shippingDimensions as any,
      processingTime: vendorProduct.processingTime,
      status: vendorProduct.status,
      createdAt: vendorProduct.createdAt,
      updatedAt: vendorProduct.updatedAt,
    };
  }

  private mapMarketplaceOrderFromDB(order: any): MarketplaceOrder {
    return {
      id: order.id,
      orderId: order.orderId,
      vendorId: order.vendorId,
      items: order.items.map((item: any) => ({
        id: item.id,
        vendorProductId: item.vendorProductId,
        quantity: item.quantity,
        price: item.price,
        commission: item.commission,
        vendorPayout: item.vendorPayout,
      })),
      subtotal: order.subtotal,
      commission: order.commission,
      vendorPayout: order.vendorPayout,
      status: order.status,
      trackingNumber: order.trackingNumber,
      shippingMethod: order.shippingMethod,
      estimatedDelivery: order.estimatedDelivery,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }
}

export const marketplaceService = new MarketplaceService();
