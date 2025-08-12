import { prisma } from '../prisma';
import { realTimeSyncService } from '../sync/realTimeSyncService';
import { emailService } from '../email/emailService';
import { smsService } from '../sms/smsService';
import { whatsAppService } from '../whatsapp/whatsappService';

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
  constructor() {}

  async getProductInventory(productId: string, organizationId: string): Promise<InventoryItem[]> {
    try {
      const product = await prisma.product.findFirst({
        where: {
          id: productId,
          organizationId
        },
        include: {
          variants: true
        }
      });

      if (!product) {
        throw new Error('Product not found');
      }

      // Get warehouse information
      const warehouses = await prisma.warehouse.findMany({
        where: { organizationId }
      });

      const inventoryItems: InventoryItem[] = [];

      // Main product inventory
      if (product.stockQuantity !== undefined) {
        inventoryItems.push({
          id: product.id,
          productId: product.id,
          warehouseId: warehouses[0]?.id || 'default',
          sku: product.sku || '',
          quantity: product.stockQuantity,
          reservedQuantity: 0, // Will be calculated from metadata
          availableQuantity: product.stockQuantity,
          reorderLevel: product.lowStockThreshold || 0,
          maxStockLevel: product.reorderPoint || 0,
          costPrice: product.costPrice || 0,
          lastStockUpdate: product.updatedAt,
          status: product.isActive ? 'ACTIVE' : 'INACTIVE'
        });
      }

      // Variant inventory
      for (const variant of product.variants) {
        if (variant.stockQuantity !== undefined) {
          inventoryItems.push({
            id: variant.id,
            productId: product.id,
            warehouseId: warehouses[0]?.id || 'default',
            sku: variant.sku || '',
            quantity: variant.stockQuantity,
            reservedQuantity: 0,
            availableQuantity: variant.stockQuantity,
            reorderLevel: 0,
            maxStockLevel: 0,
            costPrice: variant.costPrice || 0,
            lastStockUpdate: variant.updatedAt,
            status: 'ACTIVE'
          });
        }
      }

      return inventoryItems;
    } catch (error) {
      console.error('Error getting product inventory:', error);
      throw error;
    }
  }

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
      // Find the product
      const product = await prisma.product.findFirst({
        where: {
          id: productId,
          organizationId
        }
      });

      if (!product) {
        throw new Error('Product not found');
      }

      const currentStock = product.stockQuantity || 0;

      // Calculate new quantity based on movement type
      let newQuantity = currentStock;
      switch (type) {
        case 'IN':
        case 'RETURN':
          newQuantity = currentStock + quantity;
          break;
        case 'OUT':
        case 'DAMAGE':
        case 'EXPIRED':
          newQuantity = Math.max(0, currentStock - quantity);
          break;
        case 'ADJUSTMENT':
          newQuantity = currentStock + quantity;
          break;
        case 'TRANSFER':
          // For transfers, we assume quantity is the new total
          newQuantity = currentStock + quantity;
          break;
      }

      // Update product stock
      const updatedProduct = await prisma.product.update({
        where: { id: productId },
        data: {
          stockQuantity: newQuantity,
          updatedAt: new Date()
        }
      });

      // Create activity records for stock movements
      if (quantity > 0) {
        await prisma.productActivity.create({
          data: {
            productId,
            type: 'STOCK_ADDED',
            quantity,
            description: `Stock added: ${quantity} units`,
            metadata: {
              reason: 'manual_adjustment',
              previousQuantity: currentStock,
              newQuantity: currentStock + quantity,
              adjustedBy: userId,
              timestamp: new Date()
            }
          }
        });
      } else if (quantity < 0) {
        await prisma.productActivity.create({
          data: {
            productId,
            type: 'STOCK_REDUCED',
            quantity: Math.abs(quantity),
            description: `Stock reduced: ${Math.abs(quantity)} units`,
            metadata: {
              reason: 'manual_adjustment',
              previousQuantity: currentStock,
              newQuantity: currentStock + quantity,
              adjustedBy: userId,
              timestamp: new Date()
            }
          }
        });
      }

      // Create stock movement record (stored in metadata since no dedicated model)
      const stockMovement: StockMovement = {
        id: 'temp_id', // Placeholder, actual ID will be generated by DB
        productId,
        warehouseId,
        type,
        quantity,
        previousQuantity: currentStock,
        newQuantity,
        reason: options.reason,
        reference: options.reference,
        orderId: options.orderId,
        userId,
        timestamp: new Date(),
        cost: options.cost,
        notes: options.notes
      };

      // Check for stock alerts
      await this.checkStockAlerts(productId, warehouseId, newQuantity, organizationId);

      // Broadcast inventory update event
      await realTimeSyncService.broadcastEvent({
        id: `inventory_${Date.now()}`,
        type: 'inventory',
        action: 'update',
        entityId: productId,
        organizationId,
        data: stockMovement,
        timestamp: new Date(),
        source: 'inventory-service'
      });

      return stockMovement;
    } catch (error) {
      console.error('Error updating inventory:', error);
      throw error;
    }
  }

  private mapMovementTypeToActivityType(movementType: StockMovement['type']): any {
    const mapping: Record<StockMovement['type'], any> = {
      'IN': 'STOCK_ADDED',
      'OUT': 'STOCK_REDUCED',
      'TRANSFER': 'STOCK_ADDED', // Map to available types
      'ADJUSTMENT': 'STOCK_ADDED',
      'RETURN': 'STOCK_ADDED',
      'DAMAGE': 'STOCK_REDUCED',
      'EXPIRED': 'STOCK_REDUCED'
    };
    return mapping[movementType] || 'STOCK_ADDED';
  }

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
      for (const item of items) {
        const product = await prisma.product.findFirst({
          where: {
            id: item.productId,
            organizationId
          }
        });

        if (!product) {
          throw new Error(`Product ${item.productId} not found`);
        }

        if ((product.stockQuantity || 0) < item.quantity) {
          throw new Error(`Insufficient stock for product ${item.productId}`);
        }

        // Update product stock directly
        await prisma.product.update({
          where: { id: item.productId },
          data: {
            stockQuantity: product.stockQuantity - item.quantity
          }
        });

        // Create activity record for reservation
        await prisma.productActivity.create({
          data: {
            type: 'STOCK_REDUCED',
            quantity: item.quantity,
            description: `Inventory reserved for order ${orderId}`,
            metadata: {
              warehouseId: item.warehouseId,
              orderId,
              reservedQuantity: item.quantity
            },
            productId: item.productId
          }
        });
      }

      return true;
    } catch (error) {
      console.error('Error reserving inventory:', error);
      throw error;
    }
  }

    async releaseReservation(
    orderId: string,
    organizationId: string,
    fulfill: boolean = false
  ): Promise<boolean> {
    try {
      // Since we don't have metadata for tracking reservations, this method needs to be implemented differently
      // For now, we'll just log that this method needs to be implemented with proper reservation tracking
      console.log('Note: releaseReservation method needs to be implemented with proper reservation tracking');
      
      // For now, return true as a placeholder
      return true;
    } catch (error) {
      console.error('Error releasing inventory reservation:', error);
      throw error;
    }
  }

  private async checkStockAlerts(
    productId: string,
    warehouseId: string,
    currentQuantity: number,
    organizationId: string
  ): Promise<void> {
    try {
      const product = await prisma.product.findFirst({
        where: { id: productId }
      });

      if (!product) return;

      const lowStockThreshold = product.lowStockThreshold || 0;
      const reorderPoint = product.reorderPoint || 0;

      let alertType: StockAlert['type'] | null = null;
      let severity: StockAlert['severity'] = 'LOW';

      // Check for low stock
      if (currentQuantity <= lowStockThreshold && currentQuantity > 0) {
        alertType = 'LOW_STOCK';
        severity = currentQuantity <= lowStockThreshold / 2 ? 'HIGH' : 'MEDIUM';
      }
      // Check for out of stock
      else if (currentQuantity === 0) {
        alertType = 'OUT_OF_STOCK';
        severity = 'CRITICAL';
      }
      // Check for overstock
      else if (currentQuantity > reorderPoint * 2) {
        alertType = 'OVERSTOCK';
        severity = 'MEDIUM';
      }

      if (alertType) {
        await this.createOrUpdateAlert(
          productId,
          warehouseId,
          alertType,
          currentQuantity,
          severity,
          lowStockThreshold,
          organizationId
        );
      } else {
        // Resolve any existing alerts
        await this.resolveIrrelevantAlerts(productId, warehouseId, currentQuantity);
      }
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
      // Since we don't have a dedicated StockAlert model or Product metadata, we'll log the alert
      // For now, we'll just log that this method needs to be implemented differently
      console.log(`Stock alert: ${type} for product ${productId} at warehouse ${warehouseId}, quantity: ${currentQuantity}, severity: ${severity}`);
      
      // TODO: Implement proper alert storage when StockAlert model is available
      // For now, we'll just send a basic notification
      const alert: StockAlert = {
        id: `alert_${Date.now()}`,
        productId,
        warehouseId,
        type,
        currentQuantity,
        threshold,
        severity,
        isActive: true,
        createdAt: new Date(),
        notificationsSent: 0
      };

      // Send notifications
      await this.sendStockAlertNotifications(alert, organizationId);
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
      // Since we don't have a dedicated StockAlert model or Product metadata, we'll log the resolution
      // TODO: Implement proper alert resolution when StockAlert model is available
      console.log(`Alert resolution check: product ${productId} at warehouse ${warehouseId}, quantity: ${currentQuantity}`);
    } catch (error) {
      console.error('Error resolving irrelevant alerts:', error);
    }
  }

  private async sendStockAlertNotifications(
    alert: any,
    organizationId: string
  ): Promise<void> {
    try {
      const product = await prisma.product.findFirst({
        where: { id: alert.productId }
      });

      if (!product) return;

      const alertMessage = this.getAlertMessage(alert, product.name, 'Warehouse');
      
      // Send email notification (placeholder - would need proper email service setup)
      try {
        await emailService.sendEmail({
          to: 'admin@example.com', // Would get from organization settings
          subject: `Stock Alert: ${alert.type}`,
          templateId: 'stock_alert',
          templateData: {
            productName: product.name,
            alertType: alert.type,
            currentQuantity: alert.currentQuantity,
            threshold: alert.threshold,
            severity: alert.severity,
            message: alertMessage
          }
        });
      } catch (error) {
        console.error('Failed to send email notification:', error);
      }

      // Send SMS notification (placeholder)
      try {
        await smsService.sendSMS({
          to: '+1234567890', // Would get from organization settings
          message: alertMessage
        });
      } catch (error) {
        console.error('Failed to send SMS notification:', error);
      }

      // Send WhatsApp notification (placeholder)
      try {
        await whatsAppService.sendTemplateMessage(
          '+1234567890', // Would get from organization settings
          'stock_alert_whatsapp',
          'en',
          'default' // organizationId placeholder
        );
      } catch (error) {
        console.error('Failed to send WhatsApp notification:', error);
      }

      // Update alert notification count - store in ProductActivity since Product doesn't have metadata
      await prisma.productActivity.create({
        data: {
          productId: product.id,
          type: 'STATUS_CHANGED',
          description: 'Low stock alert notification sent',
          metadata: {
            alertId: alert.id,
            notificationsSent: (alert.notificationsSent || 0) + 1,
            lastNotificationAt: new Date(),
            threshold: alert.threshold,
            currentStock: product.stockQuantity
          }
        }
      });
    } catch (error) {
      console.error('Error sending stock alert notifications:', error);
    }
  }

  private getAlertMessage(alert: any, productName: string, warehouseName: string): string {
    const messages = {
      'LOW_STOCK': `${productName} is running low on stock. Current quantity: ${alert.currentQuantity}, Threshold: ${alert.threshold}`,
      'OUT_OF_STOCK': `${productName} is out of stock! Current quantity: ${alert.currentQuantity}`,
      'OVERSTOCK': `${productName} has excess inventory. Current quantity: ${alert.currentQuantity}`,
      'EXPIRING_SOON': `${productName} will expire soon. Check expiration dates.`,
      'EXPIRED': `${productName} has expired items. Remove from inventory.`
    };

    return messages[alert.type as keyof typeof messages] || `Stock alert for ${productName}`;
  }

  async getInventoryForecast(
    productId: string,
    warehouseId: string,
    organizationId: string,
    daysToForecast: number = 30
  ): Promise<InventoryForecast | null> {
    try {
      const product = await prisma.product.findFirst({
        where: {
          id: productId,
          organizationId
        }
      });

      if (!product) return null;

      // Get recent stock movements from product activities
      const recentActivities = await prisma.productActivity.findMany({
        where: {
          productId,
          type: { in: ['STOCK_ADDED', 'STOCK_REDUCED'] },
          createdAt: {
            gte: new Date(Date.now() - daysToForecast * 24 * 60 * 60 * 1000)
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      // Calculate daily usage
      let totalOutgoing = 0;
      let totalIncoming = 0;
      let daysWithActivity = 0;

      for (const activity of recentActivities) {
        if (activity.type === 'STOCK_REDUCED') {
          totalOutgoing += activity.quantity || 0;
          daysWithActivity++;
        } else if (activity.type === 'STOCK_ADDED') {
          totalIncoming += activity.quantity || 0;
        }
      }

      const dailyUsage = daysWithActivity > 0 ? totalOutgoing / daysWithActivity : 0;
      const currentStock = product.stockQuantity || 0;
      const daysUntilStockout = dailyUsage > 0 ? Math.floor(currentStock / dailyUsage) : daysToForecast;
      const recommendedReorderQuantity = Math.max(0, (dailyUsage * 7) - currentStock);
      const recommendedReorderDate = new Date(Date.now() + (daysUntilStockout - 7) * 24 * 60 * 60 * 1000);
      const confidence = Math.min(1, daysWithActivity / daysToForecast);

      return {
        productId,
        warehouseId,
        currentStock,
        dailyUsage,
        daysUntilStockout,
        recommendedReorderQuantity,
        recommendedReorderDate,
        confidence
      };
    } catch (error) {
      console.error('Error getting inventory forecast:', error);
      return null;
    }
  }

  async getStockValuation(organizationId: string): Promise<StockValuation> {
    try {
      const products = await prisma.product.findMany({
        where: { organizationId },
        select: {
          id: true,
          stockQuantity: true,
          costPrice: true,
          category: {
            select: { name: true }
          }
        }
      });

      let totalValue = 0;
      let totalQuantity = 0;
      let totalCost = 0;
      const byCategory: Record<string, { value: number; quantity: number; averagePrice: number }> = {};
      const byWarehouse: Record<string, { value: number; quantity: number; averagePrice: number }> = {};

      for (const product of products) {
        const quantity = product.stockQuantity || 0;
        const costPrice = product.costPrice || 0;
        const value = quantity * costPrice;

        totalValue += value;
        totalQuantity += quantity;
        totalCost += costPrice;

        // By category
        const categoryName = product.category?.name || 'Uncategorized';
        if (!byCategory[categoryName]) {
          byCategory[categoryName] = { value: 0, quantity: 0, averagePrice: 0 };
        }
        byCategory[categoryName].value += value;
        byCategory[categoryName].quantity += quantity;

        // By warehouse (using default for now since we don't have warehouse-specific inventory)
        const warehouseName = 'Default';
        if (!byWarehouse[warehouseName]) {
          byWarehouse[warehouseName] = { value: 0, quantity: 0, averagePrice: 0 };
        }
        byWarehouse[warehouseName].value += value;
        byWarehouse[warehouseName].quantity += quantity;
      }

      // Calculate averages
      for (const category in byCategory) {
        byCategory[category].averagePrice = byCategory[category].quantity > 0 
          ? byCategory[category].value / byCategory[category].quantity 
          : 0;
      }

      for (const warehouse in byWarehouse) {
        byWarehouse[warehouse].averagePrice = byWarehouse[warehouse].quantity > 0 
          ? byWarehouse[warehouse].value / byWarehouse[warehouse].quantity 
          : 0;
      }

      const averageCostPrice = totalQuantity > 0 ? totalCost / totalQuantity : 0;

      return {
        totalValue,
        totalQuantity,
        averageCostPrice,
        byCategory,
        byWarehouse
      };
    } catch (error) {
      console.error('Error getting stock valuation:', error);
      throw error;
    }
  }

  async generateInventoryReport(organizationId: string): Promise<InventoryReport> {
    try {
      const products = await prisma.product.findMany({
        where: { organizationId },
        select: {
          id: true,
          name: true,
          stockQuantity: true,
          costPrice: true,
          lowStockThreshold: true,
          reorderPoint: true
        }
      });

      let totalProducts = products.length;
      let totalValue = 0;
      let lowStockItems = 0;
      let outOfStockItems = 0;
      let overstockItems = 0;
      let expiringItems = 0;

      const productStats: Array<{
        productId: string;
        name: string;
        quantity: number;
        value: number;
        turnoverRate: number;
      }> = [];

      for (const product of products) {
        const quantity = product.stockQuantity || 0;
        const costPrice = product.costPrice || 0;
        const value = quantity * costPrice;

        totalValue += value;

        // Count different stock levels
        if (quantity === 0) {
          outOfStockItems++;
        } else if (quantity <= (product.lowStockThreshold || 0)) {
          lowStockItems++;
        } else if (quantity > (product.reorderPoint || 0) * 2) {
          overstockItems++;
        }

        // Calculate turnover rate (placeholder - would need order history)
        const turnoverRate = 0; // This would be calculated from actual order data

        productStats.push({
          productId: product.id,
          name: product.name,
          quantity,
          value,
          turnoverRate
        });
      }

      // Get top products by value
      const topProducts = productStats
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);

      // Get slow moving products (placeholder)
      const slowMovingProducts = productStats
        .filter(p => p.quantity > 0)
        .sort((a, b) => a.turnoverRate - b.turnoverRate)
        .map(p => ({
          ...p,
          daysSinceLastMovement: 30 // Placeholder value
        }))
        .slice(0, 10);

      // Get alerts from ProductActivity since Product doesn't have metadata
      const alerts: StockAlert[] = [];
      for (const product of products) {
        // Get alerts from ProductActivity records
        const alertActivities = await prisma.productActivity.findMany({
          where: {
            productId: product.id,
            type: 'STATUS_CHANGED',
            description: { contains: 'Low stock alert' }
          }
        });
        
        for (const activity of alertActivities) {
          if (activity.metadata && typeof activity.metadata === 'object') {
            const alertData = activity.metadata as any;
            if (alertData.alertId && alertData.isActive) {
              alerts.push({
                id: alertData.alertId,
                productId: product.id,
                warehouseId: alertData.warehouseId || '',
                type: 'LOW_STOCK',
                threshold: alertData.threshold || 0,
                currentQuantity: product.stockQuantity,
                severity: 'MEDIUM',
                isActive: alertData.isActive || false,
                notificationsSent: alertData.notificationsSent || 0,
                lastNotificationAt: alertData.lastNotificationAt ? new Date(alertData.lastNotificationAt) : undefined,
                createdAt: activity.createdAt
              });
            }
          }
        }
      }

      return {
        summary: {
          totalProducts,
          totalValue,
          lowStockItems,
          outOfStockItems,
          overstockItems,
          expiringItems
        },
        topProducts,
        slowMovingProducts,
        alerts
      };
    } catch (error) {
      console.error('Error generating inventory report:', error);
      throw error;
    }
  }

  private async getTopProductsByValue(organizationId: string): Promise<any[]> {
    try {
      const products = await prisma.product.findMany({
        where: { organizationId },
        select: {
          id: true,
          name: true,
          stockQuantity: true,
          costPrice: true
        },
        orderBy: {
          stockQuantity: 'desc'
        },
        take: 10
      });

      return products.map((product: any) => ({
        productId: product.id,
        name: product.name,
        quantity: product.stockQuantity || 0,
        value: (product.stockQuantity || 0) * (product.costPrice || 0)
      }));
    } catch (error) {
      console.error('Error getting top products by value:', error);
      return [];
    }
  }

  private async getSlowMovingProducts(organizationId: string): Promise<any[]> {
    try {
      // This is a placeholder implementation
      // In a real system, you would analyze order history and calculate actual turnover rates
      const products = await prisma.product.findMany({
        where: { organizationId },
        select: {
          id: true,
          name: true,
          stockQuantity: true,
          costPrice: true
        }
      });

      return products
        .filter((product: any) => (product.stockQuantity || 0) > 0)
        .map((product: any) => ({
          productId: product.id,
          name: product.name,
          quantity: product.stockQuantity || 0,
          daysSinceLastMovement: 30, // Placeholder
          value: (product.stockQuantity || 0) * (product.costPrice || 0)
        }))
        .slice(0, 10);
    } catch (error) {
      console.error('Error getting slow moving products:', error);
      return [];
    }
  }

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
        const product = await prisma.product.findFirst({
          where: {
            id: item.productId,
            organizationId
          }
        });

        if (!product) {
          throw new Error(`Product ${item.productId} not found`);
        }

        const currentStock = product.stockQuantity || 0;
        const difference = item.countedQuantity - currentStock;

        if (difference !== 0) {
          // Create adjustment movement
          const movement = await this.updateInventory(
            item.productId,
            item.warehouseId,
            Math.abs(difference),
            difference > 0 ? 'ADJUSTMENT' : 'ADJUSTMENT',
            userId,
            organizationId,
            {
              reason: 'Cycle count adjustment',
              notes: item.notes || `Counted: ${item.countedQuantity}, System: ${currentStock}`
            }
          );

          movements.push(movement);
        }
      }

      return movements;
    } catch (error) {
      console.error('Error performing cycle count:', error);
      throw error;
    }
  }

  async getMovementHistory(
    productId: string,
    warehouseId: string,
    organizationId: string,
    limit: number = 50
  ): Promise<StockMovement[]> {
    try {
      const activities = await prisma.productActivity.findMany({
        where: {
          productId,
          type: { in: ['STOCK_ADDED', 'STOCK_REDUCED', 'STATUS_CHANGED', 'STATUS_CHANGED', 'STATUS_CHANGED', 'STATUS_CHANGED', 'STATUS_CHANGED'] }
        },
        orderBy: { createdAt: 'desc' },
        take: limit
      });

      return activities.map((activity: any) => {
        const metadata = activity.metadata as any;
        return {
          id: activity.id,
          productId: activity.productId,
          warehouseId: metadata?.warehouseId || warehouseId,
          type: this.mapActivityTypeToMovementType(activity.type),
          quantity: activity.quantity || 0,
          previousQuantity: metadata?.previousQuantity || 0,
          newQuantity: metadata?.newQuantity || 0,
          reason: metadata?.reason,
          reference: metadata?.reference,
          orderId: metadata?.orderId,
          userId: metadata?.userId || 'system',
          timestamp: activity.createdAt,
          cost: metadata?.cost,
          notes: metadata?.notes
        };
      });
    } catch (error) {
      console.error('Error getting movement history:', error);
      throw error;
    }
  }

  private mapActivityTypeToMovementType(activityType: any): StockMovement['type'] {
    const mapping: Record<string, StockMovement['type']> = {
      'STOCK_ADDED': 'IN',
      'STOCK_REDUCED': 'OUT',
      'STATUS_CHANGED': 'ADJUSTMENT',
      'PRICE_UPDATED': 'ADJUSTMENT'
    };
    return mapping[activityType] || 'ADJUSTMENT';
  }
}
