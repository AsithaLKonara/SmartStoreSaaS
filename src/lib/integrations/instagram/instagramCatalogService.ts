import { InstagramShoppingService, InstagramProduct } from './instagramShoppingService';
import { prisma } from '@/lib/prisma';

export class InstagramCatalogService {
  private shoppingService: InstagramShoppingService;

  constructor(shoppingService: InstagramShoppingService) {
    this.shoppingService = shoppingService;
  }

  async syncProductCatalog(organizationId: string): Promise<{ success: number; failed: number }> {
    return await this.shoppingService.syncProducts();
  }

  async updateProductInCatalog(productId: string, updates: Partial<InstagramProduct>): Promise<void> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new Error('Product not found');
    }

    const catalogItem = this.shoppingService['productToInstagramProduct'](product);
    const updatedItem = { ...catalogItem, ...updates };

    const integration = await prisma.instagramIntegration.findFirst({
      where: { organizationId: product.organizationId },
    });

    if (!integration || !integration.catalogId) {
      throw new Error('Instagram integration or catalog not found');
    }

    await this.shoppingService['uploadProductsBatch'](integration.catalogId, [updatedItem]);
  }

  async removeProductFromCatalog(productId: string): Promise<void> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new Error('Product not found');
    }

    const integration = await prisma.instagramIntegration.findFirst({
      where: { organizationId: product.organizationId },
    });

    if (!integration || !integration.catalogId) {
      throw new Error('Instagram integration or catalog not found');
    }

    const productIdStr = product.sku || product.id;
    
    const axios = (await import('axios')).default;
    await axios.delete(
      `https://graph.facebook.com/v18.0/${integration.catalogId}/products/${productIdStr}`,
      {
        headers: {
          Authorization: `Bearer ${integration.accessToken}`,
        },
      }
    );
  }
}

