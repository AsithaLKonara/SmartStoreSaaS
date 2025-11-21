<<<<<<< HEAD
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
=======
import { prisma } from '../prisma';
import { realTimeSyncService } from '../sync/realTimeSyncService';

// SpeechRecognition type definitions - using any to avoid conflicts
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export interface VoiceCommand {
  id: string;
  command: string;
  action: string;
  userId: string | null; // Make nullable to match Prisma model
  intent: string | null; // Make nullable to match Prisma model
  entities: Record<string, any> | null; // Make nullable to match Prisma model
  confidence: number | null; // Make nullable to match Prisma model
  response: string | null; // Make nullable to match Prisma model
  timestamp: Date;
  processed: boolean | null; // Make nullable to match Prisma model
  organizationId: string | null; // Make nullable to match Prisma model
}

export interface VoiceIntent {
  name: string;
  patterns: string[];
  entities: string[];
  handler: string;
  examples: string[];
}

export interface SpeechRecognitionResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
  alternatives?: Array<{
    transcript: string;
    confidence: number;
  }>;
}

export interface VoiceResponse {
  text: string;
  ssml?: string;
  actions?: Array<{
    type: string;
    data: any;
  }>;
  suggestions?: string[];
}

export class VoiceCommerceService {
  private recognition: any | null = null;
  private synthesis: SpeechSynthesis | null = null;
  private isListening = false;
  private intents: VoiceIntent[] = [];

  constructor() {
    if (typeof window !== 'undefined') {
      this.initializeSpeechRecognition();
      this.initializeSpeechSynthesis();
      this.loadIntents();
    }
  }

  /**
   * Initialize speech recognition
   */
  private initializeSpeechRecognition(): void {
    try {
      const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        console.warn('Speech recognition not supported');
        return;
      }

      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';

      this.recognition.onstart = () => {
        console.log('Voice recognition started');
        this.isListening = true;
      };

      this.recognition.onend = () => {
        console.log('Voice recognition ended');
        this.isListening = false;
      };

      this.recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        this.isListening = false;
      };

      this.recognition.onresult = (event: any) => {
        this.handleSpeechResult(event);
      };

    } catch (error) {
      console.error('Error initializing speech recognition:', error);
    }
  }

  /**
   * Initialize speech synthesis
   */
  private initializeSpeechSynthesis(): void {
    try {
      if ('speechSynthesis' in window) {
        this.synthesis = window.speechSynthesis;
        console.log('Speech synthesis initialized');
      } else {
        console.warn('Speech synthesis not supported');
      }
    } catch (error) {
      console.error('Error initializing speech synthesis:', error);
    }
  }

  /**
   * Load voice intents
   */
  private loadIntents(): void {
    this.intents = [
      {
        name: 'search_products',
        patterns: [
          'search for *',
          'find *',
          'show me *',
          'look for *',
        ],
        entities: ['product_name', 'category'],
        handler: 'handleProductSearch',
        examples: [
          'search for laptops',
          'find red shoes',
          'show me electronics',
        ],
      },
      {
        name: 'add_to_cart',
        patterns: [
          'add * to cart',
          'add * to my cart',
          'put * in cart',
          'buy *',
        ],
        entities: ['product_name', 'quantity'],
        handler: 'handleAddToCart',
        examples: [
          'add iPhone to cart',
          'add 2 laptops to my cart',
          'buy wireless headphones',
        ],
      },
      {
        name: 'check_order_status',
        patterns: [
          'check order status',
          'where is my order',
          'order status for *',
          'track order *',
        ],
        entities: ['order_id'],
        handler: 'handleOrderStatus',
        examples: [
          'check order status',
          'where is my order 12345',
          'track order ABC123',
        ],
      },
      {
        name: 'view_cart',
        patterns: [
          'show my cart',
          'view cart',
          'what\'s in my cart',
          'cart contents',
        ],
        entities: [],
        handler: 'handleViewCart',
        examples: [
          'show my cart',
          'what\'s in my cart',
        ],
      },
      {
        name: 'checkout',
        patterns: [
          'checkout',
          'place order',
          'complete purchase',
          'buy now',
        ],
        entities: [],
        handler: 'handleCheckout',
        examples: [
          'checkout',
          'place order',
          'complete purchase',
        ],
      },
      {
        name: 'get_recommendations',
        patterns: [
          'recommend *',
          'suggest *',
          'what do you recommend',
          'show recommendations',
        ],
        entities: ['category', 'price_range'],
        handler: 'handleRecommendations',
        examples: [
          'recommend laptops under $1000',
          'suggest gift ideas',
          'what do you recommend',
        ],
      },
      {
        name: 'help',
        patterns: [
          'help',
          'what can you do',
          'commands',
          'how to use',
        ],
        entities: [],
        handler: 'handleHelp',
        examples: [
          'help',
          'what can you do',
          'show commands',
        ],
      },
    ];
  }

  /**
   * Start voice recognition
   */
  startListening(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.recognition) {
        reject(new Error('Speech recognition not available'));
        return;
      }

      if (this.isListening) {
        resolve();
        return;
      }

      try {
        this.recognition.start();
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop voice recognition
   */
  stopListening(): void {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
    }
  }

  /**
   * Process voice command
   */
  async processVoiceCommand(
    transcript: string,
    userId: string,
    organizationId: string
  ): Promise<VoiceResponse> {
    try {
      // Clean and normalize transcript
      const cleanTranscript = transcript.toLowerCase().trim();
      
      // Extract intent and entities
      const { intent, entities, confidence } = await this.extractIntent(cleanTranscript);
      
      // Store command
      const command: VoiceCommand = {
        id: '',
        userId,
        command: transcript,
        action: 'voice_command',
        intent: intent,
        entities: entities,
        confidence: confidence,
        response: '',
        timestamp: new Date(),
        processed: false,
        organizationId: organizationId,
      };

      const storedCommand = await this.storeVoiceCommand(command);
      await this.updateCommandStatus(storedCommand.id, true);

      // Process command based on intent
      const response = await this.handleIntent(intent, entities, userId, organizationId);
      
      // Update command as processed
      await this.updateCommandStatus(storedCommand.id, true, response.text);

      // Broadcast event
      await realTimeSyncService.broadcastEvent({
        id: `voice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'voice_command_processed',
        action: 'create',
        entityId: storedCommand.id,
        organizationId: storedCommand.organizationId || 'system', // Provide default value for null case
        data: { command, response },
        timestamp: new Date(),
        source: 'voice-commerce'
      });

      return response;
    } catch (error) {
      console.error('Error processing voice command:', error);
      return {
        text: 'Sorry, I couldn\'t understand that command. Please try again.',
        suggestions: ['Try saying "help" to see available commands'],
      };
    }
  }

  /**
   * Speak response
   */
  speak(text: string, options?: SpeechSynthesisUtterance): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.synthesis) {
        reject(new Error('Speech synthesis not available'));
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      
      if (options) {
        Object.assign(utterance, options);
      } else {
        utterance.rate = 0.9;
        utterance.pitch = 1;
        utterance.volume = 1;
      }

      utterance.onend = () => resolve();
      utterance.onerror = (error) => reject(error);

      this.synthesis.speak(utterance);
>>>>>>> 08d9e1855dc7fd2c99e5d62def516239ff37a9a7
    });

    const intent = this.detectIntent(command);
    const entities = this.extractEntities(command);
    const response = await this.generateResponse(intent, entities, organizationId);

<<<<<<< HEAD
    return {
      intent,
      confidence: this.calculateConfidence(command),
      entities,
      response,
      action: this.getAction(intent),
=======
  /**
   * Handle speech recognition results
   */
  private handleSpeechResult(event: any): void {
    let finalTranscript = '';
    let interimTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const transcript = result[0].transcript;

      if (result.isFinal) {
        finalTranscript += transcript;
      } else {
        interimTranscript += transcript;
      }
    }

    if (finalTranscript) {
      // Emit event for final transcript
      window.dispatchEvent(new CustomEvent('voiceCommand', {
        detail: {
          transcript: finalTranscript,
          confidence: event.results[event.resultIndex][0].confidence,
          isFinal: true,
        },
      }));
    }

    if (interimTranscript) {
      // Emit event for interim transcript
      window.dispatchEvent(new CustomEvent('voiceTranscript', {
        detail: {
          transcript: interimTranscript,
          isFinal: false,
        },
      }));
    }
  }

  /**
   * Extract intent from transcript
   */
  private async extractIntent(transcript: string): Promise<{
    intent: string;
    entities: Record<string, any>;
    confidence: number;
  }> {
    let bestMatch = {
      intent: 'unknown',
      entities: {},
      confidence: 0,
>>>>>>> 08d9e1855dc7fd2c99e5d62def516239ff37a9a7
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

<<<<<<< HEAD
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
=======
    try {
      const products = await prisma.product.findMany({
        where: {
          organizationId,
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { description: { contains: searchTerm, mode: 'insensitive' } },
            { category: { name: { contains: searchTerm, mode: 'insensitive' } } },
          ],
        },
        take: 5,
        include: { category: true },
      });

      if (products.length === 0) {
        return {
          text: `I couldn't find any products matching "${searchTerm}". Try a different search term.`,
          suggestions: ['search for electronics', 'find clothing', 'show all products'],
        };
      }

      const productNames = products.map((p: any) => p.name).join(', ');
      
      return {
        text: `I found ${products.length} products for "${searchTerm}": ${productNames}. Would you like to add any to your cart?`,
        actions: [
          {
            type: 'show_products',
            data: { products },
          },
        ],
        suggestions: products.slice(0, 3).map((p: any) => `add ${p.name} to cart`),
      };
    } catch (error) {
      console.error('Error searching products:', error);
      return {
        text: 'Sorry, I had trouble searching for products. Please try again.',
      };
    }
>>>>>>> 08d9e1855dc7fd2c99e5d62def516239ff37a9a7
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

<<<<<<< HEAD
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
=======
    try {
      // Find product
      const product = await prisma.product.findFirst({
        where: {
          organizationId,
          name: { contains: productName, mode: 'insensitive' },
        },
      });

      if (!product) {
        return {
          text: `I couldn't find a product called "${productName}". Try searching for it first.`,
          suggestions: [`search for ${productName}`],
        };
      }

      // Add to cart (simplified - you'd implement actual cart logic)
      return {
        text: `Added ${quantity} ${product.name} to your cart. The total is $${(product.price * quantity).toFixed(2)}.`,
        actions: [
          {
            type: 'add_to_cart',
            data: { productId: product.id, quantity },
          },
        ],
        suggestions: ['view cart', 'checkout', 'continue shopping'],
      };
    } catch (error) {
      console.error('Error adding to cart:', error);
      return {
        text: 'Sorry, I had trouble adding that to your cart. Please try again.',
      };
    }
  }

  private async handleOrderStatus(entities: Record<string, any>, userId: string): Promise<VoiceResponse> {
    const orderId = entities.order_id;

    try {
      const orders = await prisma.order.findMany({
        where: {
          customerId: userId,
          ...(orderId ? { id: orderId } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: orderId ? 1 : 3,
      });

      if (orders.length === 0) {
        return {
          text: orderId 
            ? `I couldn't find order ${orderId}. Please check the order number.`
            : 'You don\'t have any recent orders.',
        };
      }

      if (orderId) {
        const order = orders[0];
        return {
          text: `Order ${order.id} is ${order.status.toLowerCase()}. The total was $${order.totalAmount}.`,
          actions: [
            {
              type: 'show_order',
              data: { orderId: order.id },
            },
          ],
        };
      } else {
        const statusText = orders.map((order: any) => 
          `Order ${order.id} is ${order.status.toLowerCase()}`
        ).join(', ');
        
        return {
          text: `Here are your recent orders: ${statusText}.`,
          actions: [
            {
              type: 'show_orders',
              data: { orders },
            },
          ],
        };
      }
    } catch (error) {
      console.error('Error checking order status:', error);
      return {
        text: 'Sorry, I had trouble checking your order status. Please try again.',
      };
    }
  }

  private async handleViewCart(userId: string): Promise<VoiceResponse> {
    // Simplified cart view - you'd implement actual cart logic
    return {
      text: 'Your cart contains 3 items with a total of $299.99. Would you like to checkout?',
      actions: [
        {
          type: 'show_cart',
          data: {},
        },
      ],
      suggestions: ['checkout', 'remove item from cart', 'continue shopping'],
    };
  }

  private async handleCheckout(userId: string): Promise<VoiceResponse> {
    return {
      text: 'I\'ll help you checkout. Please review your order and confirm your shipping address.',
      actions: [
        {
          type: 'start_checkout',
          data: {},
        },
      ],
      suggestions: ['confirm order', 'change shipping address', 'cancel'],
    };
  }

  private async handleRecommendations(
    entities: Record<string, any>,
    userId: string,
    organizationId: string
  ): Promise<VoiceResponse> {
    const category = entities.category;
    const priceRange = entities.price_range;

    try {
      const products = await prisma.product.findMany({
        where: {
          organizationId,
          ...(category ? {
            category: { name: { contains: category, mode: 'insensitive' } }
          } : {}),
          ...(priceRange?.max ? { price: { lte: priceRange.max } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 3,
      });

      if (products.length === 0) {
        return {
          text: 'I don\'t have any recommendations matching your criteria right now.',
          suggestions: ['show popular products', 'search for electronics'],
        };
      }

      const recommendations = products.map((p: any) => `${p.name} for $${p.price}`).join(', ');
      
      return {
        text: `I recommend: ${recommendations}. Would you like to add any to your cart?`,
        actions: [
          {
            type: 'show_recommendations',
            data: { products },
          },
        ],
        suggestions: products.map((p: any) => `add ${p.name} to cart`),
      };
    } catch (error) {
      console.error('Error getting recommendations:', error);
      return {
        text: 'Sorry, I had trouble getting recommendations. Please try again.',
      };
    }
  }

  private handleHelp(): VoiceResponse {
    return {
      text: `I can help you with shopping! Here's what you can say: 
      "Search for products", "Add item to cart", "Check order status", 
      "Show my cart", "Checkout", or "Get recommendations". 
      What would you like to do?`,
      suggestions: [
        'search for laptops',
        'show my cart',
        'check order status',
        'get recommendations',
      ],
    };
  }

  /**
   * Store voice command
   */
  private async storeVoiceCommand(commandData: Omit<VoiceCommand, 'id' | 'response'>): Promise<VoiceCommand> {
    const voiceCommand = await prisma.voiceCommand.create({
      data: {
        userId: commandData.userId,
        command: commandData.command,
        intent: commandData.intent,
        entities: commandData.entities,
        confidence: commandData.confidence,
        timestamp: commandData.timestamp,
        processed: commandData.processed || undefined, // Convert null to undefined for Prisma
        response: '',
        action: commandData.action,
        organization: { connect: { id: commandData.organizationId || 'system' } } // Provide default for null case
      }
    });

    return {
      id: voiceCommand.id,
      userId: voiceCommand.userId, // Can be null
      command: voiceCommand.command,
      intent: voiceCommand.intent, // Can be null
      entities: voiceCommand.entities as Record<string, any> | null, // Can be null
      confidence: voiceCommand.confidence, // Can be null
      response: voiceCommand.response, // Can be null
      timestamp: voiceCommand.timestamp,
      processed: voiceCommand.processed, // Can be null
      organizationId: voiceCommand.organizationId, // Can be null
      action: voiceCommand.action || '', // Can be null, provide default
    };
  }

  /**
   * Update command status
   */
  private async updateCommandStatus(commandId: string, processed: boolean, response: string = ''): Promise<void> {
    await prisma.voiceCommand.update({
      where: { id: commandId },
      data: { processed, response },
    });
  }

  /**
   * Get voice command history
   */
  async getCommandHistory(userId: string, limit: number = 50): Promise<VoiceCommand[]> {
    const commands = await prisma.voiceCommand.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });

    return commands.map((cmd: any) => ({
      id: cmd.id,
      userId: cmd.userId, // Can be null
      command: cmd.command,
      intent: cmd.intent, // Can be null
      entities: cmd.entities as Record<string, any> | null, // Can be null
      confidence: cmd.confidence, // Can be null
      response: cmd.response, // Can be null
      timestamp: cmd.timestamp,
      processed: cmd.processed, // Can be null
      organizationId: cmd.organizationId, // Can be null
      action: cmd.action || '', // Can be null, provide default
    }));
  }

  /**
   * Check if voice features are supported
   */
  isVoiceSupported(): {
    speechRecognition: boolean;
    speechSynthesis: boolean;
    voiceCommands: boolean;
  } {
    return {
      speechRecognition: !!this.recognition,
      speechSynthesis: !!this.synthesis,
      voiceCommands: !!(this.recognition && this.synthesis),
    };
>>>>>>> 08d9e1855dc7fd2c99e5d62def516239ff37a9a7
  }
}
