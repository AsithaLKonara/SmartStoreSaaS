import { prisma } from '@/lib/prisma';
import axios, { AxiosInstance } from 'axios';

export class PinterestService {
  private client: AxiosInstance;
  private integrationId: string;
  private accessToken: string;

  constructor(integrationId: string, accessToken: string) {
    this.integrationId = integrationId;
    this.accessToken = accessToken;

    this.client = axios.create({
      baseURL: 'https://api.pinterest.com/v5',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.get('/user_account');
      return response.status === 200;
    } catch (error) {
      console.error('Pinterest connection test failed:', error);
      return false;
    }
  }

  async createProductPin(
    productId: string,
    boardId: string,
    imageUrl: string,
    title: string,
    description: string,
    link: string
  ): Promise<string> {
    const response = await this.client.post('/pins', {
      board_id: boardId,
      media_source: {
        source_type: 'image_url',
        url: imageUrl,
      },
      title,
      description,
      link,
      product_data: {
        name: title,
        description,
        price: '0', // Would get from product
        currency: 'USD',
      },
    });

    return response.data.id;
  }

  async syncProducts(organizationId: string): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    try {
      const integration = await prisma.pinterestIntegration.findFirst({
        where: { organizationId },
      });

      if (!integration || !integration.boardId) {
        throw new Error('Pinterest integration or board not configured');
      }

      const products = await prisma.product.findMany({
        where: {
          organizationId,
          isActive: true,
        },
        take: 100,
      });

      for (const product of products) {
        try {
          await this.createProductPin(
            product.id,
            integration.boardId,
            product.images[0] || '',
            product.name,
            product.description || '',
            `${process.env.NEXTAUTH_URL}/products/${product.slug}`
          );
          success++;
        } catch (error) {
          console.error(`Failed to create pin for product ${product.id}:`, error);
          failed++;
        }
      }

      await prisma.pinterestIntegration.update({
        where: { id: integration.id },
        data: { lastSync: new Date() },
      });

      return { success, failed };
    } catch (error) {
      console.error('Error syncing products to Pinterest:', error);
      throw error;
    }
  }

  async getBoards(): Promise<Array<{ id: string; name: string }>> {
    const response = await this.client.get('/boards');
    return response.data.items.map((board: any) => ({
      id: board.id,
      name: board.name,
    }));
  }
}

