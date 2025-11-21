import { prisma } from '@/lib/prisma';

export interface VoiceCommandResult {
  intent: string;
  confidence: number;
  entities: Record<string, any>;
  response: string;
  action?: string;
}

export class VoiceCommerceService {
  async processVoiceCommand(
    organizationId: string,
    userId: string | undefined,
    command: string
  ): Promise<VoiceCommandResult> {
    // Log voice command
    await prisma.voiceCommand.create({
      data: {
        organizationId,
        userId: userId || undefined,
        command,
        intent: this.detectIntent(command),
        confidence: this.calculateConfidence(command),
        processedAt: new Date(),
      },
    });

    const intent = this.detectIntent(command);
    const entities = this.extractEntities(command);
    const response = await this.generateResponse(intent, entities, organizationId);

    return {
      intent,
      confidence: this.calculateConfidence(command),
      entities,
      response,
      action: this.getAction(intent),
    };
  }

  private detectIntent(command: string): string {
    const lowerCommand = command.toLowerCase();

    if (lowerCommand.includes('search') || lowerCommand.includes('find') || lowerCommand.includes('show')) {
      return 'search';
    } else if (lowerCommand.includes('order') || lowerCommand.includes('buy') || lowerCommand.includes('purchase')) {
      return 'order';
    } else if (lowerCommand.includes('help') || lowerCommand.includes('support')) {
      return 'support';
    } else if (lowerCommand.includes('cart') || lowerCommand.includes('basket')) {
      return 'cart';
    } else if (lowerCommand.includes('price') || lowerCommand.includes('cost')) {
      return 'price';
    } else {
      return 'navigation';
    }
  }

  private extractEntities(command: string): Record<string, any> {
    const entities: Record<string, any> = {};
    const lowerCommand = command.toLowerCase();

    // Extract product names (simplified - would use NLP in production)
    const productKeywords = ['product', 'item', 'shirt', 'shoes', 'watch', 'bag'];
    productKeywords.forEach(keyword => {
      if (lowerCommand.includes(keyword)) {
        entities.product = keyword;
      }
    });

    // Extract quantities
    const quantityMatch = command.match(/\d+/);
    if (quantityMatch) {
      entities.quantity = parseInt(quantityMatch[0]);
    }

    // Extract colors
    const colors = ['red', 'blue', 'green', 'black', 'white', 'yellow'];
    colors.forEach(color => {
      if (lowerCommand.includes(color)) {
        entities.color = color;
      }
    });

    return entities;
  }

  private calculateConfidence(command: string): number {
    // Simple confidence calculation based on command length and keywords
    const keywords = ['search', 'find', 'order', 'buy', 'show', 'price', 'cart'];
    const lowerCommand = command.toLowerCase();
    const foundKeywords = keywords.filter(kw => lowerCommand.includes(kw)).length;
    
    return Math.min(0.5 + (foundKeywords * 0.1) + (command.length > 10 ? 0.2 : 0), 1.0);
  }

  private async generateResponse(
    intent: string,
    entities: Record<string, any>,
    organizationId: string
  ): Promise<string> {
    switch (intent) {
      case 'search':
        if (entities.product) {
          const products = await this.searchProducts(organizationId, entities.product);
          return `I found ${products.length} products matching "${entities.product}". Would you like to see them?`;
        }
        return 'What would you like to search for?';

      case 'order':
        if (entities.product) {
          return `I can help you order ${entities.product}. Would you like to proceed?`;
        }
        return 'What would you like to order?';

      case 'cart':
        return 'You have 3 items in your cart. Would you like to checkout?';

      case 'price':
        if (entities.product) {
          return `The price for ${entities.product} is $29.99. Would you like to add it to cart?`;
        }
        return 'Which product would you like to know the price of?';

      case 'support':
        return 'I can help you with orders, products, and returns. What do you need assistance with?';

      default:
        return 'How can I help you today?';
    }
  }

  private getAction(intent: string): string | undefined {
    const actionMap: Record<string, string> = {
      'search': 'navigate_to_search',
      'order': 'navigate_to_product',
      'cart': 'navigate_to_cart',
      'price': 'show_price',
      'support': 'open_support',
    };
    return actionMap[intent];
  }

  private async searchProducts(organizationId: string, query: string): Promise<any[]> {
    const products = await prisma.product.findMany({
      where: {
        organizationId,
        isActive: true,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 10,
    });

    return products;
  }

  async searchByVoice(
    organizationId: string,
    query: string
  ): Promise<any[]> {
    return await this.searchProducts(organizationId, query);
  }

  async createOrderByVoice(
    organizationId: string,
    userId: string,
    productId: string,
    quantity: number = 1
  ): Promise<any> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product || product.organizationId !== organizationId) {
      throw new Error('Product not found');
    }

    // Find or create customer
    let customer = await prisma.customer.findFirst({
      where: {
        organizationId,
        // Would need to link user to customer
      },
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          organizationId,
          name: 'Voice Customer',
        },
      });
    }

    // Create order
    const order = await prisma.order.create({
      data: {
        orderNumber: `VOICE-${Date.now()}`,
        status: 'PENDING',
        totalAmount: product.price * quantity,
        subtotal: product.price * quantity,
        customerId: customer.id,
        organizationId,
        metadata: {
          source: 'voice',
          userId,
        },
      },
    });

    return order;
  }
}
