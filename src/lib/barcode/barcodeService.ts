// @ts-expect-error - quagga types not available
import Quagga from 'quagga';
import { prisma } from '@/lib/prisma';

export interface BarcodeResult {
  code: string;
  format: string;
  confidence: number;
  box: number[][];
  line: {
    angle: number;
    offset: number;
  };
}

export interface BarcodeConfig {
  inputStream: {
    name: string;
    type: 'LiveStream' | 'ImageStream';
    target?: HTMLElement | string;
    constraints?: {
      width: number;
      height: number;
      facing?: 'user' | 'environment';
    };
  };
  decoder: {
    readers: string[];
    debug?: {
      drawBoundingBox: boolean;
      showFrequency: boolean;
      drawScanline: boolean;
      showPattern: boolean;
    };
  };
  locate?: boolean;
  numOfWorkers?: number;
  frequency?: number;
  locator?: {
    patchSize: string;
    halfSample: boolean;
  };
}

export interface ProductLookup {
  barcode: string;
  name: string;
  description?: string;
  price: number;
  category?: string;
  brand?: string;
  manufacturer?: string;
  images: string[];
  specifications?: Record<string, any>;
  source: 'internal' | 'external';
}

export class BarcodeService {
  private isInitialized = false;
  private currentConfig: BarcodeConfig | null = null;
  private onDetectedCallback: ((result: BarcodeResult) => void) | null = null;

  /**
   * Initialize the barcode scanner
   */
  async initialize(config: BarcodeConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.currentConfig = config;

        Quagga.init(config, (err: unknown) => {
          if (err) {
            console.error('Error initializing Quagga:', err);
            reject(err);
            return;
          }

          this.isInitialized = true;
          this.setupEventListeners();
          resolve();
        });
      } catch (error) {
        console.error('Error initializing barcode service:', error);
        reject(error);
      }
    });
  }

  /**
   * Start the barcode scanner
   */
  start(): void {
    if (!this.isInitialized) {
      throw new Error('Barcode service not initialized');
    }

    Quagga.start();
  }

  /**
   * Stop the barcode scanner
   */
  stop(): void {
    if (this.isInitialized) {
      Quagga.stop();
    }
  }

  /**
   * Set up event listeners for barcode detection
   */
  private setupEventListeners(): void {
    Quagga.onDetected((result: { codeResult?: { code?: string; format?: string }; boxes?: unknown[][] }) => {
      const barcodeResult: BarcodeResult = {
        code: result.codeResult.code,
        format: result.codeResult.format,
        confidence: result.codeResult.confidence || 0,
        box: result.box,
        line: result.line,
      };

      if (this.onDetectedCallback) {
        this.onDetectedCallback(barcodeResult);
      }
    });

    Quagga.onProcessed((result: { boxes?: unknown[][] }) => {
      const drawingCtx = Quagga.canvas.ctx.overlay;
      const drawingCanvas = Quagga.canvas.dom.overlay;

      if (result) {
        if (result.boxes) {
          drawingCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
          result.boxes?.filter((box) => box !== result.box).forEach((box) => {
            Quagga.ImageDebug.drawPath(box, { x: 0, y: 1 }, drawingCtx, { color: 'green', lineWidth: 2 });
          });
        }

        if (result.box) {
          Quagga.ImageDebug.drawPath(result.box, { x: 0, y: 1 }, drawingCtx, { color: '#00F', lineWidth: 2 });
        }

        if (result.codeResult && result.codeResult.code) {
          Quagga.ImageDebug.drawPath(result.line, { x: 'x', y: 'y' }, drawingCtx, { color: 'red', lineWidth: 3 });
        }
      }
    });
  }

  /**
   * Set callback for when barcode is detected
   */
  onDetected(callback: (result: BarcodeResult) => void): void {
    this.onDetectedCallback = callback;
  }

  /**
   * Scan barcode from image file
   */
  async scanFromImage(imageFile: File): Promise<BarcodeResult | null> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d')!;
          
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);

          const config: BarcodeConfig = {
            inputStream: {
              name: 'Image',
              type: 'ImageStream',
            },
            decoder: {
              readers: [
                'code_128_reader',
                'ean_reader',
                'ean_8_reader',
                'code_39_reader',
                'code_39_vin_reader',
                'codabar_reader',
                'upc_reader',
                'upc_e_reader',
                'i2of5_reader',
                '2of5_reader',
                'code_93_reader',
              ],
            },
            locate: true,
            numOfWorkers: 1,
          };

          Quagga.decodeSingle({
            ...config,
            src: canvas.toDataURL(),
          }, (result: { codeResult?: { code?: string; format?: string } }) => {
            if (result && result.codeResult) {
              const barcodeResult: BarcodeResult = {
                code: result.codeResult.code,
                format: result.codeResult.format,
                confidence: result.codeResult.confidence || 0,
                box: result.box || [],
                line: result.line || { angle: 0, offset: 0 },
              };
              resolve(barcodeResult);
            } else {
              resolve(null);
            }
          });
        };

        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = event.target?.result as string;
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(imageFile);
    });
  }

  /**
   * Look up product information by barcode
   */
  async lookupProduct(barcode: string, organizationId: string): Promise<ProductLookup | null> {
    try {
      // First check internal database
      const internalProduct = await this.lookupInternalProduct(barcode, organizationId);
      if (internalProduct) {
        return internalProduct;
      }

      // Then check external APIs
      const externalProduct = await this.lookupExternalProduct(barcode);
      if (externalProduct) {
        // Cache the result for future use
        await this.cacheProductLookup(barcode, externalProduct, organizationId);
        return externalProduct;
      }

      return null;
    } catch (error) {
      console.error('Error looking up product:', error);
      return null;
    }
  }

  private async lookupInternalProduct(barcode: string, organizationId: string): Promise<ProductLookup | null> {
    try {
      const product = await prisma.product.findFirst({
        where: {
          sku: barcode, // Use sku field or check dimensions metadata
          organizationId,
          isActive: true,
        },
        include: {
          category: true,
        },
      });

      if (!product) return null;

      return {
        barcode,
        name: product.name,
        description: product.description || undefined,
        price: product.price,
        category: product.categoryId ? (await prisma.category.findUnique({ where: { id: product.categoryId }, select: { name: true } }))?.name : undefined,
        brand: (product.dimensions as Record<string, unknown> & { brand?: string })?.brand || undefined, // Store in dimensions metadata
        manufacturer: (product.dimensions as Record<string, unknown> & { manufacturer?: string })?.manufacturer || undefined, // Store in dimensions metadata
        images: product.images, // images is already string[]
        specifications: (product.dimensions as Record<string, unknown> & { specifications?: Record<string, unknown> })?.specifications || {}, // Store in dimensions metadata
        source: 'internal',
      };
    } catch (error) {
      console.error('Error looking up internal product:', error);
      return null;
    }
  }

  private async lookupExternalProduct(barcode: string): Promise<ProductLookup | null> {
    try {
      // Try multiple external APIs
      const apis = [
        this.lookupUPCDatabase(barcode),
        this.lookupOpenFoodFacts(barcode),
        this.lookupBarcodeLookup(barcode),
      ];

      for (const apiCall of apis) {
        try {
          const result = await apiCall;
          if (result) {
            return result;
          }
        } catch (error) {
          console.error('External API lookup failed:', error);
          continue;
        }
      }

      return null;
    } catch (error) {
      console.error('Error looking up external product:', error);
      return null;
    }
  }

  private async lookupUPCDatabase(barcode: string): Promise<ProductLookup | null> {
    try {
      const apiKey = process.env.UPC_DATABASE_API_KEY;
      if (!apiKey) return null;

      const response = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${barcode}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) return null;

      const data = await response.json();
      
      if (data.items && data.items.length > 0) {
        const item = data.items[0];
        return {
          barcode,
          name: item.title,
          description: item.description,
          price: 0, // Price not available from this API
          category: item.category,
          brand: item.brand,
          manufacturer: item.manufacturer,
          images: item.images || [],
          specifications: {
            weight: item.weight,
            dimensions: item.dimension,
            color: item.color,
            size: item.size,
          },
          source: 'external',
        };
      }

      return null;
    } catch (error) {
      console.error('UPC Database lookup failed:', error);
      return null;
    }
  }

  private async lookupOpenFoodFacts(barcode: string): Promise<ProductLookup | null> {
    try {
      const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
      
      if (!response.ok) return null;

      const data = await response.json();
      
      if (data.status === 1 && data.product) {
        const product = data.product;
        return {
          barcode,
          name: product.product_name || product.product_name_en,
          description: product.generic_name || product.generic_name_en,
          price: 0,
          category: product.categories,
          brand: product.brands,
          manufacturer: product.manufacturing_places,
          images: [
            product.image_front_url,
            product.image_ingredients_url,
            product.image_nutrition_url,
          ].filter(Boolean),
          specifications: {
            ingredients: product.ingredients_text,
            nutritionGrade: product.nutrition_grade_fr,
            allergens: product.allergens,
            traces: product.traces,
            packaging: product.packaging,
            labels: product.labels,
            origins: product.origins,
          },
          source: 'external',
        };
      }

      return null;
    } catch (error) {
      console.error('Open Food Facts lookup failed:', error);
      return null;
    }
  }

  private async lookupBarcodeLookup(barcode: string): Promise<ProductLookup | null> {
    try {
      const apiKey = process.env.BARCODE_LOOKUP_API_KEY;
      if (!apiKey) return null;

      const response = await fetch(`https://api.barcodelookup.com/v3/products?barcode=${barcode}&formatted=y&key=${apiKey}`);
      
      if (!response.ok) return null;

      const data = await response.json();
      
      if (data.products && data.products.length > 0) {
        const product = data.products[0];
        return {
          barcode,
          name: product.title,
          description: product.description,
          price: parseFloat(product.price) || 0,
          category: product.category,
          brand: product.brand,
          manufacturer: product.manufacturer,
          images: product.images || [],
          specifications: {
            model: product.model,
            mpn: product.mpn,
            color: product.color,
            size: product.size,
            weight: product.weight,
            dimensions: product.dimensions,
          },
          source: 'external',
        };
      }

      return null;
    } catch (error) {
      console.error('Barcode Lookup API failed:', error);
      return null;
    }
  }

  private async cacheProductLookup(barcode: string, product: ProductLookup, organizationId: string): Promise<void> {
    try {
      // Store lookup cache in Organization settings instead of separate model
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
      });

      if (organization) {
        const settings = (organization.settings as Record<string, unknown>) || {};
        const productLookupCache = settings.productLookupCache || {};
        productLookupCache[barcode] = {
          productData: product,
          lastUpdated: new Date(),
        };

        await prisma.organization.update({
          where: { id: organizationId },
          data: {
            settings: {
              ...settings,
              productLookupCache,
            } as any,
        },
      });
      }
    } catch (error) {
      console.error('Error caching product lookup:', error);
    }
  }

  /**
   * Generate barcode for product
   */
  generateBarcode(format: 'EAN13' | 'UPC' | 'CODE128' = 'EAN13'): string {
    switch (format) {
      case 'EAN13':
        return this.generateEAN13();
      case 'UPC':
        return this.generateUPC();
      case 'CODE128':
        return this.generateCODE128();
      default:
        return this.generateEAN13();
    }
  }

  private generateEAN13(): string {
    // Generate 12 random digits
    let barcode = '';
    for (let i = 0; i < 12; i++) {
      barcode += Math.floor(Math.random() * 10).toString();
    }

    // Calculate check digit
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const digit = parseInt(barcode[i]);
      sum += i % 2 === 0 ? digit : digit * 3;
    }

    const checkDigit = (10 - (sum % 10)) % 10;
    return barcode + checkDigit.toString();
  }

  private generateUPC(): string {
    // Generate 11 random digits
    let barcode = '';
    for (let i = 0; i < 11; i++) {
      barcode += Math.floor(Math.random() * 10).toString();
    }

    // Calculate check digit
    let sum = 0;
    for (let i = 0; i < 11; i++) {
      const digit = parseInt(barcode[i]);
      sum += i % 2 === 0 ? digit * 3 : digit;
    }

    const checkDigit = (10 - (sum % 10)) % 10;
    return barcode + checkDigit.toString();
  }

  private generateCODE128(): string {
    // Generate random alphanumeric string
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let barcode = '';
    for (let i = 0; i < 12; i++) {
      barcode += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return barcode;
  }

  /**
   * Validate barcode format
   */
  validateBarcode(barcode: string, format?: string): boolean {
    if (!barcode) return false;

    // Remove any non-alphanumeric characters
    const cleaned = barcode.replace(/[^A-Za-z0-9]/g, '');

    switch (format) {
      case 'EAN13':
        return /^\d{13}$/.test(cleaned) && this.validateEAN13CheckDigit(cleaned);
      case 'EAN8':
        return /^\d{8}$/.test(cleaned) && this.validateEAN8CheckDigit(cleaned);
      case 'UPC':
        return /^\d{12}$/.test(cleaned) && this.validateUPCCheckDigit(cleaned);
      case 'CODE128':
        return /^[A-Za-z0-9]{4,}$/.test(cleaned);
      case 'CODE39':
        return /^[A-Z0-9\-. $\/+%*]+$/.test(cleaned);
      default:
        // Auto-detect format
        if (/^\d{13}$/.test(cleaned)) {
          return this.validateEAN13CheckDigit(cleaned);
        } else if (/^\d{12}$/.test(cleaned)) {
          return this.validateUPCCheckDigit(cleaned);
        } else if (/^\d{8}$/.test(cleaned)) {
          return this.validateEAN8CheckDigit(cleaned);
        } else if (/^[A-Za-z0-9]{4,}$/.test(cleaned)) {
          return true; // CODE128 or similar
        }
        return false;
    }
  }

  private validateEAN13CheckDigit(barcode: string): boolean {
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const digit = parseInt(barcode[i]);
      sum += i % 2 === 0 ? digit : digit * 3;
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    return checkDigit === parseInt(barcode[12]);
  }

  private validateEAN8CheckDigit(barcode: string): boolean {
    let sum = 0;
    for (let i = 0; i < 7; i++) {
      const digit = parseInt(barcode[i]);
      sum += i % 2 === 0 ? digit * 3 : digit;
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    return checkDigit === parseInt(barcode[7]);
  }

  private validateUPCCheckDigit(barcode: string): boolean {
    let sum = 0;
    for (let i = 0; i < 11; i++) {
      const digit = parseInt(barcode[i]);
      sum += i % 2 === 0 ? digit * 3 : digit;
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    return checkDigit === parseInt(barcode[11]);
  }

  /**
   * Get supported barcode formats
   */
  getSupportedFormats(): string[] {
    return [
      'code_128_reader',
      'ean_reader',
      'ean_8_reader',
      'code_39_reader',
      'code_39_vin_reader',
      'codabar_reader',
      'upc_reader',
      'upc_e_reader',
      'i2of5_reader',
      '2of5_reader',
      'code_93_reader',
    ];
  }

  /**
   * Create default scanner config
   */
  createDefaultConfig(target: HTMLElement | string): BarcodeConfig {
    return {
      inputStream: {
        name: 'Live',
        type: 'LiveStream',
        target,
        constraints: {
          width: 640,
          height: 480,
          facing: 'environment', // Use back camera
        },
      },
      decoder: {
        readers: this.getSupportedFormats(),
        debug: {
          drawBoundingBox: true,
          showFrequency: false,
          drawScanline: true,
          showPattern: false,
        },
      },
      locate: true,
      numOfWorkers: 2,
      frequency: 10,
      locator: {
        patchSize: 'medium',
        halfSample: true,
      },
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.isInitialized) {
      this.stop();
      Quagga.offDetected();
      Quagga.offProcessed();
      this.isInitialized = false;
      this.currentConfig = null;
      this.onDetectedCallback = null;
    }
  }
}

export const barcodeService = new BarcodeService();
