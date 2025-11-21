import OpenAI from 'openai';
import { prisma } from '../prisma';

const openai = process.env.OPENAI_API_KEY 
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  : null;

export interface CustomerLTV {
  customerId: string;
  customerName: string;
  currentLTV: number;
  predictedLTV: number;
  confidence: number;
  factors: string[];
  recommendations: string[];
}

export interface ChurnRisk {
  customerId: string;
  customerName: string;
  churnRisk: number; // 0-1
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  factors: string[];
  retentionStrategies: string[];
  lastPurchaseDate: Date;
  daysSinceLastPurchase: number;
}

export interface CustomerSegment {
  segmentId: string;
  segmentName: string;
  customerCount: number;
  averageLTV: number;
  characteristics: string[];
  recommendations: string[];
  customers: string[];
}

export interface ProductRecommendation {
  customerId: string;
  productId: string;
  productName: string;
  confidence: number;
  reason: string;
  expectedPurchaseProbability: number;
}

export interface SentimentAnalysis {
  customerId: string;
  overallSentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  sentimentScore: number; // -1 to 1
  keyTopics: string[];
  sentimentTrend: 'IMPROVING' | 'STABLE' | 'DECLINING';
  recommendations: string[];
}

export class CustomerIntelligenceService {
  /**
   * Predict customer lifetime value
   */
  async predictCustomerLTV(
    customerData: any[],
    purchaseHistory: any[],
    interactionHistory: any[]
  ): Promise<CustomerLTV[]> {
    try {
      const openaiClient = getOpenAIClient();
      
      const prompt = `
        Predict customer lifetime value based on:
        
        Customer Data: ${JSON.stringify(customerData)}
        Purchase History: ${JSON.stringify(purchaseHistory)}
        Interaction History: ${JSON.stringify(interactionHistory)}
        
        For each customer, provide:
        1. Current LTV (based on historical data)
        2. Predicted LTV (next 12 months)
        3. Confidence level (0-1)
        4. Key factors influencing LTV
        5. Specific recommendations to increase LTV
        
        Return as JSON array with fields: customerId, customerName, currentLTV, predictedLTV, confidence, factors, recommendations
      `;

      const completion = await openaiClient.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      });

      const response = completion.choices[0]?.message?.content;
      return response ? JSON.parse(response) : [];
    } catch (error) {
      console.error('Error predicting customer LTV:', error);
      return [];
    }
  }

  /**
   * Assess churn risk for customers
   */
  async assessChurnRisk(
    customerData: any[],
    purchaseHistory: any[],
    interactionHistory: any[]
  ): Promise<ChurnRisk[]> {
    try {
      const prompt = `
        Assess churn risk for customers based on:
        
        Customer Data: ${JSON.stringify(customerData)}
        Purchase History: ${JSON.stringify(purchaseHistory)}
        Interaction History: ${JSON.stringify(interactionHistory)}
        
        For each customer, provide:
        1. Churn risk score (0-1)
        2. Risk level (LOW, MEDIUM, HIGH, CRITICAL)
        3. Key factors contributing to churn risk
        4. Specific retention strategies
        5. Days since last purchase
        
        Return as JSON array with fields: customerId, customerName, churnRisk, riskLevel, factors, retentionStrategies, lastPurchaseDate, daysSinceLastPurchase
      `;

      const completion = await getOpenAIClient().chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      });

      const response = completion.choices[0]?.message?.content;
      return response ? JSON.parse(response) : [];
    } catch (error) {
      console.error('Error assessing churn risk:', error);
      return [];
    }
  }

  /**
   * Create customer segments with AI
   */
  async createCustomerSegments(
    customerData: any[],
    purchaseHistory: any[],
    behaviorData: any[]
  ): Promise<CustomerSegment[]> {
    try {
      const prompt = `
        Create customer segments based on:
        
        Customer Data: ${JSON.stringify(customerData)}
        Purchase History: ${JSON.stringify(purchaseHistory)}
        Behavior Data: ${JSON.stringify(behaviorData)}
        
        Create meaningful segments that:
        1. Group customers with similar characteristics
        2. Provide segment-specific insights
        3. Include actionable recommendations
        4. Identify high-value segments
        
        Return as JSON array with fields: segmentId, segmentName, customerCount, averageLTV, characteristics, recommendations, customers
      `;

      const completion = await getOpenAIClient().chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4,
      });

      const response = completion.choices[0]?.message?.content;
      return response ? JSON.parse(response) : [];
    } catch (error) {
      console.error('Error creating customer segments:', error);
      return [];
    }
  }

  /**
   * Generate personalized product recommendations
   */
  async generateProductRecommendations(
    customerData: any[],
    purchaseHistory: any[],
    productCatalog: any[]
  ): Promise<ProductRecommendation[]> {
    try {
      const prompt = `
        Generate personalized product recommendations based on:
        
        Customer Data: ${JSON.stringify(customerData)}
        Purchase History: ${JSON.stringify(purchaseHistory)}
        Product Catalog: ${JSON.stringify(productCatalog)}
        
        For each customer, recommend products that:
        1. Match their purchase patterns
        2. Complement their existing purchases
        3. Have high purchase probability
        4. Include reasoning for recommendations
        
        Return as JSON array with fields: customerId, productId, productName, confidence, reason, expectedPurchaseProbability
      `;

      const completion = await getOpenAIClient().chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      });

      const response = completion.choices[0]?.message?.content;
      return response ? JSON.parse(response) : [];
    } catch (error) {
      console.error('Error generating product recommendations:', error);
      return [];
    }
  }

  /**
   * Analyze customer sentiment using Prisma models
   */
  async analyzeCustomerSentiment(
    customerData: any[],
    reviews: any[],
    supportTickets: any[],
    socialMediaData: any[]
  ): Promise<SentimentAnalysis[]> {
    try {
      const prompt = `
        Analyze customer sentiment based on:
        
        Customer Data: ${JSON.stringify(customerData)}
        Reviews: ${JSON.stringify(reviews)}
        Support Tickets: ${JSON.stringify(supportTickets)}
        Social Media Data: ${JSON.stringify(socialMediaData)}
        
        For each customer, provide:
        1. Overall sentiment (POSITIVE, NEUTRAL, NEGATIVE)
        2. Sentiment score (-1 to 1)
        3. Key topics discussed
        4. Sentiment trend (IMPROVING, STABLE, DECLINING)
        5. Recommendations to improve sentiment
        
        Return as JSON array with fields: customerId, overallSentiment, sentimentScore, keyTopics, sentimentTrend, recommendations
      `;

      const completion = await getOpenAIClient().chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      });

      const response = completion.choices[0]?.message?.content;
      return response ? JSON.parse(response) : [];
    } catch (error) {
      console.error('Error analyzing customer sentiment:', error);
      return [];
    }
  }

  /**
   * Get customer sentiment data from Prisma models
   */
  async getCustomerSentimentData(organizationId: string, customerId?: string): Promise<{
    reviews: any[];
    supportTickets: any[];
    customerSegments: any[];
    customerOffers: any[];
  }> {
    try {
      const whereClause = customerId ? { customerId } : {};
      const orgClause = { organizationId };

      const [reviews, supportTickets, customerSegments, customerOffers] = await Promise.all([
        prisma.review.findMany({
          where: { ...whereClause, ...orgClause },
          include: { customer: true, product: true }
        }),
        prisma.supportTicket.findMany({
          where: { ...whereClause, ...orgClause },
          include: { customer: true, order: true }
        }),
        prisma.customerSegment.findMany({
          where: orgClause,
          include: { customerSegmentCustomers: { include: { customer: true } } }
        }),
        prisma.customerOffer.findMany({
          where: orgClause,
          include: { customerOfferCustomers: { include: { customer: true } } }
        })
      ]);

      return { reviews, supportTickets, customerSegments, customerOffers };
    } catch (error) {
      console.error('Error fetching customer sentiment data:', error);
      return { reviews: [], supportTickets: [], customerSegments: [], customerOffers: [] };
    }
  }

  /**
   * Analyze purchase patterns and behavior
   */
  async analyzePurchasePatterns(
    customerData: any[],
    purchaseHistory: any[]
  ): Promise<any[]> {
    try {
      const prompt = `
        Analyze customer purchase patterns based on:
        
        Customer Data: ${JSON.stringify(customerData)}
        Purchase History: ${JSON.stringify(purchaseHistory)}
        
        Identify patterns such as:
        1. Purchase frequency and timing
        2. Product category preferences
        3. Seasonal buying behavior
        4. Price sensitivity
        5. Cross-selling opportunities
        
        Return as JSON array with detailed pattern analysis
      `;

      const completion = await getOpenAIClient().chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      });

      const response = completion.choices[0]?.message?.content;
      return response ? JSON.parse(response) : [];
    } catch (error) {
      console.error('Error analyzing purchase patterns:', error);
      return [];
    }
  }
}

export const customerIntelligenceService = new CustomerIntelligenceService(); 