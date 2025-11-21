import { prisma } from '@/lib/prisma';
import axios, { AxiosInstance } from 'axios';

export class QuickBooksService {
  private client: AxiosInstance;
  private integrationId: string;
  private companyId: string;
  private accessToken: string;
  private refreshToken: string;

  constructor(
    integrationId: string,
    companyId: string,
    accessToken: string,
    refreshToken: string
  ) {
    this.integrationId = integrationId;
    this.companyId = companyId;
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;

    this.client = axios.create({
      baseURL: `https://sandbox-quickbooks.api.intuit.com/v3/company/${companyId}`,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });
  }

  async syncSales(organizationId: string): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    try {
      // Get orders from SmartStore
      const orders = await prisma.order.findMany({
        where: {
          organizationId,
          status: { in: ['CONFIRMED', 'COMPLETED'] },
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      for (const order of orders) {
        try {
          // Create invoice in QuickBooks
          await this.createInvoice(order);
          success++;
        } catch (error) {
          console.error(`Failed to sync order ${order.id}:`, error);
          failed++;
        }
      }

      await prisma.accountingIntegration.update({
        where: { id: this.integrationId },
        data: { lastSync: new Date() },
      });

      return { success, failed };
    } catch (error) {
      console.error('Error syncing sales to QuickBooks:', error);
      throw error;
    }
  }

  private async createInvoice(order: any): Promise<void> {
    const lineItems = order.items.map((item: any) => ({
      DetailType: 'SalesItemLineDetail',
      Amount: item.total,
      SalesItemLineDetail: {
        ItemRef: {
          value: item.product.sku || '1',
          name: item.product.name,
        },
        UnitPrice: item.price,
        Qty: item.quantity,
      },
      LineNum: order.items.indexOf(item) + 1,
      Description: item.product.name,
    }));

    const invoice = {
      Line: lineItems,
      CustomerRef: {
        value: order.customerId,
      },
      TxnDate: order.createdAt.toISOString().split('T')[0],
      DueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      TotalAmt: order.totalAmount,
      CurrencyRef: {
        value: order.currency || 'USD',
      },
    };

    await this.client.post('/invoice', invoice);
  }

  async syncExpenses(organizationId: string): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    try {
      const expenses = await prisma.expense.findMany({
        where: { organizationId },
      });

      for (const expense of expenses) {
        try {
          await this.createExpense(expense);
          success++;
        } catch (error) {
          console.error(`Failed to sync expense ${expense.id}:`, error);
          failed++;
        }
      }

      return { success, failed };
    } catch (error) {
      console.error('Error syncing expenses to QuickBooks:', error);
      throw error;
    }
  }

  private async createExpense(expense: any): Promise<void> {
    const purchase = {
      Line: [
        {
          Amount: expense.amount,
          DetailType: 'AccountBasedExpenseLineDetail',
          AccountBasedExpenseLineDetail: {
            AccountRef: {
              value: expense.category || '1',
            },
          },
        },
      ],
      PaymentType: 'Cash',
      TxnDate: expense.date.toISOString().split('T')[0],
      TotalAmt: expense.amount,
    };

    await this.client.post('/purchase', purchase);
  }

  async refreshAccessToken(): Promise<string> {
    const response = await axios.post(
      'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
      {
        grant_type: 'refresh_token',
        refresh_token: this.refreshToken,
      },
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        auth: {
          username: process.env.QUICKBOOKS_CLIENT_ID || '',
          password: process.env.QUICKBOOKS_CLIENT_SECRET || '',
        },
      }
    );

    const newAccessToken = response.data.access_token;
    const newRefreshToken = response.data.refresh_token;

    await prisma.accountingIntegration.update({
      where: { id: this.integrationId },
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      },
    });

    return newAccessToken;
  }
}

