import { prisma } from '@/lib/prisma';
import { realTimeSyncService } from '@/lib/sync/realTimeSyncService';
import { emailService } from '@/lib/email/emailService';
import { smsService } from '@/lib/sms/smsService';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

interface SecurityEvent {
  id?: string;
  type: 'login_attempt' | 'failed_login' | 'suspicious_activity' | 'data_access' | 'permission_change' | 'api_abuse' | 'brute_force' | 'account_lockout' | 'password_reset' | 'mfa_bypass_attempt' | 'unusual_location' | 'device_change';
  userId?: string;
  ipAddress: string;
  userAgent: string;
  details: any;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  organizationId?: string;
  location?: {
    country: string;
    region: string;
    city: string;
    coordinates?: [number, number];
  };
  deviceFingerprint?: string;
  sessionId?: string;
}

interface ThreatDetection {
  isBlocked: boolean;
  reason?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  actions: string[];
  riskScore: number;
  recommendedActions: string[];
}

interface SecurityMetrics {
  totalEvents: number;
  criticalThreats: number;
  blockedAttempts: number;
  uniqueAttackers: number;
  topThreats: Array<{
    type: string;
    count: number;
    severity: string;
  }>;
  geoDistribution: Array<{
    country: string;
    count: number;
    threatLevel: string;
  }>;
  timeline: Array<{
    timestamp: Date;
    count: number;
    severity: string;
  }>;
}

interface SecurityRule {
  id: string;
  name: string;
  type: 'rate_limit' | 'geo_block' | 'device_trust' | 'behavior_analysis' | 'ip_reputation';
  conditions: any;
  actions: Array<'block' | 'alert' | 'challenge' | 'log' | 'notify_admin'>;
  isActive: boolean;
  priority: number;
}

interface BruteForceProtection {
  maxAttempts: number;
  timeWindow: number; // in minutes
  lockoutDuration: number; // in minutes
  progressiveLockout: boolean;
}

interface DeviceFingerprint {
  userAgent: string;
  screenResolution?: string;
  timezone?: string;
  language?: string;
  platform?: string;
  plugins?: string[];
  canvas?: string;
  webgl?: string;
  hash: string;
}

interface SecurityAlert {
  id: string;
  type: 'LOGIN_ATTEMPT' | 'PERMISSION_VIOLATION' | 'SUSPICIOUS_ACTIVITY' | 'DATA_BREACH' | 'BRUTE_FORCE' | 'MALWARE_DETECTED';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  userId?: string;
  ipAddress: string;
  timestamp: Date;
  resolved: boolean;
  details: any;
  organizationId?: string;
}

export class AdvancedSecurityService {
  private bruteForceConfig: BruteForceProtection = {
    maxAttempts: 5,
    timeWindow: 15,
    lockoutDuration: 30,
    progressiveLockout: true,
  };

  private suspiciousActivityThresholds = {
    rapidRequests: 100, // requests per minute
    unusualLocation: 1000, // km from usual location
    deviceChange: 0.8, // similarity threshold
  };

  private ipWhitelist: Set<string> = new Set();
  private ipBlacklist: Set<string> = new Set();

  constructor() {
    this.initializeIpLists();
    this.loadSecurityRules();
  }

  async logSecurityEvent(event: SecurityEvent): Promise<void> {
    try {
      // Store security event in SecurityAudit table
      await prisma.securityAudit.create({
        data: {
          userId: event.userId || 'system',
          action: event.type,
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
          organizationId: event.organizationId || 'default-org', // Add missing organizationId
          metadata: {
            severity: event.severity,
            details: event.details,
            location: event.location,
            deviceFingerprint: event.deviceFingerprint,
            sessionId: event.sessionId,
            organizationId: event.organizationId
          }
        }
      });

      // Analyze threat level
      const threatDetection = await this.analyzeThreat(event);
      
      if (threatDetection.isBlocked) {
        await this.handleThreatResponse(event, threatDetection);
      }

      // Sync event for real-time monitoring
      await realTimeSyncService.queueEvent({
        id: crypto.randomUUID(),
        type: 'message', // Use a valid type
        action: 'sync', // Use a valid action
        entityId: event.userId || 'system', // Add required entityId
        organizationId: event.organizationId || 'system',
        data: { event, detection: threatDetection },
        source: 'security_service',
        timestamp: new Date()
      });

    } catch (error) {
      console.error('Error logging security event:', error);
    }
  }

  async analyzeThreat(event: SecurityEvent): Promise<ThreatDetection> {
    let riskScore = 0;
    const actions: string[] = [];
    const reasons: string[] = [];

    // Check IP reputation
    const ipReputation = await this.checkIpReputation(event.ipAddress);
    if (ipReputation.isBlacklisted) {
      riskScore += 100;
      actions.push('block');
      reasons.push(`IP ${event.ipAddress} is blacklisted: ${ipReputation.reason}`);
    } else if (ipReputation.score < 30) {
      riskScore += 50;
      actions.push('challenge');
      reasons.push(`IP ${event.ipAddress} has low reputation score: ${ipReputation.score}`);
    }

    // Check brute force attempts
    const bruteForce = await this.detectBruteForce(event);
    if (bruteForce.detected) {
      riskScore += bruteForce.score;
      actions.push('block');
      reasons.push(`Brute force detected: ${bruteForce.attempts} attempts`);
    }

    // Check behavior patterns
    const behavior = await this.analyzeBehaviorPattern(event);
    if (behavior.isAnomalous) {
      riskScore += behavior.score;
      actions.push('challenge');
      reasons.push(`Anomalous behavior: ${behavior.reasons.join(', ')}`);
    }

    // Check rate limiting
    const rateLimit = await this.checkRateLimit(event);
    if (rateLimit.exceeded) {
      riskScore += rateLimit.score;
      actions.push('block');
      reasons.push(`Rate limit exceeded: ${rateLimit.requestCount} requests`);
    }

    // Check geographical anomalies
    const geoAnomaly = await this.checkGeographicalAnomaly(event);
    if (geoAnomaly.isAnomalous) {
      riskScore += geoAnomaly.score;
      actions.push('challenge');
      reasons.push(`Geographical anomaly: ${geoAnomaly.reason}`);
    }

    // Check device fingerprint
    const deviceCheck = await this.checkDeviceFingerprint(event);
    if (deviceCheck.suspicious) {
      riskScore += deviceCheck.score;
      actions.push('challenge');
      reasons.push('Suspicious device fingerprint');
    }

    // Determine severity and actions
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (riskScore >= 80) severity = 'critical';
    else if (riskScore >= 60) severity = 'high';
    else if (riskScore >= 40) severity = 'medium';

    // Add recommended actions based on risk level
    const recommendedActions: string[] = [];
    if (riskScore >= 60) recommendedActions.push('immediate_block');
    if (riskScore >= 40) recommendedActions.push('additional_verification');
    if (riskScore >= 20) recommendedActions.push('monitor_closely');

    return {
      isBlocked: riskScore >= 80,
      reason: reasons.join('; '),
      severity,
      actions: Array.from(new Set(actions)), // Convert Set to Array to avoid iteration issues
      riskScore,
      recommendedActions
    };
  }

  private async handleThreatResponse(event: SecurityEvent, detection: ThreatDetection): Promise<void> {
    try {
      // Execute security actions
      for (const action of detection.actions) {
        await this.executeSecurityAction(action, event, detection);
      }

      // Create security alert
      await this.createSecurityAlert(event, detection);

      // Notify administrators for high/critical threats
      if (detection.severity === 'high' || detection.severity === 'critical') {
        await this.notifySystemAdministrators(event, detection);
      }

      // Update threat intelligence
      if (detection.isBlocked) {
        this.ipBlacklist.add(event.ipAddress);
      }

    } catch (error) {
      console.error('Error handling threat response:', error);
    }
  }

  private async executeSecurityAction(
    action: string,
    event: SecurityEvent,
    detection: ThreatDetection
  ): Promise<void> {
    try {
      switch (action) {
        case 'block':
          await this.blockIpAddress(event.ipAddress, event.organizationId, detection.reason);
          break;
        
        case 'challenge':
          if (event.userId) {
            await this.requireAdditionalVerification(event.userId);
          }
          break;
        
        case 'alert':
          await this.createSecurityAlert(event, detection);
          break;
        
        case 'notify_admin':
          await this.notifyAdministrators({
            id: crypto.randomUUID(),
            type: 'SUSPICIOUS_ACTIVITY',
            severity: detection.severity.toUpperCase() as any,
            message: `Security threat detected: ${detection.reason}`,
            userId: event.userId,
            ipAddress: event.ipAddress,
            timestamp: new Date(),
            resolved: false,
            details: detection,
            organizationId: event.organizationId
          });
          break;
        
        default:
          console.log(`Unknown security action: ${action}`);
      }
    } catch (error) {
      console.error(`Error executing security action ${action}:`, error);
    }
  }

  private async checkIpReputation(ipAddress: string): Promise<{ score: number; isBlacklisted: boolean; reason?: string }> {
    try {
      // Check if IP is in our blacklist
      if (this.ipBlacklist.has(ipAddress)) {
        return { score: 0, isBlacklisted: true, reason: 'IP is blacklisted' };
      }

      // Check if IP is in our whitelist
      if (this.ipWhitelist.has(ipAddress)) {
        return { score: 100, isBlacklisted: false };
      }

      // Check recent security events for this IP
      const recentEvents = await prisma.securityAudit.count({
        where: {
          ipAddress,
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        }
      });

      // Calculate reputation score based on event count
      let score = 100;
      if (recentEvents > 100) score = 10;
      else if (recentEvents > 50) score = 30;
      else if (recentEvents > 20) score = 60;
      else if (recentEvents > 10) score = 80;

      return { score, isBlacklisted: false };
    } catch (error) {
      console.error('Error checking IP reputation:', error);
      return { score: 50, isBlacklisted: false };
    }
  }

  private async detectBruteForce(event: SecurityEvent): Promise<{ detected: boolean; score: number; attempts: number }> {
    try {
      if (!event.userId) return { detected: false, score: 0, attempts: 0 };

      const timeWindow = new Date(Date.now() - this.bruteForceConfig.timeWindow * 60 * 1000);
      
      const attempts = await prisma.securityAudit.count({
        where: {
          userId: event.userId,
          action: 'login_attempt',
          createdAt: { gte: timeWindow }
        }
      });

      const detected = attempts >= this.bruteForceConfig.maxAttempts;
      const score = detected ? Math.min(attempts * 20, 100) : 0;

      return { detected, score, attempts };
    } catch (error) {
      console.error('Error detecting brute force:', error);
      return { detected: false, score: 0, attempts: 0 };
    }
  }

  private async analyzeBehaviorPattern(event: SecurityEvent): Promise<{ isAnomalous: boolean; score: number; reasons: string[] }> {
    try {
      if (!event.userId) return { isAnomalous: false, score: 0, reasons: [] };

      const reasons: string[] = [];
      let score = 0;

      // Check for rapid successive actions
      const recentActions = await prisma.securityAudit.count({
        where: {
          userId: event.userId,
          createdAt: {
            gte: new Date(Date.now() - 60 * 1000) // Last minute
          }
        }
      });

      if (recentActions > this.suspiciousActivityThresholds.rapidRequests) {
        score += 40;
        reasons.push(`Rapid actions: ${recentActions} in last minute`);
      }

      // Check for unusual time patterns
      const hour = new Date().getHours();
      if (hour < 6 || hour > 23) {
        score += 20;
        reasons.push('Unusual time of activity');
      }

      // Check for multiple failed attempts
      const failedAttempts = await prisma.securityAudit.count({
        where: {
          userId: event.userId,
          action: 'login_attempt',
          metadata: {
            not: null
          },
          createdAt: {
            gte: new Date(Date.now() - 15 * 60 * 1000) // Last 15 minutes
          }
        }
      });

      if (failedAttempts > 3) {
        score += 30;
        reasons.push(`Multiple failed attempts: ${failedAttempts}`);
      }

      const isAnomalous = score >= 30;
      return { isAnomalous, score, reasons };
    } catch (error) {
      console.error('Error analyzing behavior pattern:', error);
      return { isAnomalous: false, score: 0, reasons: [] };
    }
  }

  private async checkRateLimit(event: SecurityEvent): Promise<{ exceeded: boolean; score: number; requestCount: number }> {
    try {
      const timeWindow = new Date(Date.now() - 60 * 1000); // Last minute
      
      const requestCount = await prisma.securityAudit.count({
        where: {
          ipAddress: event.ipAddress,
          createdAt: { gte: timeWindow }
        }
      });

      const exceeded = requestCount > this.suspiciousActivityThresholds.rapidRequests;
      const score = exceeded ? Math.min(requestCount * 2, 100) : 0;

      return { exceeded, score, requestCount };
    } catch (error) {
      console.error('Error checking rate limit:', error);
      return { exceeded: false, score: 0, requestCount: 0 };
    }
  }

  private async checkGeographicalAnomaly(event: SecurityEvent): Promise<{ isAnomalous: boolean; score: number; reason?: string }> {
    try {
      if (!event.location || !event.userId) {
        return { isAnomalous: false, score: 0 };
      }

      // Get user's recent locations
      const recentEvents = await prisma.securityAudit.findMany({
        where: {
          userId: event.userId,
          metadata: {
            not: null
          },
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last week
          }
        },
        take: 10
      });

      if (recentEvents.length === 0) {
        return { isAnomalous: false, score: 0 };
      }

      // Calculate average location
      const locations = recentEvents
        .map((e: any) => (e.metadata as any)?.location)
        .filter((loc: any) => loc?.coordinates)
        .map((loc: any) => loc.coordinates);

      if (locations.length === 0) {
        return { isAnomalous: false, score: 0 };
      }

      const avgLat = locations.reduce((sum: number, loc: any) => sum + loc[0], 0) / locations.length;
      const avgLng = locations.reduce((sum: number, loc: any) => sum + loc[1], 0) / locations.length;

      // Calculate distance from average location
      const currentLocation = event.location.coordinates;
      if (!currentLocation) {
        return { isAnomalous: false, score: 0 };
      }

      const distance = this.calculateDistance(
        { lat: avgLat, lng: avgLng },
        { lat: currentLocation[0], lng: currentLocation[1] }
      );

      const isAnomalous = distance > this.suspiciousActivityThresholds.unusualLocation;
      const score = isAnomalous ? Math.min(distance / 10, 100) : 0;

      return {
        isAnomalous,
        score,
        reason: isAnomalous ? `Location ${Math.round(distance)}km from usual area` : undefined
      };
    } catch (error) {
      console.error('Error checking geographical anomaly:', error);
      return { isAnomalous: false, score: 0 };
    }
  }

  private async checkDeviceFingerprint(event: SecurityEvent): Promise<{ isNew: boolean; suspicious: boolean; score: number }> {
    try {
      if (!event.deviceFingerprint || !event.userId) {
        return { isNew: false, suspicious: false, score: 0 };
      }

      // Check if this device fingerprint is known
      const knownDevice = await prisma.securityAudit.findFirst({
        where: {
          userId: event.userId,
          metadata: {
            not: null
          }
        }
      });

      const isNew = !knownDevice;
      let score = 0;
      let suspicious = false;

      if (isNew) {
        score += 30;
        
        // Check if user has multiple recent device changes
        const recentDevices = await prisma.securityAudit.count({
          where: {
            userId: event.userId,
            metadata: {
              not: null
            },
            createdAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
            }
          }
        });

        if (recentDevices > 3) {
          score += 40;
          suspicious = true;
        }
      }

      return { isNew, suspicious, score };
    } catch (error) {
      console.error('Error checking device fingerprint:', error);
      return { isNew: false, suspicious: false, score: 0 };
    }
  }

  async getSecurityMetrics(
    organizationId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<SecurityMetrics> {
    try {
      // Get all security events in the time range
      const events = await prisma.securityAudit.findMany({
        where: {
          organizationId, // Use the direct field instead of JSON path
          createdAt: {
            gte: timeRange.start,
            lte: timeRange.end
          }
        }
      });

      // Calculate metrics
      const totalEvents = events.length;
      const criticalThreats = events.filter((e: any) => (e.metadata as any)?.severity === 'critical').length;
      const blockedAttempts = events.filter((e: any) => (e.metadata as any)?.details?.blocked === true).length;
      const uniqueAttackers = new Set(events.map((e: any) => e.ipAddress)).size;

      // Top threats by type
      const threatCounts = events.reduce((acc: any, event: any) => {
        const type = event.action;
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {});

      const topThreats = Object.entries(threatCounts)
        .map(([type, count]) => ({
          type,
          count: count as number,
          severity: (events.find((e: any) => e.action === type)?.metadata as any)?.severity || 'low'
        }))
        .sort((a, b) => (b.count as number) - (a.count as number))
        .slice(0, 10);

      // Geographical distribution
      const geoData = events
        .filter((e: any) => (e.metadata as any)?.location)
        .reduce((acc: any, event: any) => {
          const country = (event.metadata as any)?.location?.country;
          if (country) {
            acc[country] = (acc[country] || 0) + 1;
          }
          return acc;
        }, {});

      const geoDistribution = Object.entries(geoData).map(([country, data]: [string, any]) => ({
        country,
        count: data.count,
        threatLevel: data.maxSeverity || 'low'
      }));

      // Timeline data
      const timeline = this.generateTimeline(events, timeRange);

      return {
        totalEvents,
        criticalThreats,
        blockedAttempts,
        uniqueAttackers,
        topThreats,
        geoDistribution,
        timeline
      };
    } catch (error) {
      console.error('Error getting security metrics:', error);
      return {
        totalEvents: 0,
        criticalThreats: 0,
        blockedAttempts: 0,
        uniqueAttackers: 0,
        topThreats: [],
        geoDistribution: [],
        timeline: []
      };
    }
  }

  async blockIpAddress(ipAddress: string, organizationId?: string, reason?: string): Promise<void> {
    try {
      this.ipBlacklist.add(ipAddress);

      // Store blocked IP in database
      await prisma.securityAudit.create({
        data: {
          userId: 'system',
          action: 'ip_blocked',
          ipAddress,
          userAgent: 'system',
          organizationId: organizationId || 'system', // Add missing organizationId
          metadata: {
            reason,
            organizationId,
            blockedAt: new Date().toISOString()
          }
        }
      });

      // Sync event
      await realTimeSyncService.queueEvent({
        id: crypto.randomUUID(),
        type: 'message', // Use a valid type
        action: 'sync', // Use a valid action
        entityId: ipAddress, // Use IP address as entityId
        organizationId: organizationId || 'system',
        data: { ipAddress, reason, organizationId },
        source: 'security_service',
        timestamp: new Date()
      });

    } catch (error) {
      console.error('Error blocking IP address:', error);
    }
  }

  async lockUserAccount(userId: string, reason: string): Promise<void> {
    try {
      // Update user status
      await prisma.user.update({
        where: { id: userId },
        data: {
          isActive: false
          // Note: User model doesn't have metadata field, so we can't store lock info there
        }
      });

      // Log the action
      await prisma.securityAudit.create({
        data: {
          userId: 'system',
          action: 'account_locked',
          ipAddress: 'system',
          userAgent: 'system',
          organizationId: 'system', // Add missing organizationId
          metadata: {
            targetUserId: userId,
            reason,
            lockedAt: new Date().toISOString()
          }
        }
      });

      // Send notification to user
      try {
        const user = await prisma.user.findUnique({
          where: { id: userId }
        });

        if (user?.email) {
          await emailService.sendEmail({
            to: user.email,
            subject: 'Account Locked - Security Alert',
            templateId: 'account-locked',
            templateData: { reason, userId } // Use templateData instead of data
          });
        }
      } catch (emailError) {
        console.error('Error sending lock notification:', emailError);
      }

    } catch (error) {
      console.error('Error locking user account:', error);
    }
  }

  generateDeviceFingerprint(deviceData: Partial<DeviceFingerprint>): string {
    try {
      const fingerprintData = {
        userAgent: deviceData.userAgent || '',
        screenResolution: deviceData.screenResolution || '',
        timezone: deviceData.timezone || '',
        language: deviceData.language || '',
        platform: deviceData.platform || '',
        plugins: deviceData.plugins || [],
        canvas: deviceData.canvas || '',
        webgl: deviceData.webgl || ''
      };

      const fingerprintString = JSON.stringify(fingerprintData);
      const hash = crypto.createHash('sha256').update(fingerprintString).digest('hex');
      
      return hash;
    } catch (error) {
      console.error('Error generating device fingerprint:', error);
      return '';
    }
  }

  private async enhanceEventWithLocation(event: SecurityEvent): Promise<SecurityEvent> {
    try {
      // In a real implementation, you would use an IP geolocation service
      // For now, we'll return the event as-is
      return event;
    } catch (error) {
      console.error('Error enhancing event with location:', error);
      return event;
    }
  }

  private generateThreatReason(riskScore: number, actions: string[]): string {
    if (riskScore >= 80) return 'Critical security threat detected';
    if (riskScore >= 60) return 'High-risk security event';
    if (riskScore >= 40) return 'Moderate security concern';
    if (riskScore >= 20) return 'Low-risk security event';
    return 'Normal activity';
  }

  private mapEventTypeToAlertType(eventType: string): SecurityAlert['type'] {
    const mapping: Record<string, SecurityAlert['type']> = {
      'login_attempt': 'LOGIN_ATTEMPT',
      'failed_login': 'LOGIN_ATTEMPT',
      'suspicious_activity': 'SUSPICIOUS_ACTIVITY',
      'data_access': 'PERMISSION_VIOLATION',
      'permission_change': 'PERMISSION_VIOLATION',
      'api_abuse': 'SUSPICIOUS_ACTIVITY',
      'brute_force': 'BRUTE_FORCE',
      'account_lockout': 'SUSPICIOUS_ACTIVITY',
      'password_reset': 'LOGIN_ATTEMPT',
      'mfa_bypass_attempt': 'SUSPICIOUS_ACTIVITY',
      'unusual_location': 'SUSPICIOUS_ACTIVITY',
      'device_change': 'SUSPICIOUS_ACTIVITY'
    };

    return mapping[eventType] || 'SUSPICIOUS_ACTIVITY';
  }

  private async isKnownMaliciousIp(ipAddress: string): Promise<boolean> {
    // In a real implementation, you would check against threat intelligence feeds
    return this.ipBlacklist.has(ipAddress);
  }

  private async createSecurityAlert(event: SecurityEvent, detection: ThreatDetection): Promise<void> {
    try {
      await prisma.securityAlert.create({
        data: {
          type: this.mapEventTypeToAlertType(event.type),
          message: `Security threat detected: ${detection.reason}`,
          severity: detection.severity.toUpperCase() as any,
          organizationId: event.organizationId || 'system', // Add missing organizationId
          metadata: {
            userId: event.userId,
            ipAddress: event.ipAddress, // Store IP address in metadata instead
            details: JSON.parse(JSON.stringify(detection)), // Convert to plain object for JSON compatibility
            organizationId: event.organizationId
          }
        }
      });
    } catch (error) {
      console.error('Error creating security alert:', error);
    }
  }

  private async requireAdditionalVerification(userId: string): Promise<void> {
    try {
      // In a real implementation, you would trigger additional verification
      // such as SMS verification, email verification, or CAPTCHA
      console.log(`Additional verification required for user ${userId}`);
    } catch (error) {
      console.error('Error requiring additional verification:', error);
    }
  }

  private async notifyAdministrators(alert: SecurityAlert): Promise<void> {
    try {
      // Find admin users
      const admins = await prisma.user.findMany({
        where: { role: 'ADMIN' }
      });

      // Send notifications to admins
      for (const admin of admins) {
        try {
          if (admin.email) {
            await emailService.sendEmail({
              to: admin.email,
              subject: `Security Alert: ${alert.severity}`,
              templateId: 'security-alert',
              templateData: { alert, admin } // Use templateData instead of data
            });
          }
        } catch (emailError) {
          console.error(`Error sending email to admin ${admin.email}:`, emailError);
        }
      }
    } catch (error) {
      console.error('Error notifying administrators:', error);
    }
  }

  private async notifySystemAdministrators(event: SecurityEvent, detection: ThreatDetection): Promise<void> {
    try {
      // Send SMS alerts for critical threats
      if (detection.severity === 'critical') {
        // In a real implementation, you would send SMS to system administrators
        console.log(`Critical threat SMS alert: ${detection.reason}`);
      }

      // Send email alerts
      await this.notifyAdministrators({
        id: crypto.randomUUID(),
        type: 'SUSPICIOUS_ACTIVITY',
        severity: detection.severity.toUpperCase() as any,
        message: `Critical security threat: ${detection.reason}`,
        userId: event.userId,
        ipAddress: event.ipAddress,
        timestamp: new Date(),
        resolved: false,
        details: detection,
        organizationId: event.organizationId
      });

    } catch (error) {
      console.error('Error notifying system administrators:', error);
    }
  }

  private calculateDistance(loc1: any, loc2: any): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.deg2rad(loc2.lat - loc1.lat);
    const dLng = this.deg2rad(loc2.lng - loc1.lng);
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(this.deg2rad(loc1.lat)) * Math.cos(this.deg2rad(loc2.lat)) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI/180);
  }

  private getSeverityWeight(severity: string): number {
    const weights: Record<string, number> = {
      'low': 1,
      'medium': 3,
      'high': 7,
      'critical': 15
    };
    return weights[severity] || 1;
  }

  private generateTimeline(events: any[], timeRange: { start: Date; end: Date }): any[] {
    try {
      const timeline: any[] = [];
      const interval = 60 * 60 * 1000; // 1 hour intervals
      
      for (let time = timeRange.start.getTime(); time <= timeRange.end.getTime(); time += interval) {
        const intervalStart = new Date(time);
        const intervalEnd = new Date(time + interval);
        
        const eventsInInterval = events.filter(event => 
          event.createdAt >= intervalStart && event.createdAt < intervalEnd
        );
        
        if (eventsInInterval.length > 0) {
          const maxSeverity = eventsInInterval.reduce((max, event) => {
            const severity = (event.metadata as any)?.severity || 'low';
            return this.getSeverityWeight(severity) > this.getSeverityWeight(max) ? severity : max;
          }, 'low');
          
          timeline.push({
            timestamp: intervalStart,
            count: eventsInInterval.length,
            severity: maxSeverity
          });
        }
      }
      
      return timeline;
    } catch (error) {
      console.error('Error generating timeline:', error);
      return [];
    }
  }

  private async loadSecurityRules(): Promise<void> {
    try {
      // In a real implementation, you would load security rules from database
      // For now, we'll use default rules
      console.log('Loading security rules...');
    } catch (error) {
      console.error('Error loading security rules:', error);
    }
  }

  private initializeIpLists(): void {
    // Initialize with some default IPs
    this.ipWhitelist.add('127.0.0.1');
    this.ipWhitelist.add('::1');
    
    // Convert Set to Array for iteration
    const whitelistArray = Array.from(this.ipWhitelist);
    const blacklistArray = Array.from(this.ipBlacklist);
    
    console.log('IP Whitelist initialized:', whitelistArray);
    console.log('IP Blacklist initialized:', blacklistArray);
  }
}
