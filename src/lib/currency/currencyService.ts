import { prisma } from '@/lib/prisma';
import axios from 'axios';

export interface CurrencyConversion {
  from: string;
  to: string;
  amount: number;
  rate: number;
  converted: number;
}

export class CurrencyService {
  private exchangeRates: Record<string, number> = {};
  private lastUpdate: Date | null = null;
  private readonly CACHE_DURATION = 60 * 60 * 1000; // 1 hour

  async getExchangeRate(
    organizationId: string,
    from: string,
    to: string
  ): Promise<number> {
    if (from === to) {
      return 1;
    }

    // Check cache
    if (this.shouldUpdateCache()) {
      await this.updateExchangeRates(organizationId);
    }

    const rate = this.exchangeRates[`${from}_${to}`];
    if (rate) {
      return rate;
    }

    // Fallback: calculate via USD
    const fromRate = this.exchangeRates[`USD_${from}`] || 1;
    const toRate = this.exchangeRates[`USD_${to}`] || 1;
    return toRate / fromRate;
  }

  async convertCurrency(
    organizationId: string,
    from: string,
    to: string,
    amount: number
  ): Promise<CurrencyConversion> {
    const rate = await this.getExchangeRate(organizationId, from, to);
    const converted = amount * rate;

    return {
      from,
      to,
      amount,
      rate,
      converted: parseFloat(converted.toFixed(2)),
    };
  }

  async updateExchangeRates(organizationId: string): Promise<void> {
    try {
      const settings = await prisma.currencySettings.findUnique({
        where: { organizationId },
      });

      const provider = settings?.exchangeRateProvider || 'openexchangerates';
      const apiKey = process.env.OPENEXCHANGERATES_API_KEY;

      if (provider === 'openexchangerates' && apiKey) {
        const response = await axios.get(
          `https://openexchangerates.org/api/latest.json?app_id=${apiKey}`
        );

        const rates = response.data.rates;
        const base = response.data.base || 'USD';

        // Store rates relative to USD
        Object.keys(rates).forEach(currency => {
          if (currency !== base) {
            this.exchangeRates[`${base}_${currency}`] = rates[currency];
            this.exchangeRates[`${currency}_${base}`] = 1 / rates[currency];
          }
        });

        // Update database
        if (settings) {
          await prisma.currencySettings.update({
            where: { organizationId },
            data: {
              rates: rates,
              lastUpdated: new Date(),
            },
          });
        }

        this.lastUpdate = new Date();
      } else {
        // Fallback to hardcoded rates (for development)
        this.exchangeRates = {
          USD_EUR: 0.85,
          EUR_USD: 1.18,
          USD_GBP: 0.73,
          GBP_USD: 1.37,
          USD_JPY: 110,
          JPY_USD: 0.0091,
        };
        this.lastUpdate = new Date();
      }
    } catch (error) {
      console.error('Error updating exchange rates:', error);
      // Use fallback rates
      this.exchangeRates = {
        USD_EUR: 0.85,
        EUR_USD: 1.18,
        USD_GBP: 0.73,
        GBP_USD: 1.37,
      };
    }
  }

  async getSupportedCurrencies(organizationId: string): Promise<string[]> {
    const settings = await prisma.currencySettings.findUnique({
      where: { organizationId },
    });

    if (settings?.supportedCurrencies) {
      return settings.supportedCurrencies;
    }

    // Default currencies
    return ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY'];
  }

  async setDefaultCurrency(
    organizationId: string,
    currency: string
  ): Promise<void> {
    await prisma.currencySettings.upsert({
      where: { organizationId },
      create: {
        organizationId,
        defaultCurrency: currency,
        supportedCurrencies: [currency],
        exchangeRateProvider: 'openexchangerates',
      },
      update: {
        defaultCurrency: currency,
      },
    });
  }

  async addSupportedCurrency(
    organizationId: string,
    currency: string
  ): Promise<void> {
    const settings = await prisma.currencySettings.findUnique({
      where: { organizationId },
    });

    if (settings) {
      const currencies = settings.supportedCurrencies || [];
      if (!currencies.includes(currency)) {
        await prisma.currencySettings.update({
          where: { organizationId },
          data: {
            supportedCurrencies: [...currencies, currency],
          },
        });
      }
    } else {
      await prisma.currencySettings.create({
        data: {
          organizationId,
          defaultCurrency: 'USD',
          supportedCurrencies: [currency],
          exchangeRateProvider: 'openexchangerates',
        },
      });
    }
  }

  private shouldUpdateCache(): boolean {
    if (!this.lastUpdate) {
      return true;
    }

    const now = new Date();
    const diff = now.getTime() - this.lastUpdate.getTime();
    return diff > this.CACHE_DURATION;
  }

  formatCurrency(amount: number, currency: string, locale: string = 'en-US'): string {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
    }).format(amount);
  }
}

