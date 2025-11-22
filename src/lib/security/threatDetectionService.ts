import { prisma } from '@/lib/prisma';

export interface ThreatEvent {
  type: 'suspicious_login' | 'brute_force' | 'sql_injection' | 'xss' | 'rate_limit_exceeded';
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  details: any;
  timestamp: Date;
}

export class ThreatDetectionService {
  async detectThreats(
    organizationId: string,
    event: ThreatEvent
  ): Promise<{ isThreat: boolean; action: string }> {
    switch (event.type) {
      case 'suspicious_login':
        return await this.detectSuspiciousLogin(organizationId, event);
      case 'brute_force':
        return await this.detectBruteForce(organizationId, event);
      case 'sql_injection':
        return await this.detectSQLInjection(organizationId, event);
      case 'xss':
        return await this.detectXSS(organizationId, event);
      case 'rate_limit_exceeded':
        return await this.detectRateLimitExceeded(organizationId, event);
      default:
        return { isThreat: false, action: 'none' };
    }
  }

  private async detectSuspiciousLogin(
    organizationId: string,
    event: ThreatEvent
  ): Promise<{ isThreat: boolean; action: string }> {
    // Check for login from new location
    const recentLogins = await prisma.activity.findMany({
      where: {
        // organizationId doesn't exist in Activity model
        // organizationId,
        type: 'LOGIN',
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const isNewLocation = recentLogins.every(
      (login: any) => login.metadata?.location !== event.details.location
    );

    if (isNewLocation && event.details.location) {
      return {
        isThreat: true,
        action: 'require_2fa',
      };
    }

    return { isThreat: false, action: 'none' };
  }

  private async detectBruteForce(
    organizationId: string,
    event: ThreatEvent
  ): Promise<{ isThreat: boolean; action: string }> {
    // Count failed login attempts
    const failedAttempts = await prisma.activity.count({
      where: {
        // organizationId doesn't exist in Activity model
        // organizationId,
        type: 'LOGIN_FAILED',
        createdAt: {
          gte: new Date(Date.now() - 15 * 60 * 1000), // Last 15 minutes
        },
        metadata: {
          path: ['source'],
          equals: event.source,
        },
      },
    });

    if (failedAttempts >= 5) {
      return {
        isThreat: true,
        action: 'block_ip',
      };
    }

    return { isThreat: false, action: 'none' };
  }

  private detectSQLInjection(
    organizationId: string,
    event: ThreatEvent
  ): { isThreat: boolean; action: string } {
    const sqlPatterns = [
      /(\bUNION\b.*\bSELECT\b)/i,
      /(\bSELECT\b.*\bFROM\b)/i,
      /(\bINSERT\b.*\bINTO\b)/i,
      /(\bDELETE\b.*\bFROM\b)/i,
      /(\bDROP\b.*\bTABLE\b)/i,
      /('.*'|".*")/i,
      /(;.*--)/i,
    ];

    const input = String(event.details.input || '');
    const isSQLInjection = sqlPatterns.some(pattern => pattern.test(input));

    if (isSQLInjection) {
      return {
        isThreat: true,
        action: 'block_request',
      };
    }

    return { isThreat: false, action: 'none' };
  }

  private detectXSS(
    organizationId: string,
    event: ThreatEvent
  ): { isThreat: boolean; action: string } {
    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /<iframe[^>]*>.*?<\/iframe>/gi,
      /javascript:/i,
      /on\w+\s*=/i,
      /<img[^>]*src[^>]*>/gi,
    ];

    const input = String(event.details.input || '');
    const isXSS = xssPatterns.some(pattern => pattern.test(input));

    if (isXSS) {
      return {
        isThreat: true,
        action: 'sanitize_and_block',
      };
    }

    return { isThreat: false, action: 'none' };
  }

  private async detectRateLimitExceeded(
    organizationId: string,
    event: ThreatEvent
  ): Promise<{ isThreat: boolean; action: string }> {
    // Check request rate
    const recentRequests = await prisma.activity.count({
      where: {
        // organizationId doesn't exist in Activity model
        // organizationId,
        createdAt: {
          gte: new Date(Date.now() - 60 * 1000), // Last minute
        },
        metadata: {
          path: ['source'],
          equals: event.source,
        },
      },
    });

    if (recentRequests > 100) {
      return {
        isThreat: true,
        action: 'rate_limit',
      };
    }

    return { isThreat: false, action: 'none' };
  }

  async logThreat(organizationId: string, threat: ThreatEvent): Promise<void> {
    await prisma.securityEvent.create({
      data: {
        // organizationId doesn't exist in Activity model
        // organizationId,
        type: threat.type,
        severity: threat.severity,
        source: threat.source,
        details: threat.details,
        createdAt: threat.timestamp,
      },
    });
  }
}

