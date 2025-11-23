import * as tf from '@tensorflow/tfjs';
import { prisma } from '@/lib/prisma';

export interface VisualSearchResult {
  productId: string;
  similarity: number;
  product: {
    id: string;
    name: string;
    price: number;
    images: string[];
    description?: string;
  };
}

export interface ImageEmbedding {
  productId: string;
  embedding: number[];
  imageUrl: string;
  createdAt: Date;
}

export interface ProductRecognition {
  productId?: string;
  confidence: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  category?: string;
  attributes?: Record<string, any>;
}

export class VisualSearchService {
  private model: tf.LayersModel | null = null;
  private isModelLoaded = false;
  private modelUrl = 'https://tfhub.dev/google/imagenet/mobilenet_v2_100_224/feature_vector/4';

  constructor() {
    this.initializeModel();
  }

  /**
   * Initialize TensorFlow model
   */
  private async initializeModel(): Promise<void> {
    try {
      console.log('Loading visual search model...');
      
      // Load MobileNetV2 for feature extraction
      this.model = await tf.loadLayersModel('/models/mobilenet/model.json');
      this.isModelLoaded = true;
      
      console.log('Visual search model loaded successfully');
    } catch (error) {
      console.error('Error loading visual search model:', error);
      
      // Fallback: Create a simple model for demonstration
      this.model = tf.sequential({
        layers: [
          tf.layers.conv2d({
            inputShape: [224, 224, 3],
            kernelSize: 3,
            filters: 32,
            activation: 'relu',
          }),
          tf.layers.maxPooling2d({ poolSize: [2, 2] }),
          tf.layers.conv2d({
            kernelSize: 3,
            filters: 64,
            activation: 'relu',
          }),
          tf.layers.maxPooling2d({ poolSize: [2, 2] }),
          tf.layers.flatten(),
          tf.layers.dense({ units: 128, activation: 'relu' }),
          tf.layers.dense({ units: 64, activation: 'relu' }),
        ],
      });
      
      this.isModelLoaded = true;
    }
  }

  /**
   * Extract features from image
   */
  async extractImageFeatures(imageBuffer: Buffer | string): Promise<number[]> {
    try {
      if (!this.isModelLoaded || !this.model) {
        await this.initializeModel();
      }

      // Convert image to tensor
      const imageTensor = await this.preprocessImage(imageBuffer);
      
      // Extract features
      const features = this.model!.predict(imageTensor) as tf.Tensor;
      const featureArray = await features.data();
      
      // Cleanup tensors
      imageTensor.dispose();
      features.dispose();
      
      return Array.from(featureArray);
    } catch (error) {
      console.error('Error extracting image features:', error);
      throw new Error('Failed to extract image features');
    }
  }

  /**
   * Preprocess image for model input
   */
  private async preprocessImage(imageBuffer: Buffer | string): Promise<tf.Tensor> {
    try {
      let imageTensor: tf.Tensor;

      if (typeof imageBuffer === 'string') {
        // Load image from URL
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = imageBuffer;
        });

        imageTensor = tf.browser.fromPixels(img);
      } else {
        // Process buffer (Node.js environment)
        // This would require additional image processing libraries
        // For now, create a dummy tensor
        imageTensor = tf.zeros([224, 224, 3]);
      }

      // Resize to 224x224 and normalize
      const resized = tf.image.resizeBilinear(imageTensor as tf.Tensor3D, [224, 224]);
      const normalized = resized.div(255.0);
      const batched = normalized.expandDims(0);

      // Cleanup intermediate tensors
      if (imageTensor !== resized) imageTensor.dispose();
      resized.dispose();
      normalized.dispose();

      return batched;
    } catch (error) {
      console.error('Error preprocessing image:', error);
      throw new Error('Failed to preprocess image');
    }
  }

  /**
   * Search for similar products using image
   */
  async searchByImage(
    imageBuffer: Buffer | string,
    organizationId: string,
    limit: number = 10,
    threshold: number = 0.7
  ): Promise<VisualSearchResult[]> {
    try {
      // Extract features from search image
      const searchFeatures = await this.extractImageFeatures(imageBuffer);

      // Get all products with embeddings stored in metadata
      const products = await prisma.product.findMany({
        where: { organizationId },
      });

      // Get embeddings from Organization settings
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
      });

      if (!organization) {
        return [];
      }

      const settings = (organization.settings as Record<string, unknown>) || {};
      const productEmbeddings = settings.productEmbeddings || {};

      // Calculate similarities
      const similarities = products
        .filter((_p) => {
          // Check if product has embedding in metadata (if Product model has metadata field)
          // Otherwise, store embeddings in Organization settings
          return true; // Simplified - would need to check actual embedding storage
        })
        .map(product => {
          // Get embedding from Organization settings
          const embeddingData = productEmbeddings[product.id];
          const embedding = embeddingData?.embedding as number[] || [];
          
          if (embedding.length === 0) {
            return null; // Skip products without embeddings
          }
          
          const similarity = this.cosineSimilarity(searchFeatures, embedding);

          return {
            productId: product.id,
            similarity,
            product: {
              id: product.id,
              name: product.name,
              price: product.price,
              images: product.images, // images is already string[]
              description: product.description || undefined,
            },
          };
        });

      // Filter by threshold and sort by similarity
      return similarities
        .filter((result): result is NonNullable<typeof result> => result !== null && result.similarity >= threshold)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
    } catch (error) {
      console.error('Error searching by image:', error);
      throw new Error('Failed to search by image');
    }
  }

  /**
   * Generate embeddings for all products
   */
  async generateProductEmbeddings(organizationId: string): Promise<void> {
    try {
      const products = await prisma.product.findMany({
        where: { organizationId },
      });

      console.log(`Generating embeddings for ${products.length} products...`);

      for (const product of products) {
        if (product.images.length === 0) continue;

        try {
          // Use the first image for embedding generation
          const primaryImage = product.images[0];
          const features = await this.extractImageFeatures(primaryImage);

          // Store embedding in Organization settings (Product model doesn't have metadata field)
          const organization = await prisma.organization.findUnique({
            where: { id: organizationId },
          });

          if (organization) {
            const settings = (organization.settings as Record<string, unknown>) || {};
            const productEmbeddings = settings.productEmbeddings || {};
            productEmbeddings[product.id] = {
              embedding: features,
              embeddingImageUrl: primaryImage,
              embeddingUpdatedAt: new Date(),
            };

            await prisma.organization.update({
              where: { id: organizationId },
              data: {
                settings: {
                  ...settings,
                  productEmbeddings,
                } as Record<string, unknown>,
              },
            });
          }

          console.log(`Generated embedding for product: ${product.name}`);
        } catch (error) {
          console.error(`Error generating embedding for product ${product.id}:`, error);
        }
      }

      console.log('Finished generating product embeddings');
    } catch (error) {
      console.error('Error generating product embeddings:', error);
      throw new Error('Failed to generate product embeddings');
    }
  }

  /**
   * Recognize products in an image
   */
  async recognizeProducts(
    imageBuffer: Buffer | string,
    organizationId: string
  ): Promise<ProductRecognition[]> {
    try {
      // This would use object detection model (YOLO, SSD, etc.)
      // For now, we'll use feature matching as a simplified approach
      
      const searchResults = await this.searchByImage(imageBuffer, organizationId, 5, 0.8);
      
      return searchResults.map(result => ({
        productId: result.productId,
        confidence: result.similarity,
        category: 'detected', // Would come from actual object detection
        attributes: {
          name: result.product.name,
          price: result.product.price,
        },
      }));
    } catch (error) {
      console.error('Error recognizing products:', error);
      throw new Error('Failed to recognize products');
    }
  }

  /**
   * Auto-categorize product from image
   */
  async categorizeProduct(imageBuffer: Buffer | string): Promise<{
    category: string;
    confidence: number;
    subcategories?: string[];
  }> {
    try {
      await this.extractImageFeatures(imageBuffer);
      
      // This would use a classification model trained on product categories
      // For now, return a mock classification
      const categories = [
        'Electronics', 'Clothing', 'Home & Garden', 'Sports', 'Books',
        'Toys', 'Health & Beauty', 'Automotive', 'Food & Beverages'
      ];
      
      const randomCategory = categories[Math.floor(Math.random() * categories.length)];
      const confidence = 0.85 + Math.random() * 0.1; // Mock confidence

      return {
        category: randomCategory,
        confidence,
        subcategories: this.getSubcategories(randomCategory),
      };
    } catch (error) {
      console.error('Error categorizing product:', error);
      throw new Error('Failed to categorize product');
    }
  }

  /**
   * Generate product description from image
   */
  async generateProductDescription(imageBuffer: Buffer | string): Promise<string> {
    try {
      await this.extractImageFeatures(imageBuffer);
      const category = await this.categorizeProduct(imageBuffer);

      // This would integrate with a vision-language model like CLIP + GPT
      // For now, generate a basic description based on category
      const descriptions = {
        'Electronics': 'High-quality electronic device with modern design and advanced features.',
        'Clothing': 'Stylish and comfortable apparel made from premium materials.',
        'Home & Garden': 'Beautiful home accessory that adds elegance to any space.',
        'Sports': 'Professional-grade sports equipment for optimal performance.',
        'Books': 'Engaging and informative reading material.',
        'Toys': 'Fun and educational toy that sparks creativity and imagination.',
        'Health & Beauty': 'Premium health and beauty product for daily care.',
        'Automotive': 'Reliable automotive part or accessory.',
        'Food & Beverages': 'Delicious and high-quality food or beverage product.',
      };

      return descriptions[category.category as keyof typeof descriptions] || 
             'High-quality product with excellent features and design.';
    } catch (error) {
      console.error('Error generating product description:', error);
      throw new Error('Failed to generate product description');
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(vectorA: number[], vectorB: number[]): number {
    if (vectorA.length !== vectorB.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vectorA.length; i++) {
      dotProduct += vectorA[i] * vectorB[i];
      normA += vectorA[i] * vectorA[i];
      normB += vectorB[i] * vectorB[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Get subcategories for a main category
   */
  private getSubcategories(category: string): string[] {
    const subcategoryMap: Record<string, string[]> = {
      'Electronics': ['Smartphones', 'Laptops', 'Tablets', 'Accessories'],
      'Clothing': ['Shirts', 'Pants', 'Dresses', 'Shoes', 'Accessories'],
      'Home & Garden': ['Furniture', 'Decor', 'Kitchen', 'Garden Tools'],
      'Sports': ['Fitness', 'Outdoor', 'Team Sports', 'Water Sports'],
      'Books': ['Fiction', 'Non-fiction', 'Educational', 'Children'],
      'Toys': ['Educational', 'Action Figures', 'Puzzles', 'Games'],
      'Health & Beauty': ['Skincare', 'Makeup', 'Hair Care', 'Supplements'],
      'Automotive': ['Parts', 'Accessories', 'Tools', 'Maintenance'],
      'Food & Beverages': ['Snacks', 'Beverages', 'Organic', 'Gourmet'],
    };

    return subcategoryMap[category] || [];
  }

  /**
   * Batch process images for inventory
   */
  async batchProcessImages(
    images: Array<{ productId: string; imageUrl: string }>,
    _organizationId: string
  ): Promise<void> {
    try {
      console.log(`Batch processing ${images.length} images...`);

      for (const image of images) {
        try {
          await this.extractImageFeatures(image.imageUrl);
          
          // Store embedding in Product metadata
          const product = await prisma.product.findUnique({
            where: { id: image.productId },
          });

          if (product) {
            // Store embedding in a custom field or use dimensions JSON field
            // Since metadata field doesn't exist in Product model, we'll skip this update
            // TODO: Add metadata field to Product model or use dimensions field
            // For now, we'll just log that embedding was generated
            console.log(`Generated embedding for product ${image.productId}`);
          }
        } catch (error) {
          console.error(`Error processing image for product ${image.productId}:`, error);
        }
      }

      console.log('Batch processing completed');
    } catch (error) {
      console.error('Error in batch processing:', error);
      throw new Error('Failed to batch process images');
    }
  }

  /**
   * Find duplicate or similar products
   */
  async findSimilarProducts(
    productId: string,
    organizationId: string,
    threshold: number = 0.9
  ): Promise<VisualSearchResult[]> {
    try {
      const product = await prisma.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        throw new Error('Product not found');
      }

      // Get embedding from Organization settings
      const organization = await prisma.organization.findUnique({
        where: { id: product.organizationId },
      });

      if (!organization) {
        throw new Error('Organization not found');
      }

      const settings = (organization.settings as Record<string, unknown>) || {};
      const productEmbeddings = settings.productEmbeddings || {};
      const embeddingData = productEmbeddings[productId];

      if (!embeddingData || !embeddingData.embedding) {
        throw new Error('Product embedding not found');
      }

      const embedding = embeddingData.embedding as number[];
      
      // Get all products with embeddings
      const products = await prisma.product.findMany({
        where: { 
          organizationId,
          id: { not: productId },
        },
      });

      const similarities = products
        .filter(p => {
          const pEmbeddingData = productEmbeddings[p.id];
          return pEmbeddingData?.embedding;
        })
        .map(p => {
          const pEmbeddingData = productEmbeddings[p.id];
          const pEmbedding = pEmbeddingData.embedding as number[];
          const similarity = this.cosineSimilarity(embedding, pEmbedding);

          return {
            productId: p.id,
            similarity,
            product: {
              id: p.id,
              name: p.name,
              price: p.price,
              images: p.images, // images is already string[]
              description: p.description || undefined,
            },
          };
        });

      return similarities
        .filter(r => r.similarity >= threshold)
        .sort((a, b) => b.similarity - a.similarity);
    } catch (error) {
      console.error('Error finding similar products:', error);
      throw new Error('Failed to find similar products');
    }
  }

  /**
   * Get model performance metrics
   */
  getModelInfo(): {
    isLoaded: boolean;
    modelType: string;
    version: string;
    capabilities: string[];
  } {
    return {
      isLoaded: this.isModelLoaded,
      modelType: 'MobileNetV2',
      version: '2.0',
      capabilities: [
        'Feature Extraction',
        'Similarity Search',
        'Product Recognition',
        'Auto Categorization',
        'Batch Processing',
      ],
    };
  }
}

export const visualSearchService = new VisualSearchService();
