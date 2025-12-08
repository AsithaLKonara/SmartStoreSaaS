import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SocialCommerceService } from '@/lib/social/socialCommerceService';

const socialCommerceService = new SocialCommerceService();

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const platformId = searchParams.get('platformId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    switch (action) {
      case 'platforms':
        const user = await prisma.user.findUnique({
          where: { email: session.user.email },
          include: { organization: true }
        });
        
        if (!user?.organizationId) {
          return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        const platforms = await socialCommerceService.getSocialPlatforms(user.organizationId);
        return NextResponse.json({ platforms });

      case 'analytics':
        const userForAnalytics = await prisma.user.findUnique({
          where: { email: session.user.email },
          include: { organization: true }
        });
        
        if (!userForAnalytics?.organizationId) {
          return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        const analytics = await socialCommerceService.getSocialAnalytics(
          userForAnalytics.organizationId,
          startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
          endDate ? new Date(endDate) : new Date()
        );
        return NextResponse.json({ analytics });

      case 'scheduled-posts':
        const scheduledPosts = await socialCommerceService.getScheduledPosts(platformId || undefined);
        return NextResponse.json({ posts: scheduledPosts });

      case 'social-products':
        if (!platformId) {
          return NextResponse.json({ error: 'Platform ID required' }, { status: 400 });
        }
        const socialProducts = await prisma.socialProduct.findMany({
          where: { platformId },
          include: { product: true },
          orderBy: { lastSync: 'desc' }
        });
        return NextResponse.json({ products: socialProducts });

      case 'social-posts':
        const where: {
          platformId?: string;
        } = {};
        if (platformId) {
          where.platformId = platformId;
        }

        const posts = await prisma.socialPost.findMany({
          where,
          include: { platform: true },
          orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json({ posts });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Social Commerce API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      case 'connect-platform':
        const user = await prisma.user.findUnique({
          where: { email: session.user.email },
          include: { organization: true }
        });
        
        if (!user?.organizationId) {
          return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        const platform = await socialCommerceService.connectPlatform(
          user.organizationId,
          data.platform,
          data.config
        );
        return NextResponse.json({ platform });

      case 'sync-products':
        const socialProducts = await socialCommerceService.syncProductsToPlatform(
          data.platformId,
          data.productIds
        );
        return NextResponse.json({ products: socialProducts });

      case 'create-post':
        const post = await socialCommerceService.createSocialPost(
          data.platformId,
          {
            type: data.type,
            content: data.content,
            mediaUrls: data.mediaUrls,
            productIds: data.productIds,
            scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined
          }
        );
        return NextResponse.json({ post });

      case 'publish-post':
        const publishedPost = await socialCommerceService.publishPost(data.postId);
        return NextResponse.json({ post: publishedPost });

      case 'delete-post':
        await socialCommerceService.deleteSocialPost(data.postId);
        return NextResponse.json({ success: true });

      case 'update-engagement':
        await socialCommerceService.updatePostEngagement(data.postId, data.engagement);
        return NextResponse.json({ success: true });

      case 'sync-inventory':
        await socialCommerceService.syncInventory(data.platformId);
        return NextResponse.json({ success: true });

      case 'bulk-sync-products':
        const { platformIds, productIds } = data;
        const results = [];
        for (const platformId of platformIds) {
          try {
            const products = await socialCommerceService.syncProductsToPlatform(platformId, productIds);
            results.push({ platformId, success: true, products });
          } catch (error) {
            results.push({ platformId, success: false, error: error instanceof Error ? error.message : String(error) });
          }
        }
        return NextResponse.json({ results });

      case 'bulk-publish-posts':
        const { postIds } = data;
        const publishResults = [];
        for (const postId of postIds) {
          try {
            const post = await socialCommerceService.publishPost(postId);
            publishResults.push({ postId, success: true, post });
          } catch (error) {
            publishResults.push({ postId, success: false, error: error instanceof Error ? error.message : String(error) });
          }
        }
        return NextResponse.json({ results: publishResults });

      case 'schedule-posts':
        const { posts } = data;
        const scheduledPosts = [];
        for (const postData of posts) {
          const post = await socialCommerceService.createSocialPost(
            postData.platformId,
            {
              type: postData.type,
              content: postData.content,
              mediaUrls: postData.mediaUrls,
              productIds: postData.productIds,
              scheduledAt: new Date(postData.scheduledAt)
            }
          );
          scheduledPosts.push(post);
        }
        return NextResponse.json({ posts: scheduledPosts });

      case 'update-platform-config':
        const userForConfig = await prisma.user.findUnique({
          where: { email: session.user.email },
          include: { organization: true }
        });
        
        if (!userForConfig?.organizationId) {
          return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        await socialCommerceService.connectPlatform(
          userForConfig.organizationId,
          data.platform,
          data.config
        );
        return NextResponse.json({ success: true });

      case 'disconnect-platform':
        await prisma.socialPlatform.update({
          where: { id: data.platformId },
          data: { isActive: false }
        });
        return NextResponse.json({ success: true });

      case 'get-platform-stats':
        const platformStats = await prisma.socialPlatform.findUnique({
          where: { id: data.platformId },
          include: {
            _count: {
              select: { socialProducts: true, socialPosts: true }
            },
            socialPosts: {
              where: {
                publishedAt: {
                  gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
                }
              }
            }
          }
        });

        if (!platformStats) {
          return NextResponse.json({ error: 'Platform not found' }, { status: 404 });
        }

        const totalEngagement = platformStats.socialPosts.reduce((sum, post) => {
          const engagement = post.engagement as Prisma.InputJsonValue & { likes?: number; comments?: number; shares?: number };
          return sum + (engagement?.likes || 0) + (engagement?.comments || 0) + (engagement?.shares || 0);
        }, 0);

        const stats = {
          productCount: platformStats._count.socialProducts,
          postCount: platformStats._count.socialPosts,
          recentPosts: platformStats.socialPosts.length,
          totalEngagement,
          lastSync: platformStats.lastSync,
          isActive: platformStats.isActive
        };

        return NextResponse.json({ stats });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Social Commerce API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 