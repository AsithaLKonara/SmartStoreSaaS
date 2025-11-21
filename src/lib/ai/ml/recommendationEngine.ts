import { prisma } from '@/lib/prisma';

export interface RecommendationConfig {
  userId?: string;
  productId?: string;
  limit?: number;
  algorithm?: 'collaborative' | 'content_based' | 'hybrid';
}

export interface Recommendation {
  productId: string;
  productName: string;
  score: number;
  reason: string;
}

export class RecommendationEngine {
  async getRecommendations(
    organizationId: string,
    config: RecommendationConfig = {}
  ): Promise<Recommendation[]> {
    const {
      userId,
      productId,
      limit = 10,
      algorithm = 'hybrid',
    } = config;

    switch (algorithm) {
      case 'collaborative':
        return await this.getCollaborativeRecommendations(organizationId, userId, limit);
      case 'content_based':
        return await this.getContentBasedRecommendations(organizationId, productId, limit);
      case 'hybrid':
        return await this.getHybridRecommendations(organizationId, userId, productId, limit);
      default:
        throw new Error(`Unsupported algorithm: ${algorithm}`);
    }
  }

  private async getCollaborativeRecommendations(
    organizationId: string,
    userId: string | undefined,
    limit: number
  ): Promise<Recommendation[]> {
    if (!userId) {
      return [];
    }

    // Get user's order history
    const userOrders = await prisma.order.findMany({
      where: {
        organizationId,
        customer: {
          id: userId,
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    // Get products user has purchased
    const purchasedProductIds = new Set(
      userOrders.flatMap(order => order.items.map(item => item.product.id))
    );

    // Find similar users (users who bought similar products)
    const similarUsers = await this.findSimilarUsers(organizationId, userId, purchasedProductIds);

    // Get products from similar users
    const recommendations = await this.getProductsFromSimilarUsers(
      organizationId,
      similarUsers,
      purchasedProductIds,
      limit
    );

    return recommendations;
  }

  private async getContentBasedRecommendations(
    organizationId: string,
    productId: string | undefined,
    limit: number
  ): Promise<Recommendation[]> {
    if (!productId) {
      return [];
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: true,
      },
    });

    if (!product) {
      return [];
    }

    // Find similar products based on category, tags, description
    const similarProducts = await prisma.product.findMany({
      where: {
        organizationId: product.organizationId,
        id: { not: productId },
        categoryId: product.categoryId || undefined,
        isActive: true,
      },
      take: limit * 2,
    });

    // Score products based on similarity
    const scored = similarProducts.map(p => ({
      productId: p.id,
      productName: p.name,
      score: this.calculateContentSimilarity(product, p),
      reason: `Similar to ${product.name}`,
    }));

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(r => ({
        productId: r.productId,
        productName: r.productName,
        score: r.score,
        reason: r.reason,
      }));
  }

  private async getHybridRecommendations(
    organizationId: string,
    userId: string | undefined,
    productId: string | undefined,
    limit: number
  ): Promise<Recommendation[]> {
    const collaborative = userId
      ? await this.getCollaborativeRecommendations(organizationId, userId, limit)
      : [];
    const contentBased = productId
      ? await this.getContentBasedRecommendations(organizationId, productId, limit)
      : [];

    // Merge and deduplicate
    const combined = new Map<string, Recommendation>();

    collaborative.forEach(rec => {
      combined.set(rec.productId, rec);
    });

    contentBased.forEach(rec => {
      const existing = combined.get(rec.productId);
      if (existing) {
        existing.score = (existing.score + rec.score) / 2;
        existing.reason = 'Hybrid recommendation';
      } else {
        combined.set(rec.productId, rec);
      }
    });

    return Array.from(combined.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  private async findSimilarUsers(
    organizationId: string,
    userId: string,
    purchasedProductIds: Set<string>
  ): Promise<string[]> {
    // Find users who purchased similar products
    const orders = await prisma.order.findMany({
      where: {
        organizationId,
        customerId: { not: userId },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    const userSimilarity = new Map<string, number>();

    orders.forEach(order => {
      const userProductIds = new Set(
        order.items.map(item => item.product.id)
      );
      
      // Calculate Jaccard similarity
      const intersection = Array.from(purchasedProductIds).filter(id =>
        userProductIds.has(id)
      ).length;
      const union = purchasedProductIds.size + userProductIds.size - intersection;
      
      if (union > 0) {
        const similarity = intersection / union;
        if (similarity > 0.3) {
          userSimilarity.set(order.customerId, similarity);
        }
      }
    });

    return Array.from(userSimilarity.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([userId]) => userId);
  }

  private async getProductsFromSimilarUsers(
    organizationId: string,
    similarUserIds: string[],
    excludeProductIds: Set<string>,
    limit: number
  ): Promise<Recommendation[]> {
    const orders = await prisma.order.findMany({
      where: {
        organizationId,
        customerId: { in: similarUserIds },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    const productScores = new Map<string, { count: number; productName: string }>();

    orders.forEach(order => {
      order.items.forEach(item => {
        if (!excludeProductIds.has(item.product.id)) {
          const existing = productScores.get(item.product.id);
          if (existing) {
            existing.count++;
          } else {
            productScores.set(item.product.id, {
              count: 1,
              productName: item.product.name,
            });
          }
        }
      });
    });

    return Array.from(productScores.entries())
      .map(([productId, data]) => ({
        productId,
        productName: data.productName,
        score: data.count / similarUserIds.length,
        reason: 'Customers who bought similar items also bought this',
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  private calculateContentSimilarity(product1: any, product2: any): number {
    let similarity = 0;

    // Category match
    if (product1.categoryId === product2.categoryId) {
      similarity += 0.4;
    }

    // Price similarity (normalized)
    const priceDiff = Math.abs(product1.price - product2.price);
    const maxPrice = Math.max(product1.price, product2.price);
    if (maxPrice > 0) {
      similarity += 0.3 * (1 - priceDiff / maxPrice);
    }

    // Description similarity (simplified)
    if (product1.description && product2.description) {
      const words1 = product1.description.toLowerCase().split(/\s+/);
      const words2 = product2.description.toLowerCase().split(/\s+/);
      const commonWords = words1.filter(w => words2.includes(w));
      similarity += 0.3 * (commonWords.length / Math.max(words1.length, words2.length));
    }

    return Math.min(similarity, 1.0);
  }
}

