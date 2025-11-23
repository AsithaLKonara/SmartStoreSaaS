import { prisma } from '@/lib/prisma';

export interface RegionConfig {
  region: string;
  dataCenter: string;
  cdn: string;
  compliance: string[];
  currency: string;
  language: string;
  timezone: string;
}

export class RegionService {
  async getRegionConfig(organizationId: string): Promise<RegionConfig | null> {
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      return null;
    }

    // Get region from organization settings or default
    const settings = organization.settings as Record<string, unknown>;
    const region = settings?.region || 'us-east-1';

    return this.getRegionConfigByRegion(region);
  }

  getRegionConfigByRegion(region: string): RegionConfig {
    const configs: Record<string, RegionConfig> = {
      'us-east-1': {
        region: 'us-east-1',
        dataCenter: 'Virginia, USA',
        cdn: 'cloudfront',
        compliance: ['SOC2', 'GDPR'],
        currency: 'USD',
        language: 'en',
        timezone: 'America/New_York',
      },
      'eu-west-1': {
        region: 'eu-west-1',
        dataCenter: 'Ireland',
        cdn: 'cloudfront',
        compliance: ['GDPR', 'SOC2'],
        currency: 'EUR',
        language: 'en',
        timezone: 'Europe/Dublin',
      },
      'ap-southeast-1': {
        region: 'ap-southeast-1',
        dataCenter: 'Singapore',
        cdn: 'cloudfront',
        compliance: ['PDPA'],
        currency: 'SGD',
        language: 'en',
        timezone: 'Asia/Singapore',
      },
    };

    return configs[region] || configs['us-east-1'];
  }

  async setRegion(organizationId: string, region: string): Promise<void> {
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new Error('Organization not found');
    }

    const settings = (organization.settings as Record<string, unknown>) || {};
    settings.region = region;

    await prisma.organization.update({
      where: { id: organizationId },
      data: { settings },
    });
  }

  async getCDNUrl(organizationId: string, path: string): Promise<string> {
    const config = await this.getRegionConfig(organizationId);
    if (!config) {
      return path;
    }

    // In production, this would generate CDN URLs based on region
    const cdnDomain = process.env.CDN_DOMAIN || 'cdn.smartstore.ai';
    return `https://${cdnDomain}/${config.region}${path}`;
  }

  async getRegionalDataCenter(region: string): Promise<string> {
    const config = this.getRegionConfigByRegion(region);
    return config.dataCenter;
  }

  async getComplianceRequirements(region: string): Promise<string[]> {
    const config = this.getRegionConfigByRegion(region);
    return config.compliance;
  }
}

