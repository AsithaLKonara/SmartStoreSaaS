import { prisma } from '@/lib/prisma';
import axios, { AxiosInstance } from 'axios';

export class HubSpotService {
  private client: AxiosInstance;
  private integrationId: string;
  private apiKey: string;
  private accessToken: string;

  constructor(
    integrationId: string,
    apiKey: string,
    accessToken: string
  ) {
    this.integrationId = integrationId;
    this.apiKey = apiKey;
    this.accessToken = accessToken;

    this.client = axios.create({
      baseURL: 'https://api.hubapi.com',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      params: {
        hapikey: apiKey,
      },
    });
  }

  async syncCustomers(organizationId: string): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    try {
      const customers = await prisma.customer.findMany({
        where: { organizationId },
        include: {
          orders: true,
        },
      });

      for (const customer of customers) {
        try {
          await this.createOrUpdateContact(customer);
          success++;
        } catch (error) {
          console.error(`Failed to sync customer ${customer.id}:`, error);
          failed++;
        }
      }

      await prisma.crmIntegration.update({
        where: { id: this.integrationId },
        data: { lastSync: new Date() },
      });

      return { success, failed };
    } catch (error) {
      console.error('Error syncing customers to HubSpot:', error);
      throw error;
    }
  }

  private async createOrUpdateContact(customer: any): Promise<void> {
    const contact = {
      properties: {
        firstname: customer.name?.split(' ')[0] || '',
        lastname: customer.name?.split(' ').slice(1).join(' ') || customer.name || 'Customer',
        email: customer.email || '',
        phone: customer.phone || '',
        smartstore_id: customer.id,
        total_revenue: customer.orders.reduce((sum: number, order: any) => sum + order.totalAmount, 0),
        num_orders: customer.orders.length,
      },
    };

    // Check if contact exists
    try {
      const existing = await this.client.get(
        `/crm/v3/objects/contacts/${customer.email || customer.id}`
      );
      
      // Update existing contact
      await this.client.patch(
        `/crm/v3/objects/contacts/${existing.data.id}`,
        contact
      );
    } catch (error: any) {
      if (error.response?.status === 404) {
        // Create new contact
        await this.client.post('/crm/v3/objects/contacts', contact);
      } else {
        throw error;
      }
    }
  }

  async syncDeals(organizationId: string): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    const orders = await prisma.order.findMany({
      where: {
        organizationId,
        status: 'PENDING',
      },
      include: {
        customer: true,
      },
    });

    for (const order of orders) {
      try {
        await this.createDeal(order);
        success++;
      } catch (error) {
        console.error(`Failed to sync deal ${order.id}:`, error);
        failed++;
      }
    }

    return { success, failed };
  }

  private async createDeal(order: any): Promise<void> {
    // Get contact ID
    const contact = await this.client.get(
      `/crm/v3/objects/contacts/${order.customer.email || order.customerId}`
    );

    const deal = {
      properties: {
        dealname: `Order ${order.orderNumber}`,
        amount: String(order.totalAmount),
        dealstage: 'appointmentscheduled',
        pipeline: 'default',
        closedate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        smartstore_id: order.id,
      },
      associations: [
        {
          to: {
            id: contact.data.id,
          },
          types: [
            {
              associationCategory: 'HUBSPOT_DEFINED',
              associationTypeId: 3, // Contact to Deal association
            },
          ],
        },
      ],
    };

    await this.client.post('/crm/v3/objects/deals', deal);
  }
}

