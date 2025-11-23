import { prisma } from '@/lib/prisma';
import { CurrencyService } from './currencyService';

export interface RegionalPricing {
  productId: string;
  currency: string;
  price: number;
  region: string;
}

export class PricingService {
  private currencyService: CurrencyService;

  constructor() {
    this.currencyService = new CurrencyService();
  }

  async getRegionalPrice(
    organizationId: string,
    productId: string,
    currency: string,
    region?: string
  ): Promise<number> {
    // Check for region-specific pricing
    // Get base product price
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new Error('Product not found');
    }

    // Check for regional pricing in Organization settings
    if (region) {
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
      });
      const settings = (organization?.settings as Record<string, unknown>) || {};
      const regionalPricing = settings.regionalPricing?.[productId]?.[region]?.[currency];
      if (regionalPricing) {
        return regionalPricing;
      }
    }

    // Convert to requested currency
    const dimensions = (product.dimensions as Record<string, unknown>) || {};
    const baseCurrency = dimensions.currency || 'USD';
    if (currency === baseCurrency) {
      return product.price;
    }

    const conversion = await this.currencyService.convertCurrency(
      organizationId,
      baseCurrency,
      currency,
      product.price
    );

    return conversion.converted;
  }

  async setRegionalPrice(
    organizationId: string,
    productId: string,
    region: string,
    currency: string,
    price: number
  ): Promise<void> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product || product.organizationId !== organizationId) {
      throw new Error('Product not found');
    }

    // Store regional pricing in Organization settings
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!organization) {
      throw new Error('Organization not found');
    }
    const settings = (organization.settings as any) || {};
    if (!settings.regionalPricing) {
      settings.regionalPricing = {};
    }
    if (!settings.regionalPricing[productId]) {
      settings.regionalPricing[productId] = {};
    }
    if (!settings.regionalPricing[productId][region]) {
      settings.regionalPricing[productId][region] = {};
    }
    settings.regionalPricing[productId][region][currency] = price;

    await prisma.organization.update({
      where: { id: organizationId },
      data: { settings: settings as Record<string, unknown> },
    });
  }

  async calculateTax(
    organizationId: string,
    amount: number,
    currency: string,
    region: string
  ): Promise<number> {
    // Get tax rate for region
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    const taxRates = (organization?.settings as Record<string, unknown> & { taxRates?: Record<string, unknown> })?.taxRates || {};
    const taxRate = taxRates[region] || taxRates['default'] || 0;

    return amount * (taxRate / 100);
  }
}

