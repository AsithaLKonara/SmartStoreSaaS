import { prisma } from '@/lib/prisma';
import { SalesforceService } from './salesforceService';
import { HubSpotService } from './hubspotService';

export class CRMSyncService {
  async syncToCRM(
    organizationId: string,
    type: 'customers' | 'leads' | 'opportunities' | 'all' = 'all'
  ): Promise<{ success: number; failed: number }> {
    const integration = await prisma.cRMIntegration.findFirst({
      where: { organizationId },
    });

    if (!integration || !integration.isActive) {
      throw new Error('CRM integration not found or inactive');
    }

    let service: SalesforceService | HubSpotService;

    if (integration.provider === 'salesforce') {
      if (!integration.instanceUrl || !integration.accessToken || !integration.refreshToken) {
        throw new Error('Salesforce integration not properly configured');
      }
      service = new SalesforceService(
        integration.id,
        integration.instanceUrl,
        integration.accessToken,
        integration.refreshToken
      );
    } else if (integration.provider === 'hubspot') {
      if (!integration.apiKey || !integration.accessToken) {
        throw new Error('HubSpot integration not properly configured');
      }
      service = new HubSpotService(
        integration.id,
        integration.apiKey,
        integration.accessToken
      );
    } else {
      throw new Error(`Unsupported CRM provider: ${integration.provider}`);
    }

    let totalSuccess = 0;
    let totalFailed = 0;

    if (type === 'customers' || type === 'all') {
      const result = await service.syncCustomers(organizationId);
      totalSuccess += result.success;
      totalFailed += result.failed;
    }

    if (type === 'leads' || type === 'all') {
      if ('syncLeads' in service) {
        const result = await service.syncLeads(organizationId);
        totalSuccess += result.success;
        totalFailed += result.failed;
      }
    }

    if (type === 'opportunities' || type === 'all') {
      if ('syncOpportunities' in service) {
        const result = await service.syncOpportunities(organizationId);
        totalSuccess += result.success;
        totalFailed += result.failed;
      } else if ('syncDeals' in service) {
        const result = await service.syncDeals(organizationId);
        totalSuccess += result.success;
        totalFailed += result.failed;
      }
    }

    return { success: totalSuccess, failed: totalFailed };
  }
}

