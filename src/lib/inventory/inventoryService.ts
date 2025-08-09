import { prisma } from '@/lib/prisma';
import { realTimeSyncService } from '@/lib/sync/realTimeSyncService';
import { emailService } from '@/lib/email/emailService';
import { smsService } from '@/lib/sms/smsService';
import { whatsAppService } from '@/lib/whatsapp/whatsappService';

export interface InventoryItem {
  id: string;
  productId: string;
  warehouseId: string;
  sku: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  reorderLevel: number;
  maxStockLevel: number;
  costPrice: number;
  lastStockUpdate: Date;
  location?: string;
  batchNumber?: string;
  expirationDate?: Date;
  supplier?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED';
}

export interface StockMovement {
  id: string;
  productId: string;
  warehouseId: string;
  type: 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT' | 'RETURN' | 'DAMAGE' | 'EXPIRED';
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  reason?: string;
  reference?: string;
  orderId?: string;
  userId: string;
  timestamp: Date;
  cost?: number;
  notes?: string;
}

export interface StockAlert {
  id: string;
  productId: string;
  warehouseId: string;
  type: 'LOW_STOCK' | 'OUT_OF_STOCK' | 'OVERSTOCK' | 'EXPIRING_SOON' | 'EXPIRED';
  currentQuantity: number;
  threshold?: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  isActive: boolean;
  createdAt: Date;
  resolvedAt?: Date;
  notificationsSent: number;
  lastNotificationAt?: Date;
}

export interface InventoryForecast {
  productId: string;
  warehouseId: string;
  currentStock: number;
  dailyUsage: number;
  daysUntilStockout: number;
  recommendedReorderQuantity: number;
  recommendedReorderDate: Date;
  confidence: number;
}

export interface StockValuation {
  totalValue: number;
  totalQuantity: number;
  averageCostPrice: number;
  byCategory: Record<string, {
    value: number;
    quantity: number;
    averagePrice: number;
  }>;
  byWarehouse: Record<string, {
    value: number;
    quantity: number;
    averagePrice: number;
  }>;
}

export interface InventoryReport {
  summary: {
    totalProducts: number;
    totalValue: number;
    lowStockItems: number;
    outOfStockItems: number;
    overstockItems: number;
    expiringItems: number;
  };
  topProducts: Array<{
    productId: string;
    name: string;
    quantity: number;
    value: number;
    turnoverRate: number;
  }>;
  slowMovingProducts: Array<{
    productId: string;
    name: string;
    quantity: number;
    daysSinceLastMovement: number;
    value: number;
  }>;
  alerts: StockAlert[];
}

export class InventoryService {
  /**
   * Get inventory for a product across all warehouses
   */
  async getProductInventory(productId: string, organizationId: string): Promise<InventoryItem[]> {
    try {
      const inventory = await prisma.inventory.findMany({
        where: {
          productId,
          product: { organizationId },
        },
        include: {
          product: true,
          warehouse: true,
        },
      });

      return inventory.map(item => ({
        id: item.id,
        productId: item.productId,
        warehouseId: item.warehouseId,
        sku: item.sku,
        quantity: item.quantity,
        reservedQuantity: item.reservedQuantity,
        availableQuantity: item.quantity - item.reservedQuantity,
        reorderLevel: item.reorderLevel,
        maxStockLevel: item.maxStockLevel,
        costPrice: item.costPrice,
        lastStockUpdate: item.lastStockUpdate,
        location: item.location,
        batchNumber: item.batchNumber,
        expirationDate: item.expirationDate,
        supplier: item.supplier,
        status: item.status as 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED',
      }));
    } catch (error) {
      console.error('Error getting product inventory:', error);
      throw new Error('Failed to get product inventory');
    }
  }

  /**
   * Update inventory quantity
   */
  async updateInventory(
    productId: string,
    warehouseId: string,
    quantity: number,
    type: StockMovement['type'],
    userId: string,
    organizationId: string,
    options: {
      reason?: string;
      reference?: string;
      orderId?: string;
      cost?: number;
      notes?: string;
    } = {}
  ): Promise<StockMovement> {
    try {
      return await prisma.$transaction(async (tx) => {
        // Get current inventory
        const inventory = await tx.inventory.findFirst({
          where: {
            productId,
            warehouseId,
            product: { organizationId },
          },
        });

        if (!inventory) {
          throw new Error('Inventory item not found');
        }

        const previousQuantity = inventory.quantity;
        let newQuantity: number;

        // Calculate new quantity based on movement type
        switch (type) {
          case 'IN':
          case 'RETURN':
            newQuantity = previousQuantity + Math.abs(quantity);
            break;
          case 'OUT':
          case 'DAMAGE':
          case 'EXPIRED':
            newQuantity = Math.max(0, previousQuantity - Math.abs(quantity));
            break;
          case 'ADJUSTMENT':
            newQuantity = quantity;
            break;
          case 'TRANSFER':
            // For transfers, quantity can be negative (outgoing) or positive (incoming)
            newQuantity = previousQuantity + quantity;
            break;
          default:
            throw new Error('Invalid stock movement type');
        }

        // Update inventory
        await tx.inventory.update({
          where: { id: inventory.id },
          data: {
            quantity: newQuantity,
            lastStockUpdate: new Date(),
          },
        });

        // Create stock movement record
        const movement = await tx.stockMovement.create({
          data: {
            productId,
            warehouseId,
            type,
            quantity: Math.abs(quantity),
            previousQuantity,
            newQuantity,
            reason: options.reason,
            reference: options.reference,
            orderId: options.orderId,
            userId,
            cost: options.cost,
            notes: options.notes,
          },
        });

        // Check for stock alerts
        await this.checkStockAlerts(productId, warehouseId, newQuantity, organizationId);

        // Broadcast real-time update
        await realTimeSyncService.broadcastEvent({
          type: 'inventory_updated',
          entityId: inventory.id,
          entityType: 'inventory',
          organizationId,
          data: {
            productId,
            warehouseId,
            previousQuantity,
            newQuantity,
            movementType: type,
          },
          timestamp: new Date(),
        });

        return {
          id: movement.id,
          productId: movement.productId,
          warehouseId: movement.warehouseId,
          type: movement.type as StockMovement['type'],
          quantity: movement.quantity,
          previousQuantity: movement.previousQuantity,
          newQuantity: movement.newQuantity,
          reason: movement.reason,
          reference: movement.reference,
          orderId: movement.orderId,
          userId: movement.userId,
          timestamp: movement.createdAt,
          cost: movement.cost,
          notes: movement.notes,
        };
      });
    } catch (error) {
      console.error('Error updating inventory:', error);
      throw new Error('Failed to update inventory');
    }
  }

  /**
   * Reserve inventory for orders
   */
  async reserveInventory(
    items: Array<{
      productId: string;
      warehouseId: string;
      quantity: number;
    }>,
    orderId: string,
    organizationId: string
  ): Promise<boolean> {
    try {
      return await prisma.$transaction(async (tx) => {
        for (const item of items) {
          const inventory = await tx.inventory.findFirst({
            where: {
              productId: item.productId,
              warehouseId: item.warehouseId,
              product: { organizationId },
            },
          });

          if (!inventory) {
            throw new Error(`Inventory not found for product ${item.productId}`);
          }

          const availableQuantity = inventory.quantity - inventory.reservedQuantity;
          
          if (availableQuantity < item.quantity) {
            throw new Error(`Insufficient inventory for product ${item.productId}. Available: ${availableQuantity}, Required: ${item.quantity}`);
          }

          // Update reserved quantity
          await tx.inventory.update({
            where: { id: inventory.id },
            data: {
              reservedQuantity: inventory.reservedQuantity + item.quantity,
            },
          });

          // Create reservation record
          await tx.inventoryReservation.create({
            data: {
              productId: item.productId,
              warehouseId: item.warehouseId,
              orderId,
              quantity: item.quantity,
              status: 'ACTIVE',
            },
          });
        }

        return true;
      });
    } catch (error) {
      console.error('Error reserving inventory:', error);
      return false;
    }
  }

  /**
   * Release reserved inventory
   */
  async releaseReservation(
    orderId: string,
    organizationId: string,
    fulfill: boolean = false
  ): Promise<boolean> {
    try {
      return await prisma.$transaction(async (tx) => {
        const reservations = await tx.inventoryReservation.findMany({
          where: {
            orderId,
            status: 'ACTIVE',
            product: { organizationId },
          },
        });

        for (const reservation of reservations) {
          const inventory = await tx.inventory.findFirst({
            where: {
              productId: reservation.productId,
              warehouseId: reservation.warehouseId,
            },
          });

          if (inventory) {
            if (fulfill) {
              // Fulfill reservation - reduce actual quantity and reserved quantity
              await tx.inventory.update({
                where: { id: inventory.id },
                data: {
                  quantity: inventory.quantity - reservation.quantity,
                  reservedQuantity: inventory.reservedQuantity - reservation.quantity,
                },
              });

              // Create stock movement
              await this.updateInventory(
                reservation.productId,
                reservation.warehouseId,
                reservation.quantity,
                'OUT',
                'system',
                organizationId,
                {
                  reason: 'Order fulfillment',
                  reference: orderId,
                  orderId,
                }
              );
            } else {
              // Cancel reservation - just reduce reserved quantity
              await tx.inventory.update({
                where: { id: inventory.id },
                data: {
                  reservedQuantity: inventory.reservedQuantity - reservation.quantity,
                },
              });
            }
          }

          // Update reservation status
          await tx.inventoryReservation.update({
            where: { id: reservation.id },
            data: {
              status: fulfill ? 'FULFILLED' : 'CANCELLED',
              updatedAt: new Date(),
            },
          });
        }

        return true;
      });
    } catch (error) {
      console.error('Error releasing inventory reservation:', error);
      return false;
    }
  }

  /**
   * Check and create stock alerts
   */
  private async checkStockAlerts(
    productId: string,
    warehouseId: string,
    currentQuantity: number,
    organizationId: string
  ): Promise<void> {
    try {
      const inventory = await prisma.inventory.findFirst({
        where: {
          productId,
          warehouseId,
        },
        include: {
          product: true,
          warehouse: true,
        },
      });

      if (!inventory) return;

      const alerts: Array<{
        type: StockAlert['type'];
        severity: StockAlert['severity'];
        threshold?: number;
      }> = [];

      // Check for low stock
      if (currentQuantity <= inventory.reorderLevel && currentQuantity > 0) {
        alerts.push({
          type: 'LOW_STOCK',
          severity: currentQuantity <= (inventory.reorderLevel * 0.5) ? 'HIGH' : 'MEDIUM',
          threshold: inventory.reorderLevel,
        });
      }

      // Check for out of stock
      if (currentQuantity <= 0) {
        alerts.push({
          type: 'OUT_OF_STOCK',
          severity: 'CRITICAL',
          threshold: 0,
        });
      }

      // Check for overstock
      if (inventory.maxStockLevel > 0 && currentQuantity > inventory.maxStockLevel) {
        alerts.push({
          type: 'OVERSTOCK',
          severity: 'LOW',
          threshold: inventory.maxStockLevel,
        });
      }

      // Check for expiring items
      if (inventory.expirationDate) {
        const daysUntilExpiry = Math.ceil(
          (inventory.expirationDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysUntilExpiry <= 30 && daysUntilExpiry > 0) {
          alerts.push({
            type: 'EXPIRING_SOON',
            severity: daysUntilExpiry <= 7 ? 'HIGH' : 'MEDIUM',
          });
        } else if (daysUntilExpiry <= 0) {
          alerts.push({
            type: 'EXPIRED',
            severity: 'CRITICAL',
          });
        }
      }

      // Create or update alerts
      for (const alertData of alerts) {
        await this.createOrUpdateAlert(
          productId,
          warehouseId,
          alertData.type,
          currentQuantity,
          alertData.severity,
          alertData.threshold,
          organizationId
        );
      }

      // Resolve alerts that are no longer applicable
      await this.resolveIrrelevantAlerts(productId, warehouseId, currentQuantity);
    } catch (error) {
      console.error('Error checking stock alerts:', error);
    }
  }

  private async createOrUpdateAlert(
    productId: string,
    warehouseId: string,
    type: StockAlert['type'],
    currentQuantity: number,
    severity: StockAlert['severity'],
    threshold: number | undefined,
    organizationId: string
  ): Promise<void> {
    try {
      const existingAlert = await prisma.stockAlert.findFirst({
        where: {
          productId,
          warehouseId,
          type,
          isActive: true,
        },
      });

      if (existingAlert) {
        // Update existing alert
        await prisma.stockAlert.update({
          where: { id: existingAlert.id },
          data: {
            currentQuantity,
            severity,
            threshold,
          },
        });
      } else {
        // Create new alert
        const alert = await prisma.stockAlert.create({
          data: {
            productId,
            warehouseId,
            type,
            currentQuantity,
            severity,
            threshold,
            isActive: true,
          },
        });

        // Send notifications
        await this.sendStockAlertNotifications(alert, organizationId);
      }
    } catch (error) {
      console.error('Error creating/updating stock alert:', error);
    }
  }

  private async resolveIrrelevantAlerts(
    productId: string,
    warehouseId: string,
    currentQuantity: number
  ): Promise<void> {
    try {
      const inventory = await prisma.inventory.findFirst({
        where: { productId, warehouseId },
      });

      if (!inventory) return;

      const alertsToResolve: string[] = [];

      // Resolve low stock alert if stock is above reorder level
      if (currentQuantity > inventory.reorderLevel) {
        alertsToResolve.push('LOW_STOCK');
      }

      // Resolve out of stock alert if stock is available
      if (currentQuantity > 0) {
        alertsToResolve.push('OUT_OF_STOCK');
      }

      // Resolve overstock alert if within limits
      if (inventory.maxStockLevel > 0 && currentQuantity <= inventory.maxStockLevel) {
        alertsToResolve.push('OVERSTOCK');
      }

      if (alertsToResolve.length > 0) {
        await prisma.stockAlert.updateMany({
          where: {
            productId,
            warehouseId,
            type: { in: alertsToResolve },
            isActive: true,
          },
          data: {
            isActive: false,
            resolvedAt: new Date(),
          },
        });
      }
    } catch (error) {
      console.error('Error resolving alerts:', error);
    }
  }

  private async sendStockAlertNotifications(
    alert: any,
    organizationId: string
  ): Promise<void> {
    try {
      // Get notification preferences and admin contacts
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
        include: {
          users: {
            where: {
              role: { in: ['ADMIN', 'MANAGER'] },
              notifications: { has: 'STOCK_ALERTS' },
            },
          },
        },
      });

      if (!organization) return;

      const product = await prisma.product.findUnique({
        where: { id: alert.productId },
      });

      const warehouse = await prisma.warehouse.findUnique({
        where: { id: alert.warehouseId },
      });

      if (!product || !warehouse) return;

      const message = this.getAlertMessage(alert, product.name, warehouse.name);

      // Send notifications to admins
      for (const user of organization.users) {
        // Send email notification
        if (user.email) {
          await emailService.sendEmail({
            to: user.email,
            subject: `Stock Alert: ${product.name}`,
            html: `
              <h2>Stock Alert</h2>
              <p><strong>Product:</strong> ${product.name}</p>
              <p><strong>Warehouse:</strong> ${warehouse.name}</p>
              <p><strong>Alert Type:</strong> ${alert.type.replace('_', ' ')}</p>
              <p><strong>Current Stock:</strong> ${alert.currentQuantity}</p>
              <p><strong>Severity:</strong> ${alert.severity}</p>
              ${alert.threshold ? `<p><strong>Threshold:</strong> ${alert.threshold}</p>` : ''}
              <p>Please take appropriate action to resolve this stock issue.</p>
            `,
          });
        }

        // Send SMS notification for critical alerts
        if (user.phone && alert.severity === 'CRITICAL') {
          await smsService.sendSMS({
            to: user.phone,
            message,
          });
        }
      }

      // Update notification count
      await prisma.stockAlert.update({
        where: { id: alert.id },
        data: {
          notificationsSent: alert.notificationsSent + 1,
          lastNotificationAt: new Date(),
        },
      });
    } catch (error) {
      console.error('Error sending stock alert notifications:', error);
    }
  }

  private getAlertMessage(alert: any, productName: string, warehouseName: string): string {
    switch (alert.type) {
      case 'LOW_STOCK':
        return `⚠️ LOW STOCK: ${productName} at ${warehouseName} has only ${alert.currentQuantity} units remaining (threshold: ${alert.threshold})`;
      case 'OUT_OF_STOCK':
        return `🚨 OUT OF STOCK: ${productName} at ${warehouseName} is out of stock`;
      case 'OVERSTOCK':
        return `📦 OVERSTOCK: ${productName} at ${warehouseName} has ${alert.currentQuantity} units (max: ${alert.threshold})`;
      case 'EXPIRING_SOON':
        return `⏰ EXPIRING SOON: ${productName} at ${warehouseName} will expire soon`;
      case 'EXPIRED':
        return `❌ EXPIRED: ${productName} at ${warehouseName} has expired`;
      default:
        return `Stock alert for ${productName} at ${warehouseName}`;
    }
  }

  /**
   * Get inventory forecasting
   */
  async getInventoryForecast(
    productId: string,
    warehouseId: string,
    organizationId: string,
    daysToForecast: number = 30
  ): Promise<InventoryForecast | null> {
    try {
      // Get current inventory
      const inventory = await prisma.inventory.findFirst({
        where: {
          productId,
          warehouseId,
          product: { organizationId },
        },
      });

      if (!inventory) return null;

      // Calculate daily usage from recent stock movements
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const movements = await prisma.stockMovement.findMany({
        where: {
          productId,
          warehouseId,
          type: 'OUT',
          createdAt: { gte: thirtyDaysAgo },
        },
        orderBy: { createdAt: 'desc' },
      });

      const totalUsage = movements.reduce((sum, movement) => sum + movement.quantity, 0);
      const dailyUsage = totalUsage / 30;

      const currentStock = inventory.quantity - inventory.reservedQuantity;
      const daysUntilStockout = dailyUsage > 0 ? Math.floor(currentStock / dailyUsage) : Infinity;

      // Calculate recommended reorder quantity (Economic Order Quantity approximation)
      const monthlyUsage = dailyUsage * 30;
      const recommendedReorderQuantity = Math.max(
        monthlyUsage,
        inventory.reorderLevel * 2
      );

      const recommendedReorderDate = new Date();
      recommendedReorderDate.setDate(
        recommendedReorderDate.getDate() + Math.max(0, daysUntilStockout - 7)
      );

      // Calculate confidence based on data availability and consistency
      const confidence = Math.min(
        100,
        (movements.length / 30) * 100 * 0.7 + // Data availability factor
        (movements.length > 0 ? 30 : 0) // Consistency factor
      );

      return {
        productId,
        warehouseId,
        currentStock,
        dailyUsage,
        daysUntilStockout: daysUntilStockout === Infinity ? -1 : daysUntilStockout,
        recommendedReorderQuantity,
        recommendedReorderDate,
        confidence,
      };
    } catch (error) {
      console.error('Error getting inventory forecast:', error);
      return null;
    }
  }

  /**
   * Get stock valuation
   */
  async getStockValuation(organizationId: string): Promise<StockValuation> {
    try {
      const inventory = await prisma.inventory.findMany({
        where: {
          product: { organizationId },
          quantity: { gt: 0 },
        },
        include: {
          product: {
            include: {
              category: true,
            },
          },
          warehouse: true,
        },
      });

      let totalValue = 0;
      let totalQuantity = 0;
      const byCategory: Record<string, any> = {};
      const byWarehouse: Record<string, any> = {};

      for (const item of inventory) {
        const itemValue = item.quantity * item.costPrice;
        totalValue += itemValue;
        totalQuantity += item.quantity;

        // By category
        const categoryName = item.product.category?.name || 'Uncategorized';
        if (!byCategory[categoryName]) {
          byCategory[categoryName] = { value: 0, quantity: 0, averagePrice: 0 };
        }
        byCategory[categoryName].value += itemValue;
        byCategory[categoryName].quantity += item.quantity;

        // By warehouse
        const warehouseName = item.warehouse.name;
        if (!byWarehouse[warehouseName]) {
          byWarehouse[warehouseName] = { value: 0, quantity: 0, averagePrice: 0 };
        }
        byWarehouse[warehouseName].value += itemValue;
        byWarehouse[warehouseName].quantity += item.quantity;
      }

      // Calculate average prices
      Object.keys(byCategory).forEach(key => {
        byCategory[key].averagePrice = byCategory[key].quantity > 0 
          ? byCategory[key].value / byCategory[key].quantity 
          : 0;
      });

      Object.keys(byWarehouse).forEach(key => {
        byWarehouse[key].averagePrice = byWarehouse[key].quantity > 0 
          ? byWarehouse[key].value / byWarehouse[key].quantity 
          : 0;
      });

      return {
        totalValue,
        totalQuantity,
        averageCostPrice: totalQuantity > 0 ? totalValue / totalQuantity : 0,
        byCategory,
        byWarehouse,
      };
    } catch (error) {
      console.error('Error getting stock valuation:', error);
      throw new Error('Failed to get stock valuation');
    }
  }

  /**
   * Generate inventory report
   */
  async generateInventoryReport(organizationId: string): Promise<InventoryReport> {
    try {
      const [
        totalProducts,
        lowStockItems,
        outOfStockItems,
        overstockItems,
        expiringItems,
        valuation,
        alerts,
        topProducts,
        slowMovingProducts,
      ] = await Promise.all([
        // Total products
        prisma.inventory.count({
          where: { product: { organizationId } },
        }),

        // Low stock items
        prisma.inventory.count({
          where: {
            product: { organizationId },
            quantity: { lte: prisma.inventory.fields.reorderLevel },
            quantity: { gt: 0 },
          },
        }),

        // Out of stock items
        prisma.inventory.count({
          where: {
            product: { organizationId },
            quantity: { lte: 0 },
          },
        }),

        // Overstock items
        prisma.inventory.count({
          where: {
            product: { organizationId },
            quantity: { gt: prisma.inventory.fields.maxStockLevel },
            maxStockLevel: { gt: 0 },
          },
        }),

        // Expiring items (next 30 days)
        prisma.inventory.count({
          where: {
            product: { organizationId },
            expirationDate: {
              lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              gt: new Date(),
            },
          },
        }),

        // Stock valuation
        this.getStockValuation(organizationId),

        // Active alerts
        prisma.stockAlert.findMany({
          where: {
            product: { organizationId },
            isActive: true,
          },
          include: {
            product: true,
            warehouse: true,
          },
          orderBy: { severity: 'desc' },
          take: 10,
        }),

        // Top products by value
        this.getTopProductsByValue(organizationId),

        // Slow moving products
        this.getSlowMovingProducts(organizationId),
      ]);

      return {
        summary: {
          totalProducts,
          totalValue: valuation.totalValue,
          lowStockItems,
          outOfStockItems,
          overstockItems,
          expiringItems,
        },
        topProducts,
        slowMovingProducts,
        alerts: alerts.map(alert => ({
          id: alert.id,
          productId: alert.productId,
          warehouseId: alert.warehouseId,
          type: alert.type as StockAlert['type'],
          currentQuantity: alert.currentQuantity,
          threshold: alert.threshold,
          severity: alert.severity as StockAlert['severity'],
          isActive: alert.isActive,
          createdAt: alert.createdAt,
          resolvedAt: alert.resolvedAt,
          notificationsSent: alert.notificationsSent,
          lastNotificationAt: alert.lastNotificationAt,
        })),
      };
    } catch (error) {
      console.error('Error generating inventory report:', error);
      throw new Error('Failed to generate inventory report');
    }
  }

  private async getTopProductsByValue(organizationId: string): Promise<any[]> {
    const inventory = await prisma.inventory.findMany({
      where: {
        product: { organizationId },
        quantity: { gt: 0 },
      },
      include: {
        product: true,
      },
      take: 10,
    });

    return inventory
      .map(item => ({
        productId: item.productId,
        name: item.product.name,
        quantity: item.quantity,
        value: item.quantity * item.costPrice,
        turnoverRate: 0, // This would need historical data calculation
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }

  private async getSlowMovingProducts(organizationId: string): Promise<any[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const inventory = await prisma.inventory.findMany({
      where: {
        product: { organizationId },
        quantity: { gt: 0 },
      },
      include: {
        product: true,
        stockMovements: {
          where: {
            createdAt: { gte: thirtyDaysAgo },
            type: 'OUT',
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    return inventory
      .filter(item => item.stockMovements.length === 0)
      .map(item => ({
        productId: item.productId,
        name: item.product.name,
        quantity: item.quantity,
        daysSinceLastMovement: Math.floor(
          (new Date().getTime() - item.lastStockUpdate.getTime()) / (1000 * 60 * 60 * 24)
        ),
        value: item.quantity * item.costPrice,
      }))
      .sort((a, b) => b.daysSinceLastMovement - a.daysSinceLastMovement)
      .slice(0, 10);
  }

  /**
   * Perform inventory cycle count
   */
  async performCycleCount(
    items: Array<{
      productId: string;
      warehouseId: string;
      countedQuantity: number;
      notes?: string;
    }>,
    userId: string,
    organizationId: string
  ): Promise<StockMovement[]> {
    try {
      const movements: StockMovement[] = [];

      for (const item of items) {
        const inventory = await prisma.inventory.findFirst({
          where: {
            productId: item.productId,
            warehouseId: item.warehouseId,
            product: { organizationId },
          },
        });

        if (!inventory) continue;

        const difference = item.countedQuantity - inventory.quantity;

        if (difference !== 0) {
          const movement = await this.updateInventory(
            item.productId,
            item.warehouseId,
            item.countedQuantity,
            'ADJUSTMENT',
            userId,
            organizationId,
            {
              reason: 'Cycle count adjustment',
              notes: `Counted: ${item.countedQuantity}, System: ${inventory.quantity}, Difference: ${difference}. ${item.notes || ''}`,
            }
          );

          movements.push(movement);
        }
      }

      return movements;
    } catch (error) {
      console.error('Error performing cycle count:', error);
      throw new Error('Failed to perform cycle count');
    }
  }

  /**
   * Get inventory movement history
   */
  async getMovementHistory(
    productId: string,
    warehouseId: string,
    organizationId: string,
    limit: number = 50
  ): Promise<StockMovement[]> {
    try {
      const movements = await prisma.stockMovement.findMany({
        where: {
          productId,
          warehouseId,
          product: { organizationId },
        },
        include: {
          user: {
            select: { name: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      return movements.map(movement => ({
        id: movement.id,
        productId: movement.productId,
        warehouseId: movement.warehouseId,
        type: movement.type as StockMovement['type'],
        quantity: movement.quantity,
        previousQuantity: movement.previousQuantity,
        newQuantity: movement.newQuantity,
        reason: movement.reason,
        reference: movement.reference,
        orderId: movement.orderId,
        userId: movement.userId,
        timestamp: movement.createdAt,
        cost: movement.cost,
        notes: movement.notes,
      }));
    } catch (error) {
      console.error('Error getting movement history:', error);
      throw new Error('Failed to get movement history');
    }
  }
}

export const inventoryService = new InventoryService();
