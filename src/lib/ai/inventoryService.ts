import OpenAI from 'openai';
import { prisma } from '../prisma';

const openai = process.env.OPENAI_API_KEY 
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  : null;

// Helper function to ensure openai client is available
function getOpenAIClient(): OpenAI {
  if (!openai) {
    throw new Error("OpenAI API key is not configured.");
  }
  return openai;
}

export interface InventoryPrediction {
  productId: string;
  productName: string;
  currentStock: number;
  predictedDemand: number;
  daysUntilStockout: number;
  recommendedReorderQuantity: number;
  confidence: number;
  factors: string[];
  reorderPoint: number;
}

export interface SeasonalTrend {
  productId: string;
  season: string;
  demandMultiplier: number;
  confidence: number;
}

export interface SupplierPerformance {
  supplierId: string;
  supplierName: string;
  averageDeliveryTime: number;
  qualityScore: number;
  reliabilityScore: number;
  costEffectiveness: number;
  recommendations: string[];
}

export interface ProductData {
  id: string;
  name: string;
  stockQuantity: number | null;
  price: number;
  sku?: string | null;
}

export interface SalesHistoryItem {
  orderId: string;
  date: Date;
  items: Array<{ productId: string; quantity: number; price: number }>;
  total: number;
}

export interface CurrentStockItem {
  productId: string;
  currentStock: number;
}

export interface PurchaseOrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
}

export interface PurchaseOrderRecommendation {
  supplierId: string;
  supplierName: string;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitCost: number;
  }>;
  totalAmount: number;
  expectedDelivery: Date;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
}

export class AIInventoryService {
  /**
   * Predict stockout risk and recommend reorder quantities
   */
  async predictStockoutRisk(
    productData: ProductData[],
    salesHistory: SalesHistoryItem[],
    currentStock: CurrentStockItem[]
  ): Promise<InventoryPrediction[]> {
    try {
      const prompt = `
        Analyze the following inventory data and predict stockout risk:
        
        Products: ${JSON.stringify(productData)}
        Sales History: ${JSON.stringify(salesHistory)}
        Current Stock: ${JSON.stringify(currentStock)}
        
        For each product, provide:
        1. Predicted demand for next 30 days
        2. Days until stockout
        3. Recommended reorder quantity
        4. Confidence level (0-1)
        5. Key factors influencing the prediction
        6. Current reorder point
        
        Return as JSON array with fields: productId, productName, currentStock, predictedDemand, daysUntilStockout, recommendedReorderQuantity, confidence, factors, reorderPoint
      `;

      if (!openai) {
        throw new Error('OpenAI API key not configured');
      }

      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      });

      const response = completion.choices[0]?.message?.content;
      return response ? JSON.parse(response) : [];
    } catch (error) {
      console.error('Error predicting stockout risk:', error);
      return [];
    }
  }

  /**
   * Analyze seasonal demand patterns
   */
  async analyzeSeasonalTrends(
    salesHistory: SalesHistoryItem[],
    timeRange: { start: Date; end: Date }
  ): Promise<SeasonalTrend[]> {
    try {
      const prompt = `
        Analyze seasonal demand patterns from sales history:
        
        Sales History: ${JSON.stringify(salesHistory)}
        Time Range: ${timeRange.start.toISOString()} to ${timeRange.end.toISOString()}
        
        Identify seasonal trends and provide:
        1. Seasonal demand multipliers
        2. Confidence levels
        3. Peak seasons for each product
        
        Return as JSON array with fields: productId, season, demandMultiplier, confidence
      `;

      const completion = await getOpenAIClient().chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
      });

      const response = completion.choices[0]?.message?.content;
      return response ? JSON.parse(response) : [];
    } catch (error) {
      console.error('Error analyzing seasonal trends:', error);
      return [];
    }
  }

  /**
   * Evaluate supplier performance using Prisma models
   */
  async evaluateSupplierPerformance(
    organizationId: string
  ): Promise<SupplierPerformance[]> {
    try {
      // Get suppliers with purchase orders
      const suppliers = await prisma.supplier.findMany({
        where: { organizationId, isActive: true },
        include: {
          purchaseOrders: true
        }
      });

      const supplierPerformance: SupplierPerformance[] = [];

      for (const supplier of suppliers) {
        const completedOrders = supplier.purchaseOrders.filter(po => 
          po.status === 'RECEIVED'
        );

        if (completedOrders.length === 0) {
          supplierPerformance.push({
            supplierId: supplier.id,
            supplierName: supplier.name,
            averageDeliveryTime: 0,
            qualityScore: supplier.rating || 0,
            reliabilityScore: 0,
            costEffectiveness: 0,
            recommendations: ['No completed orders to evaluate performance']
          });
          continue;
        }

        // Calculate average delivery time
        const deliveryTimes = completedOrders.map((po) => {
          const poWithDate = po as { createdAt: Date; expectedDate?: Date; expectedDelivery?: Date; metadata?: { expectedDelivery?: Date }; receivedDate?: Date; updatedAt: Date };
          const created = new Date(poWithDate.createdAt);
          const expectedDate = poWithDate.expectedDate || poWithDate.expectedDelivery || poWithDate.metadata?.expectedDelivery;
          const delivered = expectedDate ? new Date(expectedDate) : poWithDate.receivedDate ? new Date(poWithDate.receivedDate) : new Date(poWithDate.updatedAt);
          return Math.ceil((delivered.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        });

        const averageDeliveryTime = deliveryTimes.reduce((sum, time) => sum + time, 0) / deliveryTimes.length;

        // Calculate reliability score based on on-time deliveries
        interface SupplierWithMetadata {
          metadata?: { leadTime?: number };
        }
        const leadTime = ((supplier as SupplierWithMetadata).metadata?.leadTime) || 7;
        const onTimeDeliveries = deliveryTimes.filter(time => time <= leadTime);
        const reliabilityScore = (onTimeDeliveries.length / deliveryTimes.length) * 100;

        // Calculate cost effectiveness (placeholder - would need more data)
        const costEffectiveness = 75; // Placeholder score

        supplierPerformance.push({
          supplierId: supplier.id,
          supplierName: supplier.name,
          averageDeliveryTime,
          qualityScore: supplier.rating || 0,
          reliabilityScore,
          costEffectiveness,
          recommendations: [
            reliabilityScore < 80 ? 'Improve delivery reliability' : 'Maintain current performance',
            averageDeliveryTime > leadTime ? 'Optimize supply chain processes' : 'Good delivery performance'
          ]
        });
      }

      return supplierPerformance;
    } catch (error) {
      console.error('Error evaluating supplier performance:', error);
      return [];
    }
  }

  /**
   * Generate automated purchase orders using Prisma models
   */
  async generatePurchaseOrders(
    organizationId: string,
    predictions: InventoryPrediction[]
  ): Promise<PurchaseOrderRecommendation[]> {
    try {
      // Get active suppliers
      const suppliers = await prisma.supplier.findMany({
        where: { organizationId, isActive: true }
      });

      if (suppliers.length === 0) {
        return [];
      }

      // Get products that need reordering
      const productsToReorder = predictions.filter(p => 
        p.currentStock <= p.reorderPoint && p.daysUntilStockout < 14
      );

      if (productsToReorder.length === 0) {
        return [];
      }

      const purchaseOrders: PurchaseOrderRecommendation[] = [];

      // Group products by supplier (simplified logic - in reality would use supplier-product relationships)
      for (const supplier of suppliers) {
        const supplierProducts = productsToReorder.slice(0, 3); // Limit to 3 products per supplier
        
        if (supplierProducts.length > 0) {
          const items = supplierProducts.map(product => ({
            productId: product.productId,
            productName: product.productName,
            quantity: product.recommendedReorderQuantity,
            unitCost: 0 // Would need to get from product cost data
          }));

          const totalAmount = items.reduce((sum: number, item: PurchaseOrderItem) => sum + (item.quantity * item.unitCost), 0);
          interface SupplierWithMetadata {
            metadata?: { leadTime?: number };
          }
          const leadTime = ((supplier as SupplierWithMetadata).metadata?.leadTime) || 7;
          const expectedDelivery = new Date();
          expectedDelivery.setDate(expectedDelivery.getDate() + leadTime);

          purchaseOrders.push({
            supplierId: supplier.id,
            supplierName: supplier.name,
            items,
            totalAmount,
            expectedDelivery,
            priority: supplierProducts.some(p => p.daysUntilStockout < 7) ? 'URGENT' : 'HIGH'
          });
        }
      }

      return purchaseOrders;
    } catch (error) {
      console.error('Error generating purchase orders:', error);
      return [];
    }
  }

  /**
   * Get inventory data from Prisma models
   */
  async getInventoryData(organizationId: string): Promise<{
    products: ProductData[];
    suppliers: Array<{ id: string; name: string; isActive: boolean; metadata?: Record<string, unknown> }>;
    purchaseOrders: Array<{ id: string; supplier: { id: string; name: string } }>;
  }> {
    try {
      const [products, suppliers, purchaseOrders] = await Promise.all([
        prisma.product.findMany({
          where: { organizationId, isActive: true },
          include: { category: true }
        }),
        prisma.supplier.findMany({
          where: { organizationId, isActive: true }
        }),
        prisma.purchaseOrder.findMany({
          where: { organizationId },
          include: { supplier: true }
        })
      ]);

      return { 
        products: products as ProductData[], 
        suppliers: suppliers.map(s => ({ id: s.id, name: s.name, isActive: s.isActive, metadata: s.metadata as Record<string, unknown> | undefined })), 
        purchaseOrders: purchaseOrders.map(po => ({ id: po.id, supplier: { id: po.supplier.id, name: po.supplier.name } })) 
      };
    } catch (error) {
      console.error('Error fetching inventory data:', error);
      return { products: [], suppliers: [], purchaseOrders: [] };
    }
  }

  /**
   * Optimize pricing based on demand and competition
   */
  async optimizePricing(
    productData: ProductData[],
    salesHistory: SalesHistoryItem[],
    competitorPrices: CompetitorPrice[]
  ): Promise<PricingRecommendation[]> {
    try {
      const prompt = `
        Optimize product pricing based on:
        
        Product Data: ${JSON.stringify(productData)}
        Sales History: ${JSON.stringify(salesHistory)}
        Competitor Prices: ${JSON.stringify(competitorPrices)}
        
        Provide pricing recommendations that:
        1. Maximize revenue while maintaining competitiveness
        2. Consider demand elasticity
        3. Account for seasonal variations
        4. Factor in costs and margins
        
        Return as JSON array with optimized pricing recommendations
      `;

      if (!openai) {
        throw new Error('OpenAI API key not configured');
      }

      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      });

      const response = completion.choices[0]?.message?.content;
      return response ? JSON.parse(response) : [];
    } catch (error) {
      console.error('Error optimizing pricing:', error);
      return [];
    }
  }
}

export const aiInventoryService = new AIInventoryService(); 