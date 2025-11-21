import axios from 'axios';

export interface BNPLProvider {
  name: 'klarna' | 'afterpay' | 'affirm' | 'paypal_pay_later';
  apiKey: string;
  apiSecret: string;
  environment: 'sandbox' | 'production';
}

export interface BNPLSession {
  sessionId: string;
  provider: string;
  amount: number;
  currency: string;
  status: 'pending' | 'approved' | 'rejected';
  checkoutUrl?: string;
}

export class BuyNowPayLaterService {
  async createSession(
    provider: BNPLProvider,
    amount: number,
    currency: string,
    orderId: string,
    customerInfo: any
  ): Promise<BNPLSession> {
    switch (provider.name) {
      case 'klarna':
        return await this.createKlarnaSession(provider, amount, currency, orderId, customerInfo);
      case 'afterpay':
        return await this.createAfterpaySession(provider, amount, currency, orderId, customerInfo);
      case 'affirm':
        return await this.createAffirmSession(provider, amount, currency, orderId, customerInfo);
      case 'paypal_pay_later':
        return await this.createPayPalPayLaterSession(provider, amount, currency, orderId, customerInfo);
      default:
        throw new Error(`Unsupported BNPL provider: ${provider.name}`);
    }
  }

  private async createKlarnaSession(
    provider: BNPLProvider,
    amount: number,
    currency: string,
    orderId: string,
    customerInfo: any
  ): Promise<BNPLSession> {
    const baseUrl = provider.environment === 'production'
      ? 'https://api.klarna.com'
      : 'https://api.klarna.com';

    const response = await axios.post(
      `${baseUrl}/payments/v1/sessions`,
      {
        purchase_country: customerInfo.country || 'US',
        purchase_currency: currency,
        locale: customerInfo.locale || 'en-US',
        order_amount: Math.round(amount * 100), // Convert to cents
        order_lines: [
          {
            name: `Order ${orderId}`,
            quantity: 1,
            unit_price: Math.round(amount * 100),
            total_amount: Math.round(amount * 100),
          },
        ],
        billing_address: customerInfo.billingAddress,
        shipping_address: customerInfo.shippingAddress,
      },
      {
        auth: {
          username: provider.apiKey,
          password: provider.apiSecret,
        },
      }
    );

    return {
      sessionId: response.data.session_id,
      provider: 'klarna',
      amount,
      currency,
      status: 'pending',
      checkoutUrl: response.data.redirect_url,
    };
  }

  private async createAfterpaySession(
    provider: BNPLProvider,
    amount: number,
    currency: string,
    orderId: string,
    customerInfo: any
  ): Promise<BNPLSession> {
    const baseUrl = provider.environment === 'production'
      ? 'https://api.afterpay.com'
      : 'https://api-sandbox.afterpay.com';

    const response = await axios.post(
      `${baseUrl}/v2/checkouts`,
      {
        amount: {
          amount: amount.toFixed(2),
          currency,
        },
        consumer: {
          phoneNumber: customerInfo.phone,
          givenNames: customerInfo.firstName,
          surname: customerInfo.lastName,
          email: customerInfo.email,
        },
        shipping: customerInfo.shippingAddress,
        billing: customerInfo.billingAddress,
        merchant: {
          redirectConfirmUrl: `${process.env.NEXTAUTH_URL}/checkout/confirm`,
          redirectCancelUrl: `${process.env.NEXTAUTH_URL}/checkout/cancel`,
        },
      },
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${provider.apiKey}:${provider.apiSecret}`).toString('base64')}`,
        },
      }
    );

    return {
      sessionId: response.data.id,
      provider: 'afterpay',
      amount,
      currency,
      status: 'pending',
      checkoutUrl: response.data.redirectCheckoutUrl,
    };
  }

  private async createAffirmSession(
    provider: BNPLProvider,
    amount: number,
    currency: string,
    orderId: string,
    customerInfo: any
  ): Promise<BNPLSession> {
    const baseUrl = provider.environment === 'production'
      ? 'https://api.affirm.com'
      : 'https://api.sandbox.affirm.com';

    const response = await axios.post(
      `${baseUrl}/api/v2/checkout`,
      {
        merchant: {
          public_api_key: provider.apiKey,
        },
        order_id: orderId,
        shipping: {
          name: {
            first: customerInfo.firstName,
            last: customerInfo.lastName,
          },
          address: customerInfo.shippingAddress,
        },
        billing: {
          name: {
            first: customerInfo.firstName,
            last: customerInfo.lastName,
          },
          address: customerInfo.billingAddress,
        },
        items: [
          {
            display_name: `Order ${orderId}`,
            sku: orderId,
            unit_price: Math.round(amount * 100),
            qty: 1,
          },
        ],
        total: Math.round(amount * 100),
        metadata: {
          order_id: orderId,
        },
      },
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${provider.apiKey}:${provider.apiSecret}`).toString('base64')}`,
        },
      }
    );

    return {
      sessionId: response.data.checkout_id,
      provider: 'affirm',
      amount,
      currency,
      status: 'pending',
      checkoutUrl: response.data.redirect_url,
    };
  }

  private async createPayPalPayLaterSession(
    provider: BNPLProvider,
    amount: number,
    currency: string,
    orderId: string,
    customerInfo: any
  ): Promise<BNPLSession> {
    // PayPal Pay Later uses PayPal Orders API
    const baseUrl = provider.environment === 'production'
      ? 'https://api.paypal.com'
      : 'https://api.sandbox.paypal.com';

    // First get access token
    const tokenResponse = await axios.post(
      `${baseUrl}/v1/oauth2/token`,
      'grant_type=client_credentials',
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        auth: {
          username: provider.apiKey,
          password: provider.apiSecret,
        },
      }
    );

    const accessToken = tokenResponse.data.access_token;

    // Create order with Pay Later option
    const orderResponse = await axios.post(
      `${baseUrl}/v2/checkout/orders`,
      {
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: orderId,
            amount: {
              currency_code: currency,
              value: amount.toFixed(2),
            },
          },
        ],
        payment_source: {
          paypal: {
            experience_context: {
              payment_method_preference: 'PAY_LATER',
            },
          },
        },
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    return {
      sessionId: orderResponse.data.id,
      provider: 'paypal_pay_later',
      amount,
      currency,
      status: 'pending',
      checkoutUrl: orderResponse.data.links?.find((link: any) => link.rel === 'approve')?.href,
    };
  }

  async confirmSession(
    provider: BNPLProvider,
    sessionId: string,
    token?: string
  ): Promise<{ status: string; transactionId?: string }> {
    // Implementation would confirm the BNPL session
    // This varies by provider
    return {
      status: 'approved',
      transactionId: sessionId,
    };
  }
}

