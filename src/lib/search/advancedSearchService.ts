import { prisma } from '@/lib/prisma';

export interface SearchFilters {
  category?: string;
  brand?: string;
  priceRange?: { min: number; max: number };
  status?: string;
  dateRange?: { start: Date; end: Date };
  tags?: string[];
  location?: string;
}

export interface SearchResult {
  id: string;
  type: 'product' | 'customer' | 'order' | 'category';
  title: string;
  description?: string;
  relevance: number;
  metadata: any;
  highlights: string[];
}

export interface SearchOptions {
  query: string;
  filters?: SearchFilters;
  sortBy?: 'relevance' | 'name' | 'price' | 'date' | 'popularity';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
  includeInactive?: boolean;
}

export interface SearchAnalytics {
  totalResults: number;
  searchTime: number;
  facets: {
    categories: Array<{ name: string; count: number }>;
    brands: Array<{ name: string; count: number }>;
    priceRanges: Array<{ range: string; count: number }>;
    statuses: Array<{ name: string; count: number }>;
  };
}

export class AdvancedSearchService {
  async searchProducts(organizationId: string, options: SearchOptions): Promise<{ results: SearchResult[]; analytics: SearchAnalytics }> {
    const startTime = Date.now();
    
    const where: any = {
      organizationId,
      OR: [
        { name: { contains: options.query, mode: 'insensitive' } },
        { description: { contains: options.query, mode: 'insensitive' } },
        { sku: { contains: options.query, mode: 'insensitive' } },
        { barcode: { contains: options.query, mode: 'insensitive' } },
        { category: { contains: options.query, mode: 'insensitive' } },
        { brand: { contains: options.query, mode: 'insensitive' } }
      ]
    };

    if (options.filters) {
      if (options.filters.category) {
        where.category = { contains: options.filters.category, mode: 'insensitive' };
      }
      if (options.filters.brand) {
        where.brand = { contains: options.filters.brand, mode: 'insensitive' };
      }
      if (options.filters.priceRange) {
        where.price = {
          gte: options.filters.priceRange.min,
          lte: options.filters.priceRange.max
        };
      }
      if (options.filters.tags && options.filters.tags.length > 0) {
        where.tags = { hasSome: options.filters.tags };
      }
      if (!options.includeInactive) {
        where.isActive = true;
      }
    }

    const orderBy: any = {};
    if (options.sortBy === 'name') {
      orderBy.name = options.sortOrder || 'asc';
    } else if (options.sortBy === 'price') {
      orderBy.price = options.sortOrder || 'asc';
    } else if (options.sortBy === 'date') {
      orderBy.createdAt = options.sortOrder || 'desc';
    } else {
      // Default to relevance (name similarity)
      orderBy.name = 'asc';
    }

    const products = await prisma.product.findMany({
      where,
      orderBy,
      take: options.limit || 20,
      skip: options.offset || 0
    });

    const results: SearchResult[] = products.map(product => ({
      id: product.id,
      type: 'product',
      title: product.name,
      description: product.description,
      relevance: this.calculateRelevance(product, options.query),
      metadata: {
        price: product.price,
        sku: product.sku,
        category: product.category,
        brand: product.brand,
        stockQuantity: product.stockQuantity,
        isActive: product.isActive
      },
      highlights: this.generateHighlights(product, options.query)
    }));

    // Sort by relevance if not already sorted
    if (options.sortBy === 'relevance') {
      results.sort((a, b) => b.relevance - a.relevance);
    }

    const analytics = await this.generateSearchAnalytics(organizationId, options);

    return {
      results,
      analytics: {
        ...analytics,
        totalResults: results.length,
        searchTime: Date.now() - startTime
      }
    };
  }

  async searchCustomers(organizationId: string, options: SearchOptions): Promise<{ results: SearchResult[]; analytics: SearchAnalytics }> {
    const startTime = Date.now();
    
    const where: any = {
      organizationId,
      OR: [
        { name: { contains: options.query, mode: 'insensitive' } },
        { email: { contains: options.query, mode: 'insensitive' } },
        { phone: { contains: options.query, mode: 'insensitive' } },
        { address: { contains: options.query, mode: 'insensitive' } },
        { city: { contains: options.query, mode: 'insensitive' } },
        { state: { contains: options.query, mode: 'insensitive' } }
      ]
    };

    if (options.filters) {
      if (options.filters.location) {
        where.OR = [
          { city: { contains: options.filters.location, mode: 'insensitive' } },
          { state: { contains: options.filters.location, mode: 'insensitive' } },
          { country: { contains: options.filters.location, mode: 'insensitive' } }
        ];
      }
      if (options.filters.dateRange) {
        where.createdAt = {
          gte: options.filters.dateRange.start,
          lte: options.filters.dateRange.end
        };
      }
    }

    const orderBy: any = {};
    if (options.sortBy === 'name') {
      orderBy.name = options.sortOrder || 'asc';
    } else if (options.sortBy === 'date') {
      orderBy.createdAt = options.sortOrder || 'desc';
    } else {
      orderBy.name = 'asc';
    }

    const customers = await prisma.customer.findMany({
      where,
      orderBy,
      take: options.limit || 20,
      skip: options.offset || 0
    });

    const results: SearchResult[] = customers.map(customer => ({
      id: customer.id,
      type: 'customer',
      title: customer.name,
      description: customer.email,
      relevance: this.calculateRelevance(customer, options.query),
      metadata: {
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        city: customer.city,
        state: customer.state,
        totalOrders: 0 // Would need to calculate from orders
      },
      highlights: this.generateHighlights(customer, options.query)
    }));

    if (options.sortBy === 'relevance') {
      results.sort((a, b) => b.relevance - a.relevance);
    }

    const analytics = await this.generateSearchAnalytics(organizationId, options);

    return {
      results,
      analytics: {
        ...analytics,
        totalResults: results.length,
        searchTime: Date.now() - startTime
      }
    };
  }

  async searchOrders(organizationId: string, options: SearchOptions): Promise<{ results: SearchResult[]; analytics: SearchAnalytics }> {
    const startTime = Date.now();
    
    const where: any = {
      organizationId,
      OR: [
        { orderNumber: { contains: options.query, mode: 'insensitive' } },
        { customer: { name: { contains: options.query, mode: 'insensitive' } } },
        { customer: { email: { contains: options.query, mode: 'insensitive' } } },
        { shippingAddress: { contains: options.query, mode: 'insensitive' } },
        { billingAddress: { contains: options.query, mode: 'insensitive' } }
      ]
    };

    if (options.filters) {
      if (options.filters.status) {
        where.status = options.filters.status;
      }
      if (options.filters.dateRange) {
        where.createdAt = {
          gte: options.filters.dateRange.start,
          lte: options.filters.dateRange.end
        };
      }
      if (options.filters.priceRange) {
        where.totalAmount = {
          gte: options.filters.priceRange.min,
          lte: options.filters.priceRange.max
        };
      }
    }

    const orderBy: any = {};
    if (options.sortBy === 'date') {
      orderBy.createdAt = options.sortOrder || 'desc';
    } else if (options.sortBy === 'price') {
      orderBy.totalAmount = options.sortOrder || 'desc';
    } else {
      orderBy.createdAt = 'desc';
    }

    const orders = await prisma.order.findMany({
      where,
      include: { customer: true },
      orderBy,
      take: options.limit || 20,
      skip: options.offset || 0
    });

    const results: SearchResult[] = orders.map(order => ({
      id: order.id,
      type: 'order',
      title: `Order #${order.orderNumber}`,
      description: `${order.customer.name} - $${order.totalAmount}`,
      relevance: this.calculateRelevance(order, options.query),
      metadata: {
        orderNumber: order.orderNumber,
        customerName: order.customer.name,
        customerEmail: order.customer.email,
        totalAmount: order.totalAmount,
        status: order.status,
        paymentMethod: order.paymentMethod,
        createdAt: order.createdAt
      },
      highlights: this.generateHighlights(order, options.query)
    }));

    if (options.sortBy === 'relevance') {
      results.sort((a, b) => b.relevance - a.relevance);
    }

    const analytics = await this.generateSearchAnalytics(organizationId, options);

    return {
      results,
      analytics: {
        ...analytics,
        totalResults: results.length,
        searchTime: Date.now() - startTime
      }
    };
  }

  async globalSearch(organizationId: string, options: SearchOptions): Promise<{ results: SearchResult[]; analytics: SearchAnalytics }> {
    const startTime = Date.now();
    
    const [productResults, customerResults, orderResults] = await Promise.all([
      this.searchProducts(organizationId, { ...options, limit: 5 }),
      this.searchCustomers(organizationId, { ...options, limit: 5 }),
      this.searchOrders(organizationId, { ...options, limit: 5 })
    ]);

    const allResults = [
      ...productResults.results,
      ...customerResults.results,
      ...orderResults.results
    ];

    // Sort by relevance
    allResults.sort((a, b) => b.relevance - a.relevance);

    // Apply limit
    const limitedResults = allResults.slice(0, options.limit || 20);

    const analytics = await this.generateSearchAnalytics(organizationId, options);

    return {
      results: limitedResults,
      analytics: {
        ...analytics,
        totalResults: limitedResults.length,
        searchTime: Date.now() - startTime
      }
    };
  }

  async getSearchSuggestions(organizationId: string, query: string): Promise<string[]> {
    const suggestions: string[] = [];

    // Get product suggestions
    const products = await prisma.product.findMany({
      where: {
        organizationId,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { category: { contains: query, mode: 'insensitive' } },
          { brand: { contains: query, mode: 'insensitive' } }
        ]
      },
      select: { name: true, category: true, brand: true },
      take: 5
    });

    products.forEach(product => {
      if (product.name.toLowerCase().includes(query.toLowerCase())) {
        suggestions.push(product.name);
      }
      if (product.category && product.category.toLowerCase().includes(query.toLowerCase())) {
        suggestions.push(product.category);
      }
      if (product.brand && product.brand.toLowerCase().includes(query.toLowerCase())) {
        suggestions.push(product.brand);
      }
    });

    // Get customer suggestions
    const customers = await prisma.customer.findMany({
      where: {
        organizationId,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } }
        ]
      },
      select: { name: true, email: true },
      take: 3
    });

    customers.forEach(customer => {
      if (customer.name.toLowerCase().includes(query.toLowerCase())) {
        suggestions.push(customer.name);
      }
      if (customer.email.toLowerCase().includes(query.toLowerCase())) {
        suggestions.push(customer.email);
      }
    });

    // Remove duplicates and limit
    return [...new Set(suggestions)].slice(0, 10);
  }

  async getPopularSearches(organizationId: string): Promise<string[]> {
    // In a real implementation, you would track search queries
    // For now, return common search terms
    return [
      'electronics',
      'clothing',
      'books',
      'home',
      'sports',
      'beauty',
      'toys',
      'garden'
    ];
  }

  private calculateRelevance(item: any, query: string): number {
    const queryLower = query.toLowerCase();
    let relevance = 0;

    // Exact matches get highest score
    if (item.name && item.name.toLowerCase() === queryLower) {
      relevance += 100;
    }
    if (item.email && item.email.toLowerCase() === queryLower) {
      relevance += 100;
    }

    // Partial matches
    if (item.name && item.name.toLowerCase().includes(queryLower)) {
      relevance += 50;
    }
    if (item.description && item.description.toLowerCase().includes(queryLower)) {
      relevance += 30;
    }
    if (item.email && item.email.toLowerCase().includes(queryLower)) {
      relevance += 40;
    }
    if (item.sku && item.sku.toLowerCase().includes(queryLower)) {
      relevance += 35;
    }

    // Word boundary matches
    const words = queryLower.split(' ');
    words.forEach(word => {
      if (item.name && item.name.toLowerCase().includes(word)) {
        relevance += 20;
      }
      if (item.description && item.description.toLowerCase().includes(word)) {
        relevance += 10;
      }
    });

    return relevance;
  }

  private generateHighlights(item: any, query: string): string[] {
    const highlights: string[] = [];
    const queryLower = query.toLowerCase();

    if (item.name && item.name.toLowerCase().includes(queryLower)) {
      highlights.push(`Name: ${item.name}`);
    }
    if (item.description && item.description.toLowerCase().includes(queryLower)) {
      highlights.push(`Description: ${item.description.substring(0, 100)}...`);
    }
    if (item.email && item.email.toLowerCase().includes(queryLower)) {
      highlights.push(`Email: ${item.email}`);
    }
    if (item.sku && item.sku.toLowerCase().includes(queryLower)) {
      highlights.push(`SKU: ${item.sku}`);
    }

    return highlights;
  }

  private async generateSearchAnalytics(organizationId: string, options: SearchOptions): Promise<SearchAnalytics> {
    // Get facets for products
    const categories = await prisma.product.groupBy({
      by: ['category'],
      where: { organizationId },
      _count: { category: true }
    });

    const brands = await prisma.product.groupBy({
      by: ['brand'],
      where: { organizationId },
      _count: { brand: true }
    });

    const priceRanges = [
      { range: '0-10', count: 0 },
      { range: '10-50', count: 0 },
      { range: '50-100', count: 0 },
      { range: '100+', count: 0 }
    ];

    const products = await prisma.product.findMany({
      where: { organizationId },
      select: { price: true }
    });

    products.forEach(product => {
      if (product.price <= 10) priceRanges[0].count++;
      else if (product.price <= 50) priceRanges[1].count++;
      else if (product.price <= 100) priceRanges[2].count++;
      else priceRanges[3].count++;
    });

    const statuses = await prisma.order.groupBy({
      by: ['status'],
      where: { organizationId },
      _count: { status: true }
    });

    return {
      totalResults: 0,
      searchTime: 0,
      facets: {
        categories: categories.map(c => ({ name: c.category || 'Uncategorized', count: c._count.category })),
        brands: brands.map(b => ({ name: b.brand || 'Unbranded', count: b._count.brand })),
        priceRanges,
        statuses: statuses.map(s => ({ name: s.status, count: s._count.status }))
      }
    };
  }
} 