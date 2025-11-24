import { prisma } from '@/lib/prisma';
import { realTimeSyncService } from '@/lib/sync/realTimeSyncService';
import { emailService } from '@/lib/email/emailService';

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
  // Helper to map InventoryMovement type to StockMovement type
  private mapMovementType(type: string): StockMovement['type'] {
    const typeMap: Record<string, StockMovement['type']> = {
      'in': 'IN',
      'out': 'OUT',
      'transfer': 'TRANSFER',
      'adjustment': 'ADJUSTMENT',
      'return': 'RETURN',
      'damage': 'DAMAGE',
      'expired': 'EXPIRED',
    };
    return typeMap[type.toLowerCase()] || 'ADJUSTMENT';
  }

  // Helper to get active stock alerts from Organization metadata
  private async getActiveStockAlerts(organizationId: string): Promise<StockAlert[]> {
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) return [];

    const orgSettings = (organization.settings as Record<string, unknown> & { stockAlerts?: Record<string, { isActive?: boolean; id?: string; productId?: string; warehouseId?: string; type?: string; currentQuantity?: number; threshold?: number; message?: string }> }) || {};
    const stockAlerts = orgSettings.stockAlerts || {};

    return Object.values(stockAlerts)
      .filter((alert) => alert.isActive)
      .map((alert) => ({
        id: alert.id || '',
        productId: alert.productId,
        warehouseId: alert.warehouseId,
        type: alert.type,
        currentQuantity: alert.currentQuantity || 0,
        threshold: alert.threshold,
        severity: alert.severity,
        isActive: alert.isActive,
        createdAt: alert.createdAt ? new Date(alert.createdAt) : new Date(),
        resolvedAt: alert.resolvedAt ? new Date(alert.resolvedAt) : undefined,
        notificationsSent: alert.notificationsSent || 0,
        lastNotificationAt: alert.lastNotificationAt ? new Date(alert.lastNotificationAt) : undefined,
      }));
  }
  /**
   * Get inventory for a product across all warehouses
   */
  async getProductInventory(productId: string, organizationId: string): Promise<InventoryItem[]> {
    try {
      // Get product and warehouses
      const product = await prisma.product.findFirst({
        where: { id: productId, organizationId },
      });

      if (!product) {
        throw new Error('Product not found');
      }

      const warehouses = await prisma.warehouse.findMany({
        where: { organizationId },
      });

      // Get inventory data from Warehouse settings metadata
      return warehouses.map(warehouse => {
        const inventoryData = (warehouse.settings as Record<string, unknown> & { inventory?: Record<string, { quantity?: number; reservedQuantity?: number }> })?.inventory?.[productId] || {};
        const quantity = inventoryData.quantity || 0;
        const reservedQuantity = inventoryData.reservedQuantity || 0;

        return {
          id: `${productId}-${warehouse.id}`,
          productId,
          warehouseId: warehouse.id,
          sku: product.sku || '',
          quantity,
          reservedQuantity,
          availableQuantity: quantity - reservedQuantity,
          reorderLevel: inventoryData.reorderLevel || product.lowStockThreshold || 0,
          maxStockLevel: inventoryData.maxStockLevel || 0,
          costPrice: inventoryData.costPrice || product.costPrice || 0,
          lastStockUpdate: inventoryData.lastStockUpdate ? new Date(inventoryData.lastStockUpdate) : new Date(),
          location: inventoryData.location,
          batchNumber: inventoryData.batchNumber,
          expirationDate: inventoryData.expirationDate ? new Date(inventoryData.expirationDate) : undefined,
          supplier: inventoryData.supplier,
          status: inventoryData.status || 'ACTIVE' as 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED',
        };
      });
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
        // Get product and warehouse
        const product = await tx.product.findFirst({
          where: { id: productId, organizationId },
        });

        if (!product) {
          throw new Error('Product not found');
        }

        const warehouse = await tx.warehouse.findFirst({
          where: { id: warehouseId, organizationId },
        });

        if (!warehouse) {
          throw new Error('Warehouse not found');
        }

        // Get current inventory from warehouse settings
        const warehouseSettings = (warehouse.settings as Record<string, unknown> & { inventory?: Record<string, { quantity?: number; reservedQuantity?: number; lastStockUpdate?: Date; costPrice?: number }> }) || {};
        const inventoryData = warehouseSettings.inventory || {};
        const currentInventory = inventoryData[productId] || {};
        const previousQuantity = currentInventory.quantity || 0;

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

        // Update inventory in warehouse settings
        inventoryData[productId] = {
          ...currentInventory,
          quantity: newQuantity,
          lastStockUpdate: new Date(),
          costPrice: options.cost || currentInventory.costPrice || product.costPrice,
        };

        await tx.warehouse.update({
          where: { id: warehouseId },
          data: {
            settings: {
              ...warehouseSettings,
              inventory: inventoryData,
            } as Record<string, unknown>,
          },
        });

        // Also update product stockQuantity (aggregate across all warehouses)
        const allWarehouses = await tx.warehouse.findMany({
          where: { organizationId },
        });
        const totalStock = allWarehouses.reduce((sum, w) => {
          const wSettings = (w.settings as Record<string, unknown> & { inventory?: Record<string, { quantity?: number }> }) || {};
          const wInventory = wSettings.inventory || {};
          return sum + (wInventory[productId]?.quantity || 0);
        }, 0);

        await tx.product.update({
          where: { id: productId },
          data: { stockQuantity: totalStock },
        });

        // Create inventory movement record
        const movement = await tx.inventoryMovement.create({
          data: {
            productId,
            warehouseId,
            type: type.toLowerCase(),
            quantity: Math.abs(quantity),
            reason: options.reason || undefined,
            orderId: options.orderId || undefined,
            createdById: userId,
          },
        });

        // Check for stock alerts
        await this.checkStockAlerts(productId, warehouseId, newQuantity, organizationId);

        // Broadcast real-time update
        await realTimeSyncService.queueEvent({
          id: `inventory-${Date.now()}-${Math.random()}`,
          type: 'inventory',
          action: 'update',
          entityId: productId,
          organizationId,
          source: 'inventory-service',
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
          warehouseId: movement.warehouseId || '',
          type: this.mapMovementType(movement.type),
          quantity: movement.quantity,
          previousQuantity,
          newQuantity,
          reason: movement.reason || undefined,
          reference: undefined, // Not stored in InventoryMovement
          orderId: movement.orderId || undefined,
          userId: movement.createdById,
          timestamp: movement.createdAt,
          cost: undefined, // Not stored in InventoryMovement
          notes: undefined, // Not stored in InventoryMovement
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
          // Get warehouse to check inventory
          const warehouse = await tx.warehouse.findFirst({
            where: { id: item.warehouseId, organizationId },
          });

          if (!warehouse) {
            throw new Error(`Warehouse not found: ${item.warehouseId}`);
          }

          const warehouseSettings = (warehouse.settings as Record<string, unknown>) || {};
          const inventoryData = warehouseSettings.inventory || {};
          const currentInventory = inventoryData[item.productId] || {};
          const quantity = currentInventory.quantity || 0;
          const reservedQuantity = currentInventory.reservedQuantity || 0;
          const availableQuantity = quantity - reservedQuantity;
          
          if (availableQuantity < item.quantity) {
            throw new Error(`Insufficient inventory for product ${item.productId}. Available: ${availableQuantity}, Required: ${item.quantity}`);
          }

          // Update reserved quantity in warehouse settings
          inventoryData[item.productId] = {
            ...currentInventory,
            reservedQuantity: reservedQuantity + item.quantity,
          };

          await tx.warehouse.update({
            where: { id: item.warehouseId },
            data: {
              settings: {
                ...warehouseSettings,
                inventory: inventoryData,
              } as Record<string, unknown>,
            },
          });

          // Store reservation in Order metadata
          const order = await tx.order.findUnique({
            where: { id: orderId },
          });

          if (order) {
            const orderMetadata = (order.metadata as Record<string, unknown>) || {};
            const reservations = orderMetadata.inventoryReservations || [];
            reservations.push({
              productId: item.productId,
              warehouseId: item.warehouseId,
              quantity: item.quantity,
              status: 'ACTIVE',
              createdAt: new Date(),
            });

            await tx.order.update({
              where: { id: orderId },
              data: {
                metadata: {
                  ...orderMetadata,
                  inventoryReservations: reservations,
                } as Record<string, unknown>,
              },
            });
          }
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
    _organizationId: string,
    fulfill: boolean = false
  ): Promise<boolean> {
    try {
      return await prisma.$transaction(async (tx) => {
        // Get reservations from Order metadata
        const order = await tx.order.findUnique({
          where: { id: orderId },
        });

        if (!order) return false;

        const orderMetadata = (order.metadata as any) || {};
        const reservations = orderMetadata.inventoryReservations || [];

        for (const reservation of reservations) {
          if (reservation.status !== 'ACTIVE') continue;

          // Get warehouse to update inventory
          const warehouse = await tx.warehouse.findFirst({
            where: { id: reservation.warehouseId, organizationId: _organizationId },
          });

          if (warehouse) {
            const warehouseSettings = (warehouse.settings as Record<string, unknown>) || {};
            const inventoryData = warehouseSettings.inventory || {};
            const currentInventory = inventoryData[reservation.productId] || {};
            const currentQuantity = currentInventory.quantity || 0;
            const currentReserved = currentInventory.reservedQuantity || 0;

            if (fulfill) {
              // Fulfill reservation - reduce actual quantity and reserved quantity
              inventoryData[reservation.productId] = {
                ...currentInventory,
                quantity: currentQuantity - reservation.quantity,
                reservedQuantity: currentReserved - reservation.quantity,
              };

              await tx.warehouse.update({
                where: { id: reservation.warehouseId },
                data: {
                  settings: {
                    ...warehouseSettings,
                    inventory: inventoryData,
                  } as Record<string, unknown>,
                },
              });

              // Create stock movement
              await this.updateInventory(
                reservation.productId,
                reservation.warehouseId,
                reservation.quantity,
                'OUT',
                'system',
                _organizationId,
                {
                  reason: 'Order fulfillment',
                  orderId,
                }
              );
            } else {
              // Cancel reservation - just reduce reserved quantity
              inventoryData[reservation.productId] = {
                ...currentInventory,
                reservedQuantity: currentReserved - reservation.quantity,
              };

              await tx.warehouse.update({
                where: { id: reservation.warehouseId },
                data: {
                  settings: {
                    ...warehouseSettings,
                    inventory: inventoryData,
                  } as Record<string, unknown>,
                },
              });
            }
          }

          // Update reservation status in Order metadata
          const updatedReservations = reservations.map((r: { productId: string; warehouseId: string; status?: string }) => 
            r.productId === reservation.productId && r.warehouseId === reservation.warehouseId
              ? { ...r, status: fulfill ? 'FULFILLED' : 'CANCELLED' }
              : r
          );

          await tx.order.update({
            where: { id: orderId },
            data: {
              metadata: {
                ...orderMetadata,
                inventoryReservations: updatedReservations,
              } as Record<string, unknown>,
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
      // Get product and warehouse to check thresholds
      const product = await prisma.product.findFirst({
        where: { id: productId, organizationId },
      });

      const warehouse = await prisma.warehouse.findFirst({
        where: { id: warehouseId, organizationId },
      });

      if (!product || !warehouse) return;

      // Get inventory data from warehouse settings
      const warehouseSettings = (warehouse.settings as Record<string, unknown>) || {};
      const inventoryData = warehouseSettings.inventory?.[productId] || {};
      const reorderLevel = inventoryData.reorderLevel || product.lowStockThreshold || 0;
      const maxStockLevel = inventoryData.maxStockLevel || 0;
      const expirationDate = inventoryData.expirationDate ? new Date(inventoryData.expirationDate) : null;

      const alerts: Array<{
        type: StockAlert['type'];
        severity: StockAlert['severity'];
        threshold?: number;
      }> = [];

      // Check for low stock
      if (currentQuantity <= reorderLevel && currentQuantity > 0) {
        alerts.push({
          type: 'LOW_STOCK',
          severity: currentQuantity <= (reorderLevel * 0.5) ? 'HIGH' : 'MEDIUM',
          threshold: reorderLevel,
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
      if (maxStockLevel > 0 && currentQuantity > maxStockLevel) {
        alerts.push({
          type: 'OVERSTOCK',
          severity: 'LOW',
          threshold: maxStockLevel,
        });
      }

      // Check for expiring items
      if (expirationDate) {
        const daysUntilExpiry = Math.ceil(
          (expirationDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
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
      // Store stock alerts in Organization metadata
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
      });

      if (!organization) return;

      const orgSettings = (organization.settings as any) || {};
      const stockAlerts = orgSettings.stockAlerts || {};
      const alertKey = `${productId}-${warehouseId}-${type}`;

      const existingAlert = stockAlerts[alertKey];

      if (existingAlert) {
        stockAlerts[alertKey] = {
          ...existingAlert,
          currentQuantity,
          severity,
          threshold,
          lastNotificationAt: new Date(),
        };
      } else {
        const alert = {
          id: alertKey,
          productId,
          warehouseId,
          type,
          currentQuantity,
          severity,
          threshold,
          isActive: true,
          createdAt: new Date(),
          notificationsSent: 0,
        };
        stockAlerts[alertKey] = alert;

        // Send notifications
        await this.sendStockAlertNotifications(alert, organizationId);
      }

      await prisma.organization.update({
        where: { id: organizationId },
        data: {
          settings: {
            ...orgSettings,
            stockAlerts,
          } as any,
        },
      });
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
      // Get warehouse to check thresholds
      const warehouse = await prisma.warehouse.findFirst({
        where: { id: warehouseId },
      });

      if (!warehouse) return;

      const warehouseSettings = (warehouse.settings as Record<string, unknown>) || {};
      const inventoryData = warehouseSettings.inventory?.[productId] || {};
      const reorderLevel = inventoryData.reorderLevel || 0;
      const maxStockLevel = inventoryData.maxStockLevel || 0;

      const alertsToResolve: string[] = [];

      // Resolve low stock alert if stock is above reorder level
      if (currentQuantity > reorderLevel) {
        alertsToResolve.push('LOW_STOCK');
      }

      // Resolve out of stock alert if stock is available
      if (currentQuantity > 0) {
        alertsToResolve.push('OUT_OF_STOCK');
      }

      // Resolve overstock alert if within limits
      if (maxStockLevel > 0 && currentQuantity <= maxStockLevel) {
        alertsToResolve.push('OVERSTOCK');
      }

      // Update alerts in Organization metadata
      if (alertsToResolve.length > 0) {
        const organization = await prisma.organization.findFirst({
          where: {
            warehouses: {
              some: { id: warehouseId },
            },
          },
        });

        if (organization) {
          const orgSettings = (organization.settings as any) || {};
          const stockAlerts = orgSettings.stockAlerts || {};

          alertsToResolve.forEach(type => {
            const alertKey = `${productId}-${warehouseId}-${type}`;
            if (stockAlerts[alertKey]) {
              stockAlerts[alertKey] = {
                ...stockAlerts[alertKey],
                isActive: false,
                resolvedAt: new Date(),
              };
            }
          });

          await prisma.organization.update({
            where: { id: organization.id },
            data: {
              settings: {
                ...orgSettings,
                stockAlerts,
              } as Record<string, unknown>,
            },
          });
        }
      }
    } catch (error) {
      console.error('Error resolving alerts:', error);
    }
  }

  private async sendStockAlertNotifications(
    alert: StockAlert,
    organizationId: string
  ): Promise<void> {
    try {
      // Get admin users with stock alert notifications enabled
      const adminUsers = await prisma.user.findMany({
        where: {
          organizationId,
          role: { in: ['ADMIN', 'MANAGER'] },
        },
      });

      // Filter users who have stock alerts enabled in preferences
      const usersWithAlerts = await Promise.all(
        adminUsers.map(async (user) => {
          const userPref = await prisma.userPreference.findUnique({
            where: { userId: user.id },
          });
          const notifications = (userPref?.notifications as any) || {};
          const stockAlertsEnabled = notifications.stockAlerts !== false; // Default to true
          return stockAlertsEnabled ? user : null;
        })
      );

      const users = usersWithAlerts.filter((u): u is NonNullable<typeof u> => u !== null);

      if (users.length === 0) return;

      const product = await prisma.product.findUnique({
        where: { id: alert.productId },
      });

      const warehouse = await prisma.warehouse.findUnique({
        where: { id: alert.warehouseId },
      });

      if (!product || !warehouse) return;

      const _message = this.getAlertMessage(alert, product.name, warehouse.name);

      // Send notifications to admins
      for (const user of users) {
        // Send email notification
        if (user.email) {
          await emailService.sendEmail({
            to: user.email,
            subject: `Stock Alert: ${product.name}`,
            htmlContent: `
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
        // Note: phone field not available on User model, would need to be added or retrieved from preferences
        // if (user.phone && alert.severity === 'CRITICAL') {
        //   await smsService.sendSMS({
        //     to: user.phone,
        //     message,
        //   });
        // }
      }

      // Update notification count
        // Update alert in Organization metadata
        const organizationForAlert = await prisma.organization.findFirst({
          where: {
            warehouses: {
              some: { id: alert.warehouseId },
            },
          },
        });

        if (organizationForAlert) {
          const orgSettings = (organizationForAlert.settings as any) || {};
          const stockAlerts = orgSettings.stockAlerts || {};
          const alertKey = `${alert.productId}-${alert.warehouseId}-${alert.type}`;
          
          if (stockAlerts[alertKey]) {
            stockAlerts[alertKey] = {
              ...stockAlerts[alertKey],
              notificationsSent: (stockAlerts[alertKey].notificationsSent || 0) + 1,
              lastNotificationAt: new Date(),
            };

            await prisma.organization.update({
              where: { id: organizationForAlert.id },
              data: {
                settings: {
                  ...orgSettings,
                  stockAlerts,
                } as Record<string, unknown>,
              },
            });
          }
        }
    } catch (error) {
      console.error('Error sending stock alert notifications:', error);
    }
  }

  private getAlertMessage(alert: StockAlert, productName: string, warehouseName: string): string {
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
    _daysToForecast: number = 30
  ): Promise<InventoryForecast | null> {
    try {
      // Get current inventory from warehouse settings
      const warehouse = await prisma.warehouse.findFirst({
        where: { id: warehouseId, organizationId },
      });

      if (!warehouse) return null;

      const warehouseSettings = (warehouse.settings as Record<string, unknown>) || {};
      const inventoryData = warehouseSettings.inventory?.[productId] || {};
      const quantity = inventoryData.quantity || 0;
      const reservedQuantity = inventoryData.reservedQuantity || 0;
      const reorderLevel = inventoryData.reorderLevel || 0;

      // Calculate daily usage from recent inventory movements
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const movements = await prisma.inventoryMovement.findMany({
        where: {
          productId,
          warehouseId,
          type: 'out',
          createdAt: { gte: thirtyDaysAgo },
        },
        orderBy: { createdAt: 'desc' },
      });

      const totalUsage = movements.reduce((sum, movement) => sum + movement.quantity, 0);
      const dailyUsage = totalUsage / 30;

      const currentStock = quantity - reservedQuantity;
      const daysUntilStockout = dailyUsage > 0 ? Math.floor(currentStock / dailyUsage) : Infinity;

      // Calculate recommended reorder quantity (Economic Order Quantity approximation)
      const monthlyUsage = dailyUsage * 30;
      const recommendedReorderQuantity = Math.max(
        monthlyUsage,
        reorderLevel * 2
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
      // Get all products with stock > 0 and warehouses
      const products = await prisma.product.findMany({
        where: {
          organizationId,
          stockQuantity: { gt: 0 },
        },
        include: {
          category: true,
        },
      });

      const warehouses = await prisma.warehouse.findMany({
        where: { organizationId },
      });

      let totalValue = 0;
      let totalQuantity = 0;
      const byCategory: Record<string, any> = {};
      const byWarehouse: Record<string, any> = {};

      // Calculate from warehouse inventory data
      for (const warehouse of warehouses) {
        const warehouseSettings = (warehouse.settings as Record<string, unknown>) || {};
        const inventoryData = warehouseSettings.inventory || {};

        for (const product of products) {
          const itemInventory = inventoryData[product.id] || {};
          const quantity = itemInventory.quantity || 0;
          if (quantity <= 0) continue;

          const costPrice = itemInventory.costPrice || product.costPrice || 0;
          const itemValue = quantity * costPrice;
          totalValue += itemValue;
          totalQuantity += quantity;

          // By category
          const categoryName = product.category?.name || 'Uncategorized';
          if (!byCategory[categoryName]) {
            byCategory[categoryName] = { value: 0, quantity: 0, averagePrice: 0 };
          }
          byCategory[categoryName].value += itemValue;
          byCategory[categoryName].quantity += quantity;

          // By warehouse
          const warehouseName = warehouse.name;
          if (!byWarehouse[warehouseName]) {
            byWarehouse[warehouseName] = { value: 0, quantity: 0, averagePrice: 0 };
          }
          byWarehouse[warehouseName].value += itemValue;
          byWarehouse[warehouseName].quantity += quantity;
        }
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
        // Total products with stock
        prisma.product.count({
          where: {
            organizationId,
            stockQuantity: { gt: 0 },
          },
        }),

        // Low stock items (products with stock <= lowStockThreshold)
        prisma.product.count({
          where: {
            organizationId,
            stockQuantity: {
              lte: prisma.product.fields.lowStockThreshold,
              gt: 0,
            },
          },
        }),

        // Out of stock items
        prisma.product.count({
          where: {
            organizationId,
            stockQuantity: { lte: 0 },
          },
        }),

        // Overstock items (approximate - would need warehouse-level data)
        prisma.product.count({
          where: {
            organizationId,
            stockQuantity: { gt: 1000 }, // Approximate threshold
          },
        }),

        // Expiring items - count from warehouse settings
        // Since expiration data is stored in warehouse settings JSON, we count warehouses
        // that have expiration tracking enabled and estimate based on warehouse count
        (async () => {
          const warehouses = await prisma.warehouse.findMany({
            where: {
              organizationId,
              isActive: true,
            },
            select: {
              settings: true,
            },
          });
          
          // Count warehouses with expiration tracking in settings
          // If settings contain expiration data, count those items
          let expiringCount = 0;
          for (const warehouse of warehouses) {
            const settings = warehouse.settings as Record<string, unknown>;
            if (settings?.expirationTracking?.enabled && settings?.expiringItems) {
              expiringCount += settings.expiringItems.length || 0;
            }
          }
          
          // If no expiration data in settings, return 0 (approximate as comment indicates)
          return expiringCount;
        })(),

        // Stock valuation
        this.getStockValuation(organizationId),

        // Active alerts (from Organization metadata)
        this.getActiveStockAlerts(organizationId),

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

  private async getTopProductsByValue(organizationId: string): Promise<Array<Record<string, unknown>>> {
    // Get products with stock quantity > 0
    const products = await prisma.product.findMany({
      where: {
        organizationId,
        stockQuantity: { gt: 0 },
      },
      take: 10,
    });

    return products
      .map(product => ({
        productId: product.id,
        name: product.name,
        quantity: product.stockQuantity,
        value: product.stockQuantity * (product.costPrice || 0),
        turnoverRate: 0, // This would need historical data calculation
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }

  private async getSlowMovingProducts(organizationId: string): Promise<Array<Record<string, unknown>>> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get products with stock quantity > 0
    const products = await prisma.product.findMany({
      where: {
        organizationId,
        stockQuantity: { gt: 0 },
      },
      include: {
        movements: {
          where: {
            createdAt: { gte: thirtyDaysAgo },
            type: 'out',
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    return products
      .filter(product => product.movements.length === 0)
      .map(product => ({
        productId: product.id,
        name: product.name,
        quantity: product.stockQuantity,
        daysSinceLastMovement: Math.floor(
          (new Date().getTime() - product.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
        ),
        value: product.stockQuantity * (product.costPrice || 0),
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
        // Get warehouse to check current inventory
        const warehouse = await prisma.warehouse.findFirst({
          where: { id: item.warehouseId, organizationId },
        });

        if (!warehouse) continue;

        const warehouseSettings = (warehouse.settings as Record<string, unknown>) || {};
        const inventoryData = warehouseSettings.inventory || {};
        const currentInventory = inventoryData[item.productId] || {};
        const currentQuantity = currentInventory.quantity || 0;

        const difference = item.countedQuantity - currentQuantity;

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
              notes: `Counted: ${item.countedQuantity}, System: ${currentQuantity}, Difference: ${difference}. ${item.notes || ''}`,
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
      const movements = await prisma.inventoryMovement.findMany({
        where: {
          productId,
          warehouseId: warehouseId || undefined,
          product: { organizationId },
        },
        include: {
          createdBy: {
            select: { name: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      return movements.map(movement => ({
        id: movement.id,
        productId: movement.productId,
        warehouseId: movement.warehouseId || '',
        type: this.mapMovementType(movement.type),
        quantity: movement.quantity,
        previousQuantity: 0, // Not stored in InventoryMovement
        newQuantity: movement.quantity, // Approximate
        reason: movement.reason || undefined,
        reference: undefined, // Not stored in InventoryMovement
        orderId: movement.orderId || undefined,
        userId: movement.createdById,
        timestamp: movement.createdAt,
        cost: undefined, // Not stored in InventoryMovement
        notes: undefined, // Not stored in InventoryMovement
      }));
    } catch (error) {
      console.error('Error getting movement history:', error);
      throw new Error('Failed to get movement history');
    }
  }
}

export const inventoryService = new InventoryService();
