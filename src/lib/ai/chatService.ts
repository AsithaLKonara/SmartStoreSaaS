import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';
import { generateOrderNumber } from '@/lib/utils';

interface SentimentScore {
  positive: number;
  negative: number;
  neutral: number;
  overall: 'positive' | 'negative' | 'neutral';
}

interface ProductRecommendation {
  productId: string;
  name: string;
  price: number;
  confidence: number;
  reason: string;
}

interface OrderFromChat {
  customerId: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  totalAmount: number;
  notes?: string;
}

interface ChatConversationData {
  id: string;
  title?: string;
  status: string;
  priority: string;
  customerId: string;
  messages: Array<{
    id: string;
    content: string;
    role: 'user' | 'assistant' | 'system';
    timestamp: Date;
  }>;
  assignedTo?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class AIChatService {
  private openai: OpenAI | null;
  private ollamaBaseUrl: string;

  constructor() {
    this.openai = process.env.OPENAI_API_KEY 
      ? new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        })
      : null;
    this.ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  }

  private getOpenAIClient(): OpenAI {
    if (!this.openai) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY environment variable is not set');
      }
      this.openai = new OpenAI({ apiKey });
    }
    return this.openai;
  }

  // Product Discovery
  async findProductsByDescription(query: string, organizationId: string): Promise<ProductRecommendation[]> {
    try {
      const prompt = `
        Find products that match this description: "${query}"
        Available products: ${await this.getProductCatalog(organizationId)}
        
        Return JSON array with:
        - productId: string
        - name: string
        - price: number
        - confidence: number (0-1)
        - reason: string
      `;

      if (!this.openai) {
        throw new Error('OpenAI API key not configured');
      }
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      });

      const result = JSON.parse(response.choices[0].message.content || '[]');
      return result;
    } catch (error) {
      console.error('Error finding products:', error);
      return [];
    }
  }

  async recommendProducts(customerId: string, context: string, organizationId: string): Promise<ProductRecommendation[]> {
    try {
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        include: {
          orders: {
            include: {
              items: {
                include: {
                  product: true,
                },
              },
            },
          },
        },
      });

      if (!customer) return [];

      const purchaseHistory = customer.orders
        .flatMap(order => order.items)
        .map(item => item.product.name)
        .join(', ');

      const prompt = `
        Customer context: "${context}"
        Purchase history: ${purchaseHistory}
        Total spent: $${customer.totalSpent}
        
        Recommend products based on this context and history.
        Return JSON array with product recommendations.
      `;

      if (!this.openai) {
        throw new Error('OpenAI API key not configured');
      }
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
      });

      const result = JSON.parse(response.choices[0].message.content || '[]');
      return result;
    } catch (error) {
      console.error('Error recommending products:', error);
      return [];
    }
  }

  // Order Processing
  async createOrderFromChat(conversation: ChatConversationData): Promise<OrderFromChat | null> {
    try {
      const messages = conversation.messages
        .map((msg) => `${msg.role}: ${msg.content}`)
        .join('\n');

      const prompt = `
        Extract order information from this conversation:
        ${messages}
        
        Return JSON with:
        - customerId: string
        - items: array of {productId: string, quantity: number}
        - totalAmount: number
        - notes: string (optional)
      `;

      if (!this.openai) {
        throw new Error('OpenAI API key not configured');
      }
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      return result;
    } catch (error) {
      console.error('Error creating order from chat:', error);
      return null;
    }
  }

  async updateOrderStatus(orderId: string, status: string): Promise<void> {
    try {
      await prisma.order.update({
        where: { id: orderId },
        data: { status: status as 'DRAFT' | 'PENDING' | 'CONFIRMED' | 'PACKED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'COMPLETED' | 'CANCELLED' | 'RETURNED' },
      });
    } catch (error) {
      console.error('Error updating order status:', error);
    }
  }

  // Customer Support
  async answerFAQ(question: string, organizationId: string): Promise<string> {
    try {
      const faqs = await this.getOrganizationFAQs(organizationId);
      
      const prompt = `
        Answer this question: "${question}"
        
        Available FAQs:
        ${faqs}
        
        Provide a helpful, accurate response. If the question isn't covered in FAQs, say so politely.
      `;

      if (!this.openai) {
        throw new Error('OpenAI API key not configured');
      }
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      });

      return response.choices[0].message.content || 'I apologize, but I cannot answer that question at the moment.';
    } catch (error) {
      console.error('Error answering FAQ:', error);
      return 'I apologize, but I cannot answer that question at the moment.';
    }
  }

  async provideOrderStatus(orderNumber: string, organizationId: string): Promise<string> {
    try {
      const order = await prisma.order.findFirst({
        where: {
          orderNumber,
          organizationId,
        },
        include: {
          customer: true,
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      if (!order) {
        return 'Order not found. Please check the order number and try again.';
      }

      const prompt = `
        Provide a friendly order status update for order #${orderNumber}:
        
        Order details:
        - Status: ${order.status}
        - Total: $${order.totalAmount}
        - Customer: ${order.customer.name}
        - Items: ${order.items.map(item => `${item.product.name} (${item.quantity})`).join(', ')}
        - Created: ${order.createdAt}
        
        Be helpful and informative.
      `;

      if (!this.openai) {
        throw new Error('OpenAI API key not configured');
      }
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
      });

      return response.choices[0].message.content || 'Order status information is currently unavailable.';
    } catch (error) {
      console.error('Error providing order status:', error);
      return 'Order status information is currently unavailable.';
    }
  }

  // Sentiment Analysis with proper data types
  async analyzeCustomerSentiment(message: string): Promise<SentimentScore> {
    try {
      const prompt = `
        Analyze the sentiment of this message: "${message}"
        
        Return JSON with:
        - positive: number (0-1)
        - negative: number (0-1)
        - neutral: number (0-1)
        - overall: "positive" | "negative" | "neutral"
      `;

      if (!this.openai) {
        throw new Error('OpenAI API key not configured');
      }
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      return result;
    } catch (error) {
      console.error('Error analyzing sentiment:', error);
      return {
        positive: 0.5,
        negative: 0.5,
        neutral: 0,
        overall: 'neutral',
      };
    }
  }

  async detectUrgentIssues(conversation: ChatConversationData): Promise<boolean> {
    try {
      const messages = conversation.messages
        .map((msg) => msg.content)
        .join(' ');

      const prompt = `
        Detect if this conversation contains urgent issues that need immediate attention:
        "${messages}"
        
        Look for keywords like: urgent, emergency, broken, refund, complaint, angry, etc.
        
        Return JSON with:
        - isUrgent: boolean
        - reason: string
      `;

      if (!this.openai) {
        throw new Error('OpenAI API key not configured');
      }
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      return result.isUrgent || false;
    } catch (error) {
      console.error('Error detecting urgent issues:', error);
      return false;
    }
  }

  // Chat Conversation Management
  async getChatConversation(conversationId: string, organizationId: string): Promise<ChatConversationData | null> {
    try {
      const conversation = await prisma.customerConversation.findFirst({
        where: { id: conversationId, organizationId },
        include: {
          customer: true,
          messages: true,
          assignedAgent: true
        }
      });

      if (!conversation) return null;

      return {
        id: conversation.id,
        status: conversation.status,
        priority: conversation.priority,
        customerId: conversation.customerId,
        messages: conversation.messages.map((msg: { id: string; message: string; isIncoming: boolean; timestamp: Date }) => ({
          id: msg.id,
          content: msg.message,
          role: msg.isIncoming ? 'user' : 'assistant',
          timestamp: msg.timestamp
        })),
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt
      };
    } catch (error) {
      console.error('Error fetching chat conversation:', error);
      return null;
    }
  }

  async updateChatConversationStatus(
    conversationId: string, 
    status: string, 
    priority?: string
  ): Promise<void> {
    try {
      await prisma.customerConversation.update({
        where: { id: conversationId },
        data: { 
          status,
          priority: priority || undefined,
          updatedAt: new Date()
        }
      });
    } catch (error) {
      console.error('Error updating chat conversation status:', error);
    }
  }

  // Helper methods
  private async getProductCatalog(organizationId: string): Promise<string> {
    const products = await prisma.product.findMany({
      where: { organizationId },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        category: {
          select: { name: true },
        },
      },
    });

    return products
      .map(p => `${p.name} (${p.category?.name || 'Uncategorized'}) - $${p.price} - ${p.description}`)
      .join('\n');
  }

  private async getOrganizationFAQs(organizationId: string): Promise<string> {
    // This would typically come from a FAQ database
    // For now, returning common e-commerce FAQs
    return `
      Q: How can I track my order?
      A: You can track your order by entering your order number on our website or contacting customer support.
      
      Q: What is your return policy?
      A: We accept returns within 30 days of purchase for unused items in original packaging.
      
      Q: Do you offer free shipping?
      A: Free shipping is available on orders over $50.
      
      Q: How long does delivery take?
      A: Standard delivery takes 3-5 business days, express delivery takes 1-2 business days.
    `;
  }
}

export const aiChatService = new AIChatService(); 