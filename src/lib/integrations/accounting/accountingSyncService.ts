import { prisma } from '@/lib/prisma';
import { QuickBooksService } from './quickbooksService';
import { XeroService } from './xeroService';

export class AccountingSyncService {
  async syncToAccounting(
    organizationId: string,
    type: 'sales' | 'expenses' | 'all' = 'all'
  ): Promise<{ success: number; failed: number }> {
    const integration = await prisma.accountingIntegration.findFirst({
      where: { organizationId },
    });

    if (!integration || !integration.isActive) {
      throw new Error('Accounting integration not found or inactive');
    }

    let service: QuickBooksService | XeroService;

    if (integration.provider === 'quickbooks') {
      if (!integration.companyId || !integration.accessToken || !integration.refreshToken) {
        throw new Error('QuickBooks integration not properly configured');
      }
      service = new QuickBooksService(
        integration.id,
        integration.companyId,
        integration.accessToken,
        integration.refreshToken
      );
    } else if (integration.provider === 'xero') {
      if (!integration.accessToken || !integration.refreshToken) {
        throw new Error('Xero integration not properly configured');
      }
      // Xero uses tenantId from settings
      const tenantId = (integration.settings as any)?.tenantId || '';
      service = new XeroService(
        integration.id,
        tenantId,
        integration.accessToken,
        integration.refreshToken
      );
    } else {
      throw new Error(`Unsupported accounting provider: ${integration.provider}`);
    }

    let totalSuccess = 0;
    let totalFailed = 0;

    if (type === 'sales' || type === 'all') {
      const result = await service.syncSales(organizationId);
      totalSuccess += result.success;
      totalFailed += result.failed;
    }

    if (type === 'expenses' || type === 'all') {
      const result = await service.syncExpenses(organizationId);
      totalSuccess += result.success;
      totalFailed += result.failed;
    }

    return { success: totalSuccess, failed: totalFailed };
  }
}

