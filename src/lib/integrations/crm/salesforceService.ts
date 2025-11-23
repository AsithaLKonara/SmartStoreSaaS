import { prisma } from '@/lib/prisma';
import axios, { AxiosInstance } from 'axios';

export class SalesforceService {
  private client: AxiosInstance;
  private integrationId: string;
  private instanceUrl: string;
  private accessToken: string;
  private refreshToken: string;

  constructor(
    integrationId: string,
    instanceUrl: string,
    accessToken: string,
    refreshToken: string
  ) {
    this.integrationId = integrationId;
    this.instanceUrl = instanceUrl;
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;

    this.client = axios.create({
      baseURL: instanceUrl,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
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

      await prisma.cRMIntegration.update({
        where: { id: this.integrationId },
        data: { lastSync: new Date() },
      });

      return { success, failed };
    } catch (error) {
      console.error('Error syncing customers to Salesforce:', error);
      throw error;
    }
  }

  private async createOrUpdateContact(customer: { name?: string; email?: string; phone?: string }): Promise<void> {
    const contact = {
      FirstName: customer.name?.split(' ')[0] || '',
      LastName: customer.name?.split(' ').slice(1).join(' ') || customer.name || 'Customer',
      Email: customer.email || '',
      Phone: customer.phone || '',
      MailingStreet: customer.address || '',
      AccountId: null, // Would link to account if exists
      SmartStoreId__c: customer.id, // Custom field to store SmartStore ID
    };

    // Check if contact exists
    const existing = await this.client.get(
      `/services/data/v57.0/query/?q=SELECT Id FROM Contact WHERE SmartStoreId__c='${customer.id}'`
    );

    if (existing.data.records && existing.data.records.length > 0) {
      // Update existing contact
      await this.client.patch(
        `/services/data/v57.0/sobjects/Contact/${existing.data.records[0].Id}`,
        contact
      );
    } else {
      // Create new contact
      await this.client.post('/services/data/v57.0/sobjects/Contact', contact);
    }
  }

  async syncLeads(organizationId: string): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    // Get potential customers (customers with no orders)
    const leads = await prisma.customer.findMany({
      where: {
        organizationId,
        orders: {
          none: {},
        },
      },
    });

    for (const lead of leads) {
      try {
        await this.createLead(lead);
        success++;
      } catch (error) {
        console.error(`Failed to sync lead ${lead.id}:`, error);
        failed++;
      }
    }

    return { success, failed };
  }

  private async createLead(lead: { name?: string; email?: string; company?: string }): Promise<void> {
    const salesforceLead = {
      FirstName: lead.name?.split(' ')[0] || '',
      LastName: lead.name?.split(' ').slice(1).join(' ') || lead.name || 'Lead',
      Email: lead.email || '',
      Phone: lead.phone || '',
      Company: lead.organizationId || 'Unknown',
      LeadSource: 'SmartStore',
      SmartStoreId__c: lead.id,
    };

    await this.client.post('/services/data/v57.0/sobjects/Lead', salesforceLead);
  }

  async syncOpportunities(organizationId: string): Promise<{ success: number; failed: number }> {
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
        await this.createOpportunity(order);
        success++;
      } catch (error) {
        console.error(`Failed to sync opportunity ${order.id}:`, error);
        failed++;
      }
    }

    return { success, failed };
  }

  private async createOpportunity(order: { totalAmount?: number; orderNumber?: string; customer?: { name?: string } }): Promise<void> {
    // Get contact ID
    const contact = await this.client.get(
      `/services/data/v57.0/query/?q=SELECT Id FROM Contact WHERE SmartStoreId__c='${order.customerId}'`
    );

    const opportunity = {
      Name: `Order ${order.orderNumber}`,
      Amount: order.totalAmount,
      StageName: 'Prospecting',
      CloseDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      ContactId: contact.data.records?.[0]?.Id || null,
      SmartStoreId__c: order.id,
    };

    await this.client.post('/services/data/v57.0/sobjects/Opportunity', opportunity);
  }

  async refreshAccessToken(): Promise<string> {
    const response = await axios.post(
      'https://login.salesforce.com/services/oauth2/token',
      {
        grant_type: 'refresh_token',
        refresh_token: this.refreshToken,
        client_id: process.env.SALESFORCE_CLIENT_ID || '',
        client_secret: process.env.SALESFORCE_CLIENT_SECRET || '',
      }
    );

    const newAccessToken = response.data.access_token;

    await prisma.cRMIntegration.update({
      where: { id: this.integrationId },
      data: {
        accessToken: newAccessToken,
      },
    });

    return newAccessToken;
  }
}

