import OpenAI from 'openai';

const openai = process.env.OPENAI_API_KEY 
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  : null;

export interface RealTimeMetrics {
  timestamp: Date;
  totalSales: number;
  activeOrders: number;
  pendingDeliveries: number;
  onlineCustomers: number;
  conversionRate: number;
  averageOrderValue: number;
  topSellingProducts: Array<Record<string, unknown>>;
  revenueByHour: Array<Record<string, unknown>>;
}

export interface PerformanceKPI {
  kpiId: string;
  kpiName: string;
  currentValue: number;
  previousValue: number;
  change: number;
  changePercentage: number;
  trend: 'UP' | 'DOWN' | 'STABLE';
  target: number;
  status: 'ON_TRACK' | 'AT_RISK' | 'BEHIND';
}

export interface SalesForecast {
  period: string;
  predictedRevenue: number;
  confidence: number;
  factors: string[];
  recommendations: string[];
}

export interface MarketTrend {
  trendId: string;
  trendName: string;
  description: string;
  impact: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  confidence: number;
  recommendations: string[];
}

export interface CompetitiveAnalysis {
  competitorId: string;
  competitorName: string;
  marketShare: number;
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
  recommendations: string[];
}

export interface RiskAssessment {
  riskId: string;
  riskName: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  probability: number;
  impact: number;
  mitigationStrategies: string[];
  monitoringMetrics: string[];
}

// Helper function to ensure openai client is available
function getOpenAIClient(): OpenAI {
  if (!openai) {
    throw new Error("OpenAI API key is not configured.");
  }
  return openai;
}

export class BusinessIntelligenceService {
  private checkOpenAI(): boolean {
    if (!openai) {
      console.warn('OpenAI API key not configured');
      return false;
    }
    return true;
  }

  /**
   * Generate real-time business metrics
   */
  async generateRealTimeMetrics(
    salesData: Array<Record<string, unknown>>,
    orderData: Array<Record<string, unknown>>,
    customerData: Array<Record<string, unknown>>,
    productData: Array<Record<string, unknown>>
  ): Promise<RealTimeMetrics> {
    try {
      if (!this.checkOpenAI()) {
        return {} as RealTimeMetrics;
      }

      const prompt = `
        Generate real-time business metrics based on:
        
        Sales Data: ${JSON.stringify(salesData)}
        Order Data: ${JSON.stringify(orderData)}
        Customer Data: ${JSON.stringify(customerData)}
        Product Data: ${JSON.stringify(productData)}
        
        Calculate:
        1. Total sales (current period)
        2. Active orders count
        3. Pending deliveries
        4. Online customers
        5. Conversion rate
        6. Average order value
        7. Top selling products
        8. Revenue by hour
        
        Return as JSON with all calculated metrics
      `;

      const completion = await getOpenAIClient().chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
      });

      const response = completion.choices[0]?.message?.content;
      if (response) {
        try {
          return JSON.parse(response) as RealTimeMetrics;
        } catch (parseError) {
          console.error('Error parsing AI response:', parseError);
        }
      }
      
      // Return default metrics if AI fails
      return {
        timestamp: new Date(),
        totalSales: 0,
        activeOrders: 0,
        pendingDeliveries: 0,
        onlineCustomers: 0,
        conversionRate: 0,
        averageOrderValue: 0,
        topSellingProducts: [],
        revenueByHour: []
      };
    } catch (error) {
      console.error('Error generating real-time metrics:', error);
      return {
        timestamp: new Date(),
        totalSales: 0,
        activeOrders: 0,
        pendingDeliveries: 0,
        onlineCustomers: 0,
        conversionRate: 0,
        averageOrderValue: 0,
        topSellingProducts: [],
        revenueByHour: []
      };
    }
  }

  /**
   * Calculate performance KPIs
   */
  async calculatePerformanceKPIs(
    currentData: Array<Record<string, unknown>>,
    historicalData: Array<Record<string, unknown>>,
    targets: Array<Record<string, unknown>>
  ): Promise<PerformanceKPI[]> {
    try {
      if (!this.checkOpenAI()) {
        return [];
      }

      const prompt = `
        Calculate performance KPIs based on:
        
        Current Data: ${JSON.stringify(currentData)}
        Historical Data: ${JSON.stringify(historicalData)}
        Targets: ${JSON.stringify(targets)}
        
        For each KPI, provide:
        1. Current value
        2. Previous period value
        3. Change and percentage
        4. Trend direction
        5. Status vs target
        
        KPIs to calculate:
        - Revenue growth
        - Customer acquisition cost
        - Customer lifetime value
        - Order fulfillment rate
        - Customer satisfaction score
        - Inventory turnover
        - Profit margins
        
        Return as JSON array with KPI details
      `;

      const completion = await openai!.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
      });

      const response = completion.choices[0]?.message?.content;
      return response ? JSON.parse(response) : [];
    } catch (error) {
      console.error('Error calculating performance KPIs:', error);
      return [];
    }
  }

  /**
   * Generate sales forecasts
   */
  async generateSalesForecasts(
    historicalSales: Array<Record<string, unknown>>,
    marketData: Array<Record<string, unknown>>,
    seasonalData: Array<Record<string, unknown>>
  ): Promise<SalesForecast[]> {
    try {
      if (!this.checkOpenAI()) {
        return [];
      }

      const prompt = `
        Generate sales forecasts based on:
        
        Historical Sales: ${JSON.stringify(historicalSales)}
        Market Data: ${JSON.stringify(marketData)}
        Seasonal Data: ${JSON.stringify(seasonalData)}
        
        Provide forecasts for:
        1. Next 30 days
        2. Next quarter
        3. Next year
        
        For each period, include:
        1. Predicted revenue
        2. Confidence level
        3. Key factors
        4. Recommendations
        
        Return as JSON array with forecast details
      `;

      const completion = await openai!.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      });

      const response = completion.choices[0]?.message?.content;
      return response ? JSON.parse(response) : [];
    } catch (error) {
      console.error('Error generating sales forecasts:', error);
      return [];
    }
  }

  /**
   * Analyze market trends
   */
  async analyzeMarketTrends(
    marketData: Array<Record<string, unknown>>,
    competitorData: Array<Record<string, unknown>>,
    industryReports: Array<Record<string, unknown>>
  ): Promise<MarketTrend[]> {
    try {
      if (!this.checkOpenAI()) {
        return [];
      }

      const prompt = `
        Analyze market trends based on:
        
        Market Data: ${JSON.stringify(marketData)}
        Competitor Data: ${JSON.stringify(competitorData)}
        Industry Reports: ${JSON.stringify(industryReports)}
        
        Identify trends such as:
        1. Consumer behavior changes
        2. Technology adoption
        3. Regulatory changes
        4. Economic factors
        5. Competitive landscape shifts
        
        For each trend, provide:
        1. Description and impact
        2. Confidence level
        3. Strategic recommendations
        
        Return as JSON array with trend analysis
      `;

      const completion = await openai!.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4,
      });

      const response = completion.choices[0]?.message?.content;
      return response ? JSON.parse(response) : [];
    } catch (error) {
      console.error('Error analyzing market trends:', error);
      return [];
    }
  }

  /**
   * Perform competitive analysis
   */
  async performCompetitiveAnalysis(
    competitorData: Array<Record<string, unknown>>,
    marketShareData: Array<Record<string, unknown>>,
    productComparison: Array<Record<string, unknown>>
  ): Promise<CompetitiveAnalysis[]> {
    try {
      if (!this.checkOpenAI()) {
        return [];
      }

      const prompt = `
        Perform competitive analysis based on:
        
        Competitor Data: ${JSON.stringify(competitorData)}
        Market Share Data: ${JSON.stringify(marketShareData)}
        Product Comparison: ${JSON.stringify(productComparison)}
        
        For each competitor, analyze:
        1. Market share and positioning
        2. Strengths and weaknesses
        3. Opportunities and threats
        4. Strategic recommendations
        
        Use SWOT analysis framework and provide actionable insights.
        
        Return as JSON array with competitive analysis
      `;

      const completion = await openai!.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      });

      const response = completion.choices[0]?.message?.content;
      return response ? JSON.parse(response) : [];
    } catch (error) {
      console.error('Error performing competitive analysis:', error);
      return [];
    }
  }

  /**
   * Assess business risks
   */
  async assessBusinessRisks(
    businessData: Array<Record<string, unknown>>,
    marketData: any[],
    financialData: any[]
  ): Promise<RiskAssessment[]> {
    try {
      if (!this.checkOpenAI()) {
        return [];
      }

      const prompt = `
        Assess business risks based on:
        
        Business Data: ${JSON.stringify(businessData)}
        Market Data: ${JSON.stringify(marketData)}
        Financial Data: ${JSON.stringify(financialData)}
        
        Identify risks in areas such as:
        1. Operational risks
        2. Financial risks
        3. Market risks
        4. Technology risks
        5. Regulatory risks
        
        For each risk, provide:
        1. Risk level and probability
        2. Potential impact
        3. Mitigation strategies
        4. Monitoring metrics
        
        Return as JSON array with risk assessment
      `;

      const completion = await openai!.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      });

      const response = completion.choices[0]?.message?.content;
      return response ? JSON.parse(response) : [];
    } catch (error) {
      console.error('Error assessing business risks:', error);
      return [];
    }
  }

  /**
   * Generate business insights and recommendations
   */
  async generateBusinessInsights(
    allData: any[]
  ): Promise<any[]> {
    try {
      if (!this.checkOpenAI()) {
        return [];
      }

      const prompt = `
        Generate comprehensive business insights based on all available data:
        
        Data: ${JSON.stringify(allData)}
        
        Provide insights on:
        1. Revenue optimization opportunities
        2. Cost reduction strategies
        3. Customer experience improvements
        4. Operational efficiency gains
        5. Market expansion opportunities
        6. Technology adoption recommendations
        
        For each insight, include:
        1. Description and rationale
        2. Expected impact
        3. Implementation recommendations
        4. Success metrics
        
        Return as JSON array with business insights
      `;

      const completion = await openai!.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4,
      });

      const response = completion.choices[0]?.message?.content;
      return response ? JSON.parse(response) : [];
    } catch (error) {
      console.error('Error generating business insights:', error);
      return [];
    }
  }
}

export const businessIntelligenceService = new BusinessIntelligenceService(); 