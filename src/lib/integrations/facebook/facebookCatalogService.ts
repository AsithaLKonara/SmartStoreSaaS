import { FacebookCommerceService, FacebookCatalogItem } from './facebookCommerceService';
import { prisma } from '@/lib/prisma';

export class FacebookCatalogService {
  private commerceService: FacebookCommerceService;

  constructor(commerceService: FacebookCommerceService) {
    this.commerceService = commerceService;
  }

  async syncProductCatalog(_organizationId: string): Promise<{ success: number; failed: number }> {
    return await this.commerceService.syncProducts();
  }

  async updateProductInCatalog(productId: string, updates: Partial<FacebookCatalogItem>): Promise<void> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new Error('Product not found');
    }

    const catalogItem = this.commerceService['productToFacebookCatalogItem'](product);
    const updatedItem = { ...catalogItem, ...updates };

    const integration = await prisma.facebookIntegration.findFirst({
      where: { organizationId: product.organizationId },
    });

    if (!integration || !integration.catalogId) {
      throw new Error('Facebook integration or catalog not found');
    }

    await this.commerceService['uploadProductsBatch'](integration.catalogId, [updatedItem]);
  }

  async removeProductFromCatalog(productId: string): Promise<void> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new Error('Product not found');
    }

    const integration = await prisma.facebookIntegration.findFirst({
      where: { organizationId: product.organizationId },
    });

    if (!integration || !integration.catalogId) {
      throw new Error('Facebook integration or catalog not found');
    }

    const retailerId = product.sku || product.id;
    
    // Delete from Facebook catalog
    await this.commerceService['client'].delete(
      `/${integration.catalogId}/products/${retailerId}`
    );
  }

  async getCatalogStatus(): Promise<{ totalProducts: number; lastSync: Date | null }> {
    const integration = await prisma.facebookIntegration.findFirst({
      where: { id: this.commerceService['integrationId'] },
    });

    if (!integration) {
      throw new Error('Integration not found');
    }

    // Get product count from database
    const productCount = await prisma.product.count({
      where: {
        organizationId: integration.organizationId,
        isActive: true,
      },
    });

    return {
      totalProducts: productCount,
      lastSync: integration.lastSync,
    };
  }
}

