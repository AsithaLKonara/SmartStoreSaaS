import { prisma } from '@/lib/prisma';

export interface ARModelInfo {
  id: string;
  productId: string;
  modelUrl: string;
  modelType: 'gltf' | 'glb' | 'obj';
  thumbnailUrl?: string;
  metadata?: any;
}

export class ARService {
  async getARModel(productId: string): Promise<ARModelInfo | null> {
    const arModel = await prisma.aRModel.findUnique({
      where: { productId },
    });

    if (!arModel) {
      return null;
    }

    return {
      id: arModel.id,
      productId: arModel.productId,
      modelUrl: arModel.modelUrl,
      modelType: arModel.modelType as 'gltf' | 'glb' | 'obj',
      thumbnailUrl: arModel.thumbnailUrl || undefined,
      metadata: arModel.metadata as any,
    };
  }

  async createARModel(
    productId: string,
    modelUrl: string,
    modelType: 'gltf' | 'glb' | 'obj',
    thumbnailUrl?: string,
    metadata?: any
  ): Promise<ARModelInfo> {
    const arModel = await prisma.aRModel.upsert({
      where: { productId },
      create: {
        productId,
        modelUrl,
        modelType,
        thumbnailUrl: thumbnailUrl || null,
        metadata: metadata || {},
        isActive: true,
      },
      update: {
        modelUrl,
        modelType,
        thumbnailUrl: thumbnailUrl || null,
        metadata: metadata || {},
        isActive: true,
      },
    });

    return {
      id: arModel.id,
      productId: arModel.productId,
      modelUrl: arModel.modelUrl,
      modelType: arModel.modelType as 'gltf' | 'glb' | 'obj',
      thumbnailUrl: arModel.thumbnailUrl || undefined,
      metadata: arModel.metadata as any,
    };
  }

  async deleteARModel(productId: string): Promise<void> {
    await prisma.aRModel.delete({
      where: { productId },
    });
  }

  async listARModels(organizationId: string): Promise<ARModelInfo[]> {
    const products = await prisma.product.findMany({
      where: { organizationId },
      include: {
        arModel: true,
      },
    });

    return products
      .filter(p => p.arModel)
      .map(p => ({
        id: p.arModel!.id,
        productId: p.arModel!.productId,
        modelUrl: p.arModel!.modelUrl,
        modelType: p.arModel!.modelType as 'gltf' | 'glb' | 'obj',
        thumbnailUrl: p.arModel!.thumbnailUrl || undefined,
        metadata: p.arModel!.metadata as any,
      }));
  }
}

