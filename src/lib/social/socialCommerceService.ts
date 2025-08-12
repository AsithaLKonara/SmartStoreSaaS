import { prisma } from '../prisma';

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
      name: platform.name as 'facebook' | 'instagram' | 'tiktok' | 'pinterest' | 'twitter',
      isActive: platform.isActive,
      config: platform.config,
      lastSync: platform.lastSync,
      productCount: platform._count.socialProducts
    }));
  }

  async connectPlatform(organizationId: string, platform: string, config: any): Promise<SocialPlatform> {
    const socialPlatform = await prisma.socialPlatform.upsert({
      where: {
        organizationId_name: { organizationId, name: platform as any }
      },
      update: {
        config,
        isActive: true,
        lastSync: new Date()
      },
      create: {
        organizationId,
        name: platform as any,
        config,
        isActive: true,
        lastSync: new Date()
      }
    });

    return {
      id: socialPlatform.id,
      name: socialPlatform.name as 'facebook' | 'instagram' | 'tiktok' | 'pinterest' | 'twitter',
      isActive: socialPlatform.isActive,
      config: socialPlatform.config,
      lastSync: socialPlatform.lastSync,
      productCount: 0
    };
  }

  async syncProductsToPlatform(platformId: string, productIds: string[]): Promise<SocialProduct[]> {
    try {
      const platform = await prisma.socialPlatform.findUnique({
        where: { id: platformId }
      });

      if (!platform) {
        throw new Error('Platform not found');
      }

      const products = await prisma.product.findMany({
        where: { id: { in: productIds } }
      });

      const socialProducts: SocialProduct[] = [];

      for (const product of products) {
        try {
          const platformProductId = await this.syncProductToPlatform(platform, product);
          
          const socialProduct = await prisma.socialProduct.upsert({
            where: {
              productId_platformId: { productId: product.id, platformId }
            },
            update: {
              status: 'active',
              lastSync: new Date(),
              metadata: { lastSync: new Date() }
            },
            create: {
              platformId,
              productId: product.id,
              platformProductId,
              status: 'active',
              lastSync: new Date(),
              metadata: { lastSync: new Date() }
            }
          });

          socialProducts.push({
            id: socialProduct.id,
            productId: socialProduct.productId,
            platformId: socialProduct.platformId,
            platformProductId: socialProduct.platformProductId,
            status: socialProduct.status as 'active' | 'inactive' | 'syncing' | 'error',
            metadata: socialProduct.metadata,
            lastSync: socialProduct.lastSync
          });
        } catch (error) {
          console.error(`Failed to sync product ${product.id} to platform:`, error);
          
          // Update social product with error status
          await prisma.socialProduct.upsert({
            where: {
              productId_platformId: { productId: product.id, platformId }
            },
            update: {
              status: 'error',
              metadata: { error: (error as Error).message }
            },
            create: {
              platformId,
              productId: product.id,
              platformProductId: 'error',
              status: 'error',
              lastSync: new Date(),
              metadata: { error: (error as Error).message }
            }
          });
        }
      }

      return socialProducts;
    } catch (error) {
      throw new Error(`Failed to sync products to platform: ${error}`);
    }
  }

  async createSocialPost(platformId: string, postData: {
    type: string;
    content: string;
    mediaUrls: string[];
    productIds: string[];
    scheduledAt?: Date;
  }): Promise<SocialPost> {
    try {
      const post = await prisma.socialPost.create({
        data: {
          platformId,
          type: postData.type as any,
          content: postData.content,
          mediaUrls: postData.mediaUrls,
          productIds: postData.productIds,
          scheduledAt: postData.scheduledAt,
          status: 'draft',
          engagement: { likes: 0, comments: 0, shares: 0, clicks: 0 }
        }
      });

      return {
        id: post.id,
        platformId: post.platformId,
        type: post.type as 'product' | 'story' | 'reel' | 'post',
        content: post.content,
        mediaUrls: post.mediaUrls,
        productIds: post.productIds,
        scheduledAt: post.scheduledAt || undefined,
        publishedAt: post.publishedAt || undefined,
        status: post.status as 'draft' | 'scheduled' | 'published' | 'failed',
        engagement: post.engagement as any
      };
    } catch (error) {
      throw new Error(`Failed to create social post: ${error}`);
    }
  }

  async publishPost(postId: string): Promise<SocialPost> {
    try {
      const post = await prisma.socialPost.findUnique({
        where: { id: postId }
      });

      if (!post) {
        throw new Error('Post not found');
      }

      const platform = await prisma.socialPlatform.findUnique({
        where: { id: post.platformId }
      });

      if (!platform) {
        throw new Error('Platform not found');
      }

      try {
        const platformPostId = await this.publishToPlatform(platform, post);
        
        const updatedPost = await prisma.socialPost.update({
          where: { id: postId },
          data: {
            status: 'published',
            publishedAt: new Date(),
            metadata: { platformPostId }
          }
        });

        return {
          id: updatedPost.id,
          platformId: updatedPost.platformId,
          type: updatedPost.type as 'product' | 'story' | 'reel' | 'post',
          content: updatedPost.content,
          mediaUrls: updatedPost.mediaUrls,
          productIds: updatedPost.productIds,
          scheduledAt: updatedPost.scheduledAt || undefined,
          publishedAt: updatedPost.publishedAt || undefined,
          status: updatedPost.status as 'draft' | 'scheduled' | 'published' | 'failed',
          engagement: updatedPost.engagement as any
        };
      } catch (error) {
        // Update post with error status
        await prisma.socialPost.update({
          where: { id: postId },
          data: {
            status: 'failed',
            metadata: { error: (error as Error).message }
          }
        });
        throw error;
      }
    } catch (error) {
      throw new Error(`Failed to publish post: ${error}`);
    }
  }

  async getSocialAnalytics(organizationId: string, startDate: Date, endDate: Date): Promise<SocialAnalytics> {
    try {
      const platforms = await prisma.socialPlatform.findMany({
        where: { organizationId }
      });

      const posts = await prisma.socialPost.findMany({
        where: {
          platform: { organizationId },
          createdAt: { gte: startDate, lte: endDate }
        }
      });

      // Calculate total engagement
      const totalEngagement = posts.reduce((sum, post) => {
        if (post.engagement && typeof post.engagement === 'object') {
          const engagement = post.engagement as any;
          return sum + (engagement.likes || 0) + (engagement.comments || 0) + (engagement.shares || 0);
        }
        return sum;
      }, 0);

      // Calculate platform breakdown
      const platformBreakdown: Record<string, any> = {};
      let totalFollowers = 0;

      for (const platform of platforms) {
        const platformPosts = posts.filter(post => post.platformId === platform.id);
        const platformEngagement = platformPosts.reduce((sum, post) => {
          if (post.engagement && typeof post.engagement === 'object') {
            const engagement = post.engagement as any;
            return sum + (engagement.likes || 0) + (engagement.comments || 0) + (engagement.shares || 0);
          }
          return sum;
        }, 0);

        const followers = (platform.config as any)?.followers || 0;
        totalFollowers += followers;

        platformBreakdown[platform.name] = {
          followers,
          posts: platformPosts.length,
          engagement: platformEngagement,
          sales: 0 // This would need to be calculated from actual sales data
        };
      }

      // Calculate top products
      const productSales: Record<string, { sales: number; engagement: number }> = {};
      
      for (const post of posts) {
        for (const productId of post.productIds) {
          if (!productSales[productId]) {
            productSales[productId] = { sales: 0, engagement: 0 };
          }
          
          if (post.engagement && typeof post.engagement === 'object') {
            const engagement = post.engagement as any;
            productSales[productId].engagement += engagement.clicks || 0;
          }
        }
      }

      const topProducts = Object.entries(productSales)
        .map(([productId, data]) => ({
          productId,
          name: `Product ${productId}`, // This should be fetched from actual product data
          sales: data.sales,
          engagement: data.engagement
        }))
        .sort((a, b) => b.engagement - a.engagement)
        .slice(0, 10);

      return {
        totalFollowers,
        totalPosts: posts.length,
        totalEngagement,
        totalSales: 0, // This would need to be calculated from actual sales data
        platformBreakdown,
        topProducts
      };
    } catch (error) {
      throw new Error(`Failed to get social analytics: ${error}`);
    }
  }

  async updatePostEngagement(postId: string, engagement: any): Promise<void> {
    try {
      await prisma.socialPost.update({
        where: { id: postId },
        data: { engagement }
      });
    } catch (error) {
      throw new Error(`Failed to update post engagement: ${error}`);
    }
  }

  async getScheduledPosts(platformId?: string): Promise<SocialPost[]> {
    try {
      const whereClause: any = {
        status: 'scheduled',
        scheduledAt: { gte: new Date() }
      };

      if (platformId) {
        whereClause.platformId = platformId;
      }

      const posts = await prisma.socialPost.findMany({
        where: whereClause,
        include: { platform: true }
      });

      return posts.map(post => ({
        id: post.id,
        platformId: post.platformId,
        type: post.type as 'product' | 'story' | 'reel' | 'post',
        content: post.content,
        mediaUrls: post.mediaUrls,
        productIds: post.productIds,
        scheduledAt: post.scheduledAt || undefined,
        publishedAt: post.publishedAt || undefined,
        status: post.status as 'draft' | 'scheduled' | 'published' | 'failed',
        engagement: post.engagement as any
      }));
    } catch (error) {
      throw new Error(`Failed to get scheduled posts: ${error}`);
    }
  }

  async deleteSocialPost(postId: string): Promise<void> {
    try {
      const post = await prisma.socialPost.findUnique({
        where: { id: postId }
      });

      if (post && post.status === 'published' && (post.metadata as any)?.platformPostId) {
        const platform = await prisma.socialPlatform.findUnique({
          where: { id: post.platformId }
        });

        if (platform) {
          await this.deleteFromPlatform(platform, (post.metadata as any).platformPostId);
        }
      }

      await prisma.socialPost.delete({
        where: { id: postId }
      });
    } catch (error) {
      throw new Error(`Failed to delete social post: ${error}`);
    }
  }

  async syncInventory(platformId: string): Promise<void> {
    try {
      const platform = await prisma.socialPlatform.findUnique({
        where: { id: platformId }
      });

      if (!platform) {
        throw new Error('Platform not found');
      }

      const socialProducts = await prisma.socialProduct.findMany({
        where: { platformId, status: 'active' }
      });

      for (const socialProduct of socialProducts) {
        try {
          await this.updateInventoryOnPlatform(platform, socialProduct);
          
          await prisma.socialProduct.update({
            where: { id: socialProduct.id },
            data: { lastSync: new Date() }
          });
        } catch (error) {
          console.error(`Failed to sync inventory for product ${socialProduct.productId}:`, error);
          
          await prisma.socialProduct.update({
            where: { id: socialProduct.id },
            data: {
              status: 'error',
              metadata: { error: (error as Error).message }
            }
          });
        }
      }
    } catch (error) {
      throw new Error(`Failed to sync inventory: ${error}`);
    }
  }

  private async syncProductToPlatform(platform: any, product: any): Promise<string> {
    switch (platform.name) {
      case 'facebook':
        return this.syncToFacebook(platform, product);
      case 'instagram':
        return this.syncToInstagram(platform, product);
      case 'tiktok':
        return this.syncToTikTok(platform, product);
      case 'pinterest':
        return this.syncToPinterest(platform, product);
      case 'twitter':
        return this.syncToTwitter(platform, product);
      default:
        throw new Error(`Unsupported platform: ${platform.name}`);
    }
  }

  private async publishToPlatform(platform: any, post: any): Promise<string> {
    switch (platform.name) {
      case 'facebook':
        return this.publishToFacebook(platform, post);
      case 'instagram':
        return this.publishToInstagram(platform, post);
      case 'tiktok':
        return this.publishToTikTok(platform, post);
      case 'pinterest':
        return this.publishToPinterest(platform, post);
      case 'twitter':
        return this.publishToTwitter(platform, post);
      default:
        throw new Error(`Unsupported platform: ${platform.name}`);
    }
  }

  private async deleteFromPlatform(platform: any, platformPostId: string): Promise<void> {
    switch (platform.name) {
      case 'facebook':
        return this.deleteFromFacebook(platform, platformPostId);
      case 'instagram':
        return this.deleteFromInstagram(platform, platformPostId);
      case 'tiktok':
        return this.deleteFromTikTok(platform, platformPostId);
      case 'pinterest':
        return this.deleteFromPinterest(platform, platformPostId);
      case 'twitter':
        return this.deleteFromTwitter(platform, platformPostId);
      default:
        throw new Error(`Unsupported platform: ${platform.name}`);
    }
  }

  private async updateInventoryOnPlatform(platform: any, socialProduct: any): Promise<void> {
    switch (platform.name) {
      case 'facebook':
        return this.updateInventoryOnFacebook(platform, socialProduct);
      case 'instagram':
        return this.updateInventoryOnInstagram(platform, socialProduct);
      case 'tiktok':
        return this.updateInventoryOnTikTok(platform, socialProduct);
      case 'pinterest':
        return this.updateInventoryOnPinterest(platform, socialProduct);
      case 'twitter':
        return this.updateInventoryOnTwitter(platform, socialProduct);
      default:
        throw new Error(`Unsupported platform: ${platform.name}`);
    }
  }

  // Platform-specific implementation methods
  private async syncToFacebook(platform: any, product: any): Promise<string> {
    // Implement Facebook product sync
    return `fb_${Date.now()}`;
  }

  private async publishToFacebook(platform: any, post: any): Promise<string> {
    // Implement Facebook post publishing
    return `fb_post_${Date.now()}`;
  }

  private async deleteFromFacebook(platform: any, platformPostId: string): Promise<void> {
    // Implement Facebook post deletion
  }

  private async updateInventoryOnFacebook(platform: any, socialProduct: any): Promise<void> {
    // Implement Facebook inventory update
  }

  private async syncToInstagram(platform: any, product: any): Promise<string> {
    // Implement Instagram product sync
    return `ig_${Date.now()}`;
  }

  private async publishToInstagram(platform: any, post: any): Promise<string> {
    // Implement Instagram post publishing
    return `ig_post_${Date.now()}`;
  }

  private async deleteFromInstagram(platform: any, platformPostId: string): Promise<void> {
    // Implement Instagram post deletion
  }

  private async updateInventoryOnInstagram(platform: any, socialProduct: any): Promise<void> {
    // Implement Instagram inventory update
  }

  private async syncToTikTok(platform: any, product: any): Promise<string> {
    // Implement TikTok product sync
    return `tt_${Date.now()}`;
  }

  private async publishToTikTok(platform: any, post: any): Promise<string> {
    // Implement TikTok post publishing
    return `tt_post_${Date.now()}`;
  }

  private async deleteFromTikTok(platform: any, platformPostId: string): Promise<void> {
    // Implement TikTok post deletion
  }

  private async updateInventoryOnTikTok(platform: any, socialProduct: any): Promise<void> {
    // Implement TikTok inventory update
  }

  private async syncToPinterest(platform: any, product: any): Promise<string> {
    // Implement Pinterest product sync
    return `pin_${Date.now()}`;
  }

  private async publishToPinterest(platform: any, post: any): Promise<string> {
    // Implement Pinterest post publishing
    return `pin_post_${Date.now()}`;
  }

  private async deleteFromPinterest(platform: any, platformPostId: string): Promise<void> {
    // Implement Pinterest post deletion
  }

  private async updateInventoryOnPinterest(platform: any, socialProduct: any): Promise<void> {
    // Implement Pinterest inventory update
  }

  private async syncToTwitter(platform: any, product: any): Promise<string> {
    // Implement Twitter product sync
    return `tw_${Date.now()}`;
  }

  private async publishToTwitter(platform: any, post: any): Promise<string> {
    // Implement Twitter post publishing
    return `tw_post_${Date.now()}`;
  }

  private async deleteFromTwitter(platform: any, platformPostId: string): Promise<void> {
    // Implement Twitter post deletion
  }

  private async updateInventoryOnTwitter(platform: any, socialProduct: any): Promise<void> {
    // Implement Twitter inventory update
  }
} 