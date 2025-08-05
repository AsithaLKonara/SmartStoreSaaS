import { prisma } from '@/lib/prisma';

export interface SocialPlatform {
  id: string;
  name: 'facebook' | 'instagram' | 'tiktok' | 'pinterest' | 'twitter';
  isActive: boolean;
  config: any;
  lastSync: Date;
  productCount: number;
}

export interface SocialProduct {
  id: string;
  productId: string;
  platformId: string;
  platformProductId: string;
  status: 'active' | 'inactive' | 'syncing' | 'error';
  metadata: any;
  lastSync: Date;
}

export interface SocialPost {
  id: string;
  platformId: string;
  type: 'product' | 'story' | 'reel' | 'post';
  content: string;
  mediaUrls: string[];
  productIds: string[];
  scheduledAt?: Date;
  publishedAt?: Date;
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  engagement: {
    likes: number;
    comments: number;
    shares: number;
    clicks: number;
  };
}

export interface SocialAnalytics {
  totalFollowers: number;
  totalPosts: number;
  totalEngagement: number;
  totalSales: number;
  platformBreakdown: Record<string, {
    followers: number;
    posts: number;
    engagement: number;
    sales: number;
  }>;
  topProducts: Array<{
    productId: string;
    name: string;
    sales: number;
    engagement: number;
  }>;
}

export class SocialCommerceService {
  async getSocialPlatforms(organizationId: string): Promise<SocialPlatform[]> {
    const platforms = await prisma.socialPlatform.findMany({
      where: { organizationId },
      include: {
        _count: {
          select: { socialProducts: true }
        }
      }
    });

    return platforms.map(platform => ({
      id: platform.id,
      name: platform.name,
      isActive: platform.isActive,
      config: platform.config,
      lastSync: platform.lastSync,
      productCount: platform._count.socialProducts
    }));
  }

  async connectPlatform(organizationId: string, platform: string, config: any): Promise<SocialPlatform> {
    const socialPlatform = await prisma.socialPlatform.upsert({
      where: {
        organizationId_name: { organizationId, name: platform }
      },
      update: {
        config,
        isActive: true,
        lastSync: new Date()
      },
      create: {
        organizationId,
        name: platform,
        config,
        isActive: true,
        lastSync: new Date()
      }
    });

    return {
      id: socialPlatform.id,
      name: socialPlatform.name,
      isActive: socialPlatform.isActive,
      config: socialPlatform.config,
      lastSync: socialPlatform.lastSync,
      productCount: 0
    };
  }

  async syncProductsToPlatform(platformId: string, productIds: string[]): Promise<SocialProduct[]> {
    const platform = await prisma.socialPlatform.findUnique({
      where: { id: platformId }
    });

    if (!platform || !platform.isActive) {
      throw new Error('Platform not found or inactive');
    }

    const products = await prisma.product.findMany({
      where: { id: { in: productIds } }
    });

    const socialProducts: SocialProduct[] = [];

    for (const product of products) {
      try {
        // Sync product to social platform
        const platformProductId = await this.syncProductToPlatform(platform, product);

        const socialProduct = await prisma.socialProduct.upsert({
          where: {
            productId_platformId: { productId: product.id, platformId }
          },
          update: {
            platformProductId,
            status: 'active',
            lastSync: new Date(),
            metadata: { syncedAt: new Date() }
          },
          create: {
            productId: product.id,
            platformId,
            platformProductId,
            status: 'active',
            lastSync: new Date(),
            metadata: { syncedAt: new Date() }
          }
        });

        socialProducts.push(socialProduct);
      } catch (error) {
        console.error(`Failed to sync product ${product.id} to ${platform.name}:`, error);
        
        await prisma.socialProduct.upsert({
          where: {
            productId_platformId: { productId: product.id, platformId }
          },
          update: {
            status: 'error',
            lastSync: new Date(),
            metadata: { error: error.message }
          },
          create: {
            productId: product.id,
            platformId,
            platformProductId: '',
            status: 'error',
            lastSync: new Date(),
            metadata: { error: error.message }
          }
        });
      }
    }

    // Update platform last sync
    await prisma.socialPlatform.update({
      where: { id: platformId },
      data: { lastSync: new Date() }
    });

    return socialProducts;
  }

  async createSocialPost(platformId: string, postData: {
    type: string;
    content: string;
    mediaUrls: string[];
    productIds: string[];
    scheduledAt?: Date;
  }): Promise<SocialPost> {
    const post = await prisma.socialPost.create({
      data: {
        platformId,
        type: postData.type,
        content: postData.content,
        mediaUrls: postData.mediaUrls,
        productIds: postData.productIds,
        scheduledAt: postData.scheduledAt,
        status: postData.scheduledAt ? 'scheduled' : 'draft',
        engagement: {
          likes: 0,
          comments: 0,
          shares: 0,
          clicks: 0
        }
      }
    });

    return post;
  }

  async publishPost(postId: string): Promise<SocialPost> {
    const post = await prisma.socialPost.findUnique({
      where: { id: postId },
      include: { platform: true }
    });

    if (!post) {
      throw new Error('Post not found');
    }

    try {
      // Publish to social platform
      const platformPostId = await this.publishToPlatform(post.platform, post);

      const updatedPost = await prisma.socialPost.update({
        where: { id: postId },
        data: {
          status: 'published',
          publishedAt: new Date(),
          metadata: { platformPostId }
        }
      });

      return updatedPost;
    } catch (error) {
      await prisma.socialPost.update({
        where: { id: postId },
        data: {
          status: 'failed',
          metadata: { error: error.message }
        }
      });

      throw error;
    }
  }

  async getSocialAnalytics(organizationId: string, startDate: Date, endDate: Date): Promise<SocialAnalytics> {
    const platforms = await prisma.socialPlatform.findMany({
      where: { organizationId },
      include: {
        socialPosts: {
          where: {
            publishedAt: {
              gte: startDate,
              lte: endDate
            }
          }
        },
        socialProducts: {
          include: {
            product: true
          }
        }
      }
    });

    let totalFollowers = 0;
    let totalPosts = 0;
    let totalEngagement = 0;
    let totalSales = 0;

    const platformBreakdown: Record<string, any> = {};
    const productSales: Record<string, { name: string; sales: number; engagement: number }> = {};

    for (const platform of platforms) {
      const posts = platform.socialPosts;
      const engagement = posts.reduce((sum, post) => 
        sum + post.engagement.likes + post.engagement.comments + post.engagement.shares, 0
      );

      platformBreakdown[platform.name] = {
        followers: platform.config?.followers || 0,
        posts: posts.length,
        engagement,
        sales: 0 // Calculate from orders
      };

      totalFollowers += platform.config?.followers || 0;
      totalPosts += posts.length;
      totalEngagement += engagement;

      // Calculate product sales from social posts
      for (const post of posts) {
        for (const productId of post.productIds) {
          if (!productSales[productId]) {
            const product = platform.socialProducts.find(sp => sp.productId === productId)?.product;
            productSales[productId] = {
              name: product?.name || 'Unknown Product',
              sales: 0,
              engagement: 0
            };
          }
          productSales[productId].engagement += post.engagement.clicks;
        }
      }
    }

    // Get top products by engagement
    const topProducts = Object.entries(productSales)
      .map(([productId, data]) => ({
        productId,
        name: data.name,
        sales: data.sales,
        engagement: data.engagement
      }))
      .sort((a, b) => b.engagement - a.engagement)
      .slice(0, 10);

    return {
      totalFollowers,
      totalPosts,
      totalEngagement,
      totalSales,
      platformBreakdown,
      topProducts
    };
  }

  async updatePostEngagement(postId: string, engagement: any): Promise<void> {
    await prisma.socialPost.update({
      where: { id: postId },
      data: { engagement }
    });
  }

  async getScheduledPosts(platformId?: string): Promise<SocialPost[]> {
    const where: any = {
      status: 'scheduled',
      scheduledAt: { gte: new Date() }
    };

    if (platformId) {
      where.platformId = platformId;
    }

    return await prisma.socialPost.findMany({
      where,
      include: { platform: true },
      orderBy: { scheduledAt: 'asc' }
    });
  }

  async deleteSocialPost(postId: string): Promise<void> {
    const post = await prisma.socialPost.findUnique({
      where: { id: postId },
      include: { platform: true }
    });

    if (post && post.status === 'published' && post.metadata?.platformPostId) {
      // Delete from social platform
      await this.deleteFromPlatform(post.platform, post.metadata.platformPostId);
    }

    await prisma.socialPost.delete({
      where: { id: postId }
    });
  }

  async syncInventory(platformId: string): Promise<void> {
    const platform = await prisma.socialPlatform.findUnique({
      where: { id: platformId }
    });

    if (!platform) return;

    const socialProducts = await prisma.socialProduct.findMany({
      where: { platformId, status: 'active' },
      include: { product: true }
    });

    for (const socialProduct of socialProducts) {
      try {
        // Update inventory on social platform
        await this.updateInventoryOnPlatform(platform, socialProduct);
        
        await prisma.socialProduct.update({
          where: { id: socialProduct.id },
          data: { lastSync: new Date() }
        });
      } catch (error) {
        console.error(`Failed to sync inventory for product ${socialProduct.productId}:`, error);
      }
    }
  }

  // Platform-specific implementations
  private async syncProductToPlatform(platform: any, product: any): Promise<string> {
    switch (platform.name) {
      case 'facebook':
        return await this.syncToFacebook(platform, product);
      case 'instagram':
        return await this.syncToInstagram(platform, product);
      case 'tiktok':
        return await this.syncToTikTok(platform, product);
      case 'pinterest':
        return await this.syncToPinterest(platform, product);
      default:
        throw new Error(`Unsupported platform: ${platform.name}`);
    }
  }

  private async publishToPlatform(platform: any, post: any): Promise<string> {
    switch (platform.name) {
      case 'facebook':
        return await this.publishToFacebook(platform, post);
      case 'instagram':
        return await this.publishToInstagram(platform, post);
      case 'tiktok':
        return await this.publishToTikTok(platform, post);
      case 'pinterest':
        return await this.publishToPinterest(platform, post);
      default:
        throw new Error(`Unsupported platform: ${platform.name}`);
    }
  }

  private async deleteFromPlatform(platform: any, platformPostId: string): Promise<void> {
    switch (platform.name) {
      case 'facebook':
        await this.deleteFromFacebook(platform, platformPostId);
        break;
      case 'instagram':
        await this.deleteFromInstagram(platform, platformPostId);
        break;
      case 'tiktok':
        await this.deleteFromTikTok(platform, platformPostId);
        break;
      case 'pinterest':
        await this.deleteFromPinterest(platform, platformPostId);
        break;
    }
  }

  private async updateInventoryOnPlatform(platform: any, socialProduct: any): Promise<void> {
    switch (platform.name) {
      case 'facebook':
        await this.updateInventoryOnFacebook(platform, socialProduct);
        break;
      case 'instagram':
        await this.updateInventoryOnInstagram(platform, socialProduct);
        break;
      case 'tiktok':
        await this.updateInventoryOnTikTok(platform, socialProduct);
        break;
      case 'pinterest':
        await this.updateInventoryOnPinterest(platform, socialProduct);
        break;
    }
  }

  // Facebook implementations
  private async syncToFacebook(platform: any, product: any): Promise<string> {
    // Facebook Catalog API implementation
    return `fb_product_${Date.now()}`;
  }

  private async publishToFacebook(platform: any, post: any): Promise<string> {
    // Facebook Graph API implementation
    return `fb_post_${Date.now()}`;
  }

  private async deleteFromFacebook(platform: any, platformPostId: string): Promise<void> {
    // Facebook Graph API delete implementation
  }

  private async updateInventoryOnFacebook(platform: any, socialProduct: any): Promise<void> {
    // Facebook Catalog API inventory update
  }

  // Instagram implementations
  private async syncToInstagram(platform: any, product: any): Promise<string> {
    // Instagram Basic Display API implementation
    return `ig_product_${Date.now()}`;
  }

  private async publishToInstagram(platform: any, post: any): Promise<string> {
    // Instagram Basic Display API implementation
    return `ig_post_${Date.now()}`;
  }

  private async deleteFromInstagram(platform: any, platformPostId: string): Promise<void> {
    // Instagram Basic Display API delete implementation
  }

  private async updateInventoryOnInstagram(platform: any, socialProduct: any): Promise<void> {
    // Instagram Basic Display API inventory update
  }

  // TikTok implementations
  private async syncToTikTok(platform: any, product: any): Promise<string> {
    // TikTok Shop API implementation
    return `tt_product_${Date.now()}`;
  }

  private async publishToTikTok(platform: any, post: any): Promise<string> {
    // TikTok API implementation
    return `tt_post_${Date.now()}`;
  }

  private async deleteFromTikTok(platform: any, platformPostId: string): Promise<void> {
    // TikTok API delete implementation
  }

  private async updateInventoryOnTikTok(platform: any, socialProduct: any): Promise<void> {
    // TikTok Shop API inventory update
  }

  // Pinterest implementations
  private async syncToPinterest(platform: any, product: any): Promise<string> {
    // Pinterest API implementation
    return `pin_product_${Date.now()}`;
  }

  private async publishToPinterest(platform: any, post: any): Promise<string> {
    // Pinterest API implementation
    return `pin_post_${Date.now()}`;
  }

  private async deleteFromPinterest(platform: any, platformPostId: string): Promise<void> {
    // Pinterest API delete implementation
  }

  private async updateInventoryOnPinterest(platform: any, socialProduct: any): Promise<void> {
    // Pinterest API inventory update
  }
} 