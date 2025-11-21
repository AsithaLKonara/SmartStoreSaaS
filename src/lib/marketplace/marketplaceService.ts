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

interface VendorRegistrationData {
  businessName: string;
  email: string;
  phone: string;
  businessType: string;
  taxId: string;
  bankAccount: string;
  commissionRate?: number;
  organizationId: string;
}

export class MarketplaceService {
  /**
   * Register new vendor
   */
  async registerVendor(vendorData: VendorRegistrationData): Promise<Vendor> {
    try {
      // Since we don't have a vendor model, create a customer with vendor role
      const vendor = await prisma.customer.create({
        data: {
          name: vendorData.businessName,
          email: vendorData.email,
          phone: vendorData.phone,
          organizationId: vendorData.organizationId,
          tags: ['vendor', `vendor_type:${vendorData.businessType}`]
        }
      });

<<<<<<< HEAD
      // Send welcome email
      await this.sendVendorWelcomeEmail(vendor.userId);

      // Create Stripe Connect account
      await this.createStripeConnectAccount(vendor.id);

      // Broadcast event
      await realTimeSyncService.queueEvent({
        type: 'message',
        entityId: vendor.id,
        organizationId: 'marketplace',
        data: vendor,
=======
      // Broadcast vendor registration event
      await realTimeSyncService.broadcastEvent({
        id: `vendor_reg_${vendor.id}`,
        type: 'customer',
        action: 'create',
        entityId: vendor.id,
        data: { ...vendor, vendorType: 'new_registration' },
        source: 'marketplace',
>>>>>>> 08d9e1855dc7fd2c99e5d62def516239ff37a9a7
        timestamp: new Date(),
        organizationId: vendorData.organizationId,
      });

      return {
        id: vendor.id,
        userId: vendor.id, // Use vendor.id as userId since we don't have a separate user model
        businessName: vendor.name || '',
        businessType: vendorData.businessType as 'individual' | 'company' | 'corporation',
        businessDescription: `Vendor business of type ${vendorData.businessType}`,
        logo: undefined,
        banner: undefined,
        address: {
          street: '',
          city: '',
          state: '',
          zipCode: '',
          country: ''
        },
        contactInfo: {
          email: vendor.email || '',
          phone: vendor.phone || '',
          website: undefined
        },
        taxInfo: {
        taxId: vendorData.taxId,
          vatNumber: undefined
        },
        bankDetails: {
          accountHolderName: vendor.name || '',
          accountNumber: vendorData.bankAccount,
          routingNumber: '',
          bankName: ''
        },
        status: 'pending' as const,
        verificationStatus: 'unverified' as const,
        commissionRate: vendorData.commissionRate || 10,
        rating: 0,
        totalSales: 0,
        totalOrders: 0,
        joinedAt: vendor.createdAt,
        lastActiveAt: undefined,
        documents: [],
        settings: this.getDefaultVendorSettings()
      };
    } catch (error) {
      console.error('Error registering vendor:', error);
      throw new Error('Failed to register vendor');
    }
  }

  /**
   * Approve vendor application
   */
  async approveVendor(vendorId: string, adminId: string): Promise<void> {
    try {
      // Update customer with vendor approval
      await prisma.customer.update({
        where: { id: vendorId },
        data: {
          tags: {
            push: 'vendor_approved',
          }
        }
      });

<<<<<<< HEAD
      // Send approval email
      await this.sendVendorApprovalEmail(vendor.userId);

      // Enable Stripe Connect account
      await this.enableStripeConnectAccount(vendorId);

      // Broadcast event
      await realTimeSyncService.queueEvent({
        type: 'message',
        entityId: vendorId,
        organizationId: 'marketplace',
        data: { vendorId, approvedBy: adminId },
=======
      // Broadcast vendor approval event
      await realTimeSyncService.broadcastEvent({
        id: `vendor_approval_${vendorId}`,
        type: 'customer',
        action: 'update',
        entityId: vendorId,
        data: { vendorStatus: 'approved', approvedBy: adminId },
        source: 'marketplace',
>>>>>>> 08d9e1855dc7fd2c99e5d62def516239ff37a9a7
        timestamp: new Date(),
        organizationId: 'marketplace',
      });
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
      const vendor = await prisma.customer.findUnique({
        where: { id: vendorId },
      });

      if (!vendor || !vendor.tags.includes('vendor_approved')) {
        throw new Error('Vendor not approved or not found');
      }

      const product = await prisma.product.create({
        data: {
          name: `Vendor Product - ${productData.sku}`,
          description: `Vendor product with SKU: ${productData.sku}`,
          price: productData.price,
          stockQuantity: productData.stock,
          sku: productData.sku,
          slug: `vendor-product-${productData.sku}`,
          organization: { connect: { id: vendorId } },
          createdBy: { connect: { id: vendorId } },
          isActive: true
        },
      });

      return this.mapVendorProductFromDB(product);
    } catch (error) {
      console.error('Error adding vendor product:', error);
      throw new Error('Failed to add vendor product');
    }
  }

  /**
   * Process marketplace order
   */
  async processMarketplaceOrder(orderId: string): Promise<void> {
    try {
      // Get order details
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      if (!order) return;

      // Process marketplace order logic
      // In a real implementation, this would:
      // 1. Calculate vendor commissions
      // 2. Update vendor earnings
      // 3. Send notifications to vendors
      // 4. Update marketplace analytics

      console.log('Processing marketplace order:', orderId);
    } catch (error) {
      console.error('Error processing marketplace order:', error);
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
      const vendors = await prisma.customer.findMany({
        where: {
          organizationId: 'marketplace', // Assuming organizationId is 'marketplace' for all vendors
          tags: {
            has: 'vendor'
          }
        }
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
      const orders = await prisma.order.findMany({
        where: {
          organizationId: 'marketplace', // Assuming organizationId is 'marketplace' for all orders
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      // Calculate marketplace metrics
      const totalRevenue = orders.reduce((sum: number, order: any) => {
        const orderTotal = order.items.reduce((itemSum: number, item: any) => 
          itemSum + (item.quantity * item.price), 0);
        return sum + orderTotal;
      }, 0);

      // Top products
      const productSales = new Map<string, { name: string; sales: number; revenue: number }>();
      
      for (const order of orders) {
        // Get order items from OrderItem model
        const orderItems = await prisma.orderItem.findMany({
          where: { orderId: order.id },
          include: { product: true }
        });

        for (const item of orderItems) {
          const productId = item.productId;
          const productName = item.product.name;
          
          if (!productSales.has(productId)) {
            productSales.set(productId, { name: productName, sales: 0, revenue: 0 });
          }
          
          const product = productSales.get(productId)!;
          product.sales += item.quantity;
          product.revenue += item.price; // Assuming item.price is the final price
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
        totalOrders: orders.length,
        totalProducts: productSales.size,
        averageOrderValue: orders.length > 0 ? totalRevenue / orders.length : 0,
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
      const vendors = await prisma.customer.findMany({
        where: {
          organizationId: 'marketplace', // Assuming organizationId is 'marketplace' for all vendors
          tags: {
            has: 'vendor'
          },
          AND: [
            query ? {
              OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { email: { contains: query, mode: 'insensitive' } },
                { phone: { contains: query, mode: 'insensitive' } },
              ],
            } : {},
            filters.status ? {
              tags: {
                has: filters.status === 'active' ? 'active' : 'inactive'
              }
            } : {}
          ],
        },
        orderBy: [
          { createdAt: 'desc' },
          { name: 'asc' },
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
    // Since commissionStructure model doesn't exist, return default structure
    return {
      id: 'default',
      vendorId,
      categoryId: categoryId || undefined,
      type: 'percentage', // Default to percentage
      value: 10, // Default 10% commission
      isActive: true
    };
  }

  private async processVendorPayout(vendorId: string, period: string): Promise<void> {
    // Get pending payouts for vendor
    const pendingOrders = await prisma.order.findMany({
      where: {
        organizationId: 'marketplace', // Assuming organizationId is 'marketplace' for all orders
        status: 'DELIVERED'
      },
    });

    if (pendingOrders.length === 0) return;

    const totalPayout = pendingOrders.reduce((sum: number, order: any) => sum + order.totalAmount, 0);

    // Process payout via Stripe Connect
    await this.processStripePayout(vendorId, totalPayout);

    // Update payout status
    await prisma.order.updateMany({
      where: {
        id: { in: pendingOrders.map((o: any) => o.id) },
      },
      data: {
        // Note: payoutStatus field doesn't exist in Order model
        // Consider storing this information in metadata or a separate table
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
    const vendor = await prisma.customer.findUnique({
      where: { id: vendorId }
    });

    if (!vendor?.email) return;

    await emailService.sendEmail({
      to: vendor.email,
      subject: 'New Order Received',
      templateId: 'vendor-new-order',
      templateData: {
        vendorName: vendor.name || '',
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
      monthData.revenue += order.totalAmount; // Assuming totalAmount is the payout
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
      businessName: vendor.name || '',
      businessType: vendor.businessType,
      businessDescription: vendor.businessDescription,
      logo: vendor.logo,
      banner: vendor.banner,
      address: vendor.address || {},
      contactInfo: vendor.contactInfo || {},
      taxInfo: vendor.taxInfo || {},
      bankDetails: vendor.bankDetails || {},
      status: vendor.status,
      verificationStatus: vendor.verificationStatus,
      commissionRate: (vendor.metadata as any)?.commissionRate || 0,
      rating: vendor.rating,
      totalSales: vendor.totalSales,
      totalOrders: vendor.totalOrders,
      joinedAt: vendor.createdAt,
      lastActiveAt: vendor.updatedAt,
      documents: vendor.documents || [],
      settings: this.getDefaultVendorSettings(), // Default settings as VendorSettings model doesn't exist
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
      status: vendorProduct.isActive ? 'active' : 'inactive',
      createdAt: vendorProduct.createdAt,
      updatedAt: vendorProduct.updatedAt,
    };
  }

  private mapMarketplaceOrderFromDB(order: any): MarketplaceOrder {
    return {
      id: order.id,
      orderId: order.id,
      vendorId: (order.metadata as any)?.vendorId || '',
      items: order.items.map((item: any) => ({
        id: item.id,
        vendorProductId: item.productId,
        quantity: item.quantity,
        price: item.price,
        commission: (item.metadata as any)?.commission || 0,
        vendorPayout: (item.metadata as any)?.vendorPayout || 0,
      })),
      subtotal: order.totalAmount,
      commission: (order.metadata as any)?.commissionAmount || 0,
      vendorPayout: order.totalAmount, // Assuming totalAmount is the payout
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
