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
      isActive: options.includeInactive ? undefined : true,
      OR: [
        { name: { contains: options.query, mode: 'insensitive' } },
        { description: { contains: options.query, mode: 'insensitive' } },
        { sku: { contains: options.query, mode: 'insensitive' } }
      ]
    };

    if (options.filters) {
      if (options.filters.category) {
        where.category = { name: { contains: options.filters.category, mode: 'insensitive' } };
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
      if (options.filters.status) {
        where.isActive = options.filters.status === 'active';
      }
    }

    const orderBy: any = {};
    if (options.sortBy === 'name') {
      orderBy.name = options.sortOrder || 'asc';
    } else if (options.sortBy === 'price') {
      orderBy.price = options.sortOrder || 'asc';
    } else if (options.sortBy === 'date') {
      orderBy.createdAt = options.sortOrder || 'desc';
    } else if (options.sortBy === 'popularity') {
      orderBy.sortOrder = options.sortOrder || 'desc';
    } else {
      orderBy.name = 'asc';
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        category: true
      },
      orderBy,
      take: options.limit || 20,
      skip: options.offset || 0
    });

    const results: SearchResult[] = products.map((product: any) => ({
      id: product.id,
      type: 'product',
      title: product.name,
      description: product.description || undefined,
      relevance: this.calculateRelevance(product, options.query),
      metadata: {
        price: product.price,
        sku: product.sku,
        category: product.category?.name || 'Uncategorized',
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
        { address: { contains: options.query, mode: 'insensitive' } }
      ]
    };

    if (options.filters) {
      if (options.filters.location) {
        where.address = { contains: options.filters.location, mode: 'insensitive' };
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

    const results: SearchResult[] = customers.map((customer: any) => ({
      id: customer.id,
      type: 'customer',
      title: customer.name || 'Unknown Customer',
      description: customer.email || customer.phone || 'No contact info',
      relevance: this.calculateRelevance(customer, options.query),
      metadata: {
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        totalSpent: customer.totalSpent,
        points: customer.points
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

    const results: SearchResult[] = orders.map((order: any) => ({
      id: order.id,
      type: 'order',
      title: `Order #${order.orderNumber}`,
      description: `Total: $${order.totalAmount} - Status: ${order.status}`,
      relevance: this.calculateRelevance(order, options.query),
      metadata: {
        orderNumber: order.orderNumber,
        status: order.status,
        totalAmount: order.totalAmount,
        customerName: order.customer?.name || 'Unknown Customer'
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
      this.searchProducts(organizationId, options),
      this.searchCustomers(organizationId, options),
      this.searchOrders(organizationId, options)
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
        totalResults: allResults.length,
        searchTime: Date.now() - startTime
      }
    };
  }

  async getSearchSuggestions(organizationId: string, query: string): Promise<string[]> {
    if (query.length < 2) return [];

    const suggestions: string[] = [];

    // Get product name suggestions
    const productNames = await prisma.product.findMany({
      where: {
        organizationId,
        name: { contains: query, mode: 'insensitive' }
      },
      select: { name: true },
      take: 5
    });
    suggestions.push(...productNames.map(p => p.name));

    // Get customer name suggestions
    const customerNames = await prisma.customer.findMany({
      where: {
        organizationId,
        name: { contains: query, mode: 'insensitive' }
      },
      select: { name: true },
      take: 5
    });
    suggestions.push(...customerNames.filter(c => c.name).map(c => c.name!));

    // Get category suggestions
    const categories = await prisma.category.findMany({
      where: {
        organizationId,
        name: { contains: query, mode: 'insensitive' }
      },
      select: { name: true },
      take: 5
    });
    suggestions.push(...categories.map(c => c.name));

    // Remove duplicates and limit results
    const uniqueSuggestions = Array.from(new Set(suggestions));
    return uniqueSuggestions.slice(0, 10);
  }

  async getPopularSearches(organizationId: string): Promise<string[]> {
    const popularSearches = await prisma.searchHistory.groupBy({
      by: ['query'],
      where: {
        user: {
          organizationId
        }
      },
      _count: {
        query: true
      },
      orderBy: {
        _count: {
          query: 'desc'
        }
      },
      take: 10
    });

    return popularSearches.map(item => item.query);
  }

  private calculateRelevance(item: any, query: string): number {
    let relevance = 0;
    const queryLower = query.toLowerCase();

    // Check title/name
    if (item.name && item.name.toLowerCase().includes(queryLower)) {
      relevance += 10;
    }

    // Check description
    if (item.description && item.description.toLowerCase().includes(queryLower)) {
      relevance += 5;
    }

    // Check SKU (exact match gets high relevance)
    if (item.sku && item.sku.toLowerCase() === queryLower) {
      relevance += 15;
    } else if (item.sku && item.sku.toLowerCase().includes(queryLower)) {
      relevance += 8;
    }

    // Check tags
    if (item.tags && Array.isArray(item.tags)) {
      item.tags.forEach((tag: any) => {
        if (tag.toLowerCase().includes(queryLower)) {
          relevance += 3;
        }
      });
    }

    // Check category
    if (item.category && item.category.name && item.category.name.toLowerCase().includes(queryLower)) {
      relevance += 4;
    }

    return relevance;
  }

  private generateHighlights(item: any, query: string): string[] {
    const highlights: string[] = [];
    const queryLower = query.toLowerCase();

    if (item.name && item.name.toLowerCase().includes(queryLower)) {
      highlights.push(item.name);
    }

    if (item.description && item.description.toLowerCase().includes(queryLower)) {
      highlights.push(item.description);
    }

    if (item.sku && item.sku.toLowerCase().includes(queryLower)) {
      highlights.push(item.sku);
    }

    return highlights;
  }

  private async generateSearchAnalytics(organizationId: string, options: SearchOptions): Promise<SearchAnalytics> {
    // Get facets for products
    const categories = await prisma.product.groupBy({
      by: ['categoryId'],
      where: { organizationId },
      _count: { categoryId: true }
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
        categories: categories.map(c => ({ name: c.categoryId || 'Uncategorized', count: c._count.categoryId })),
        brands: [], // No brand field in Product model
        priceRanges,
        statuses: statuses.map(s => ({ name: s.status, count: s._count.status }))
      }
    };
  }

  private aggregateFacets(results: SearchResult[], field: string): Array<{ name: string; count: number }> {
    const facetCounts = new Map<string, number>();
    
    results.forEach((result: any) => {
      const value = result.metadata[field];
      if (value) {
        facetCounts.set(value, (facetCounts.get(value) || 0) + 1);
      }
    });

    return Array.from(facetCounts.entries()).map(([name, count]) => ({ name, count }));
  }

  private aggregatePriceRanges(results: SearchResult[]): Array<{ range: string; count: number }> {
    const ranges = [
      { min: 0, max: 10, label: '$0 - $10' },
      { min: 10, max: 25, label: '$10 - $25' },
      { min: 25, max: 50, label: '$25 - $50' },
      { min: 50, max: 100, label: '$50 - $100' },
      { min: 100, max: Infinity, label: '$100+' }
    ];

    const rangeCounts = new Map<string, number>();
    ranges.forEach(range => rangeCounts.set(range.label, 0));

    results.forEach((result: any) => {
      const price = result.metadata.price;
      if (typeof price === 'number') {
        const range = ranges.find(r => price >= r.min && price < r.max);
        if (range) {
          rangeCounts.set(range.label, (rangeCounts.get(range.label) || 0) + 1);
        }
      }
    });

    return Array.from(rangeCounts.entries()).map(([range, count]) => ({ range, count }));
  }
} 