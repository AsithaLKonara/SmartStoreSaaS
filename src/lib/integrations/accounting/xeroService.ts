import { prisma } from '@/lib/prisma';
import axios, { AxiosInstance } from 'axios';

export class XeroService {
  private client: AxiosInstance;
  private integrationId: string;
  private tenantId: string;
  private accessToken: string;
  private refreshToken: string;

  constructor(
    integrationId: string,
    tenantId: string,
    accessToken: string,
    refreshToken: string
  ) {
    this.integrationId = integrationId;
    this.tenantId = tenantId;
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;

    this.client = axios.create({
      baseURL: 'https://api.xero.com/api.xro/2.0',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Xero-tenant-id': tenantId,
        'Content-Type': 'application/json',
      },
    });
  }

  async syncSales(organizationId: string): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    try {
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
      console.error('Error syncing sales to Xero:', error);
      throw error;
    }
  }

  private async createInvoice(order: { items: Array<{ name?: string; quantity?: number; price?: number }>; totalAmount?: number; orderNumber?: string; customer?: { name?: string; email?: string } }): Promise<void> {
    const lineItems = order.items.map((item: { name?: string; quantity?: number; price?: number }) => ({
      Description: item.product.name,
      Quantity: item.quantity,
      UnitAmount: item.price,
      AccountCode: '200', // Sales account code
      TaxType: 'NONE',
    }));

    const invoice = {
      Type: 'ACCREC',
      Contact: {
        ContactID: order.customerId,
      },
      Date: order.createdAt.toISOString().split('T')[0],
      DueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      LineItems: lineItems,
      Status: 'AUTHORISED',
      Total: order.totalAmount,
      CurrencyCode: order.currency || 'USD',
    };

    await this.client.post('/Invoices', { Invoices: [invoice] });
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
      console.error('Error syncing expenses to Xero:', error);
      throw error;
    }
  }

  private async createExpense(expense: { amount?: number; description?: string; category?: string; date?: Date }): Promise<void> {
    const payment = {
      Invoice: {
        Type: 'ACCPAY',
        Contact: {
          ContactID: expense.vendorId || '1',
        },
        Date: expense.date.toISOString().split('T')[0],
        DueDate: expense.date.toISOString().split('T')[0],
        LineItems: [
          {
            Description: expense.description,
            Quantity: 1,
            UnitAmount: expense.amount,
            AccountCode: expense.category || '400',
          },
        ],
        Total: expense.amount,
      },
    };

    await this.client.post('/Payments', { Payments: [payment] });
  }

  async refreshAccessToken(): Promise<string> {
    const response = await axios.post(
      'https://identity.xero.com/connect/token',
      {
        grant_type: 'refresh_token',
        refresh_token: this.refreshToken,
      },
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        auth: {
          username: process.env.XERO_CLIENT_ID || '',
          password: process.env.XERO_CLIENT_SECRET || '',
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

