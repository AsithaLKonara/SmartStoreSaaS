import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface InventoryPrediction {
  productId: string;
  productName: string;
  currentStock: number;
  predictedDemand: number;
  daysUntilStockout: number;
  recommendedReorderQuantity: number;
  confidence: number;
  factors: string[];
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

export class AIInventoryService {
  /**
   * Predict stockout risk and recommend reorder quantities
   */
  async predictStockoutRisk(
    productData: any[],
    salesHistory: any[],
    currentStock: any[]
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
        
        Return as JSON array with fields: productId, productName, currentStock, predictedDemand, daysUntilStockout, recommendedReorderQuantity, confidence, factors
      `;

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
    salesHistory: any[],
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

      const completion = await openai.chat.completions.create({
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
   * Evaluate supplier performance
   */
  async evaluateSupplierPerformance(
    supplierData: any[],
    orderHistory: any[]
  ): Promise<SupplierPerformance[]> {
    try {
      const prompt = `
        Evaluate supplier performance based on:
        
        Supplier Data: ${JSON.stringify(supplierData)}
        Order History: ${JSON.stringify(orderHistory)}
        
        For each supplier, calculate:
        1. Average delivery time
        2. Quality score (0-100)
        3. Reliability score (0-100)
        4. Cost effectiveness (0-100)
        5. Specific recommendations for improvement
        
        Return as JSON array with fields: supplierId, supplierName, averageDeliveryTime, qualityScore, reliabilityScore, costEffectiveness, recommendations
      `;

      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      });

      const response = completion.choices[0]?.message?.content;
      return response ? JSON.parse(response) : [];
    } catch (error) {
      console.error('Error evaluating supplier performance:', error);
      return [];
    }
  }

  /**
   * Generate automated purchase orders
   */
  async generatePurchaseOrders(
    predictions: InventoryPrediction[],
    supplierPerformance: SupplierPerformance[]
  ): Promise<any[]> {
    try {
      const prompt = `
        Generate automated purchase orders based on:
        
        Stock Predictions: ${JSON.stringify(predictions)}
        Supplier Performance: ${JSON.stringify(supplierPerformance)}
        
        Create purchase orders that:
        1. Prioritize products with high stockout risk
        2. Consider supplier performance and reliability
        3. Optimize for cost and delivery time
        4. Include recommended quantities and delivery dates
        
        Return as JSON array with purchase order details
      `;

      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
      });

      const response = completion.choices[0]?.message?.content;
      return response ? JSON.parse(response) : [];
    } catch (error) {
      console.error('Error generating purchase orders:', error);
      return [];
    }
  }

  /**
   * Optimize pricing based on demand and competition
   */
  async optimizePricing(
    productData: any[],
    salesHistory: any[],
    competitorPrices: any[]
  ): Promise<any[]> {
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