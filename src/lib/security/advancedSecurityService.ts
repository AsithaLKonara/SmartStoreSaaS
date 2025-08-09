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
    unusualHours: { start: 2, end: 5 }, // 2 AM to 5 AM
    multipleLocations: 2, // different countries in same session
    deviceChanges: 3, // device changes per day
  };

  private ipWhitelist: Set<string> = new Set();
  private ipBlacklist: Set<string> = new Set();

  constructor() {
    this.loadSecurityRules();
    this.initializeIpLists();
  }

  /**
   * Log security event
   */
  async logSecurityEvent(event: SecurityEvent): Promise<void> {
    try {
      // Enhance event with location data
      const enhancedEvent = await this.enhanceEventWithLocation(event);

      // Store in database
      await prisma.securityEvent.create({
        data: {
          type: enhancedEvent.type,
          userId: enhancedEvent.userId,
          ipAddress: enhancedEvent.ipAddress,
          userAgent: enhancedEvent.userAgent,
          details: enhancedEvent.details,
          severity: enhancedEvent.severity,
          timestamp: enhancedEvent.timestamp,
          organizationId: enhancedEvent.organizationId,
          location: enhancedEvent.location,
          deviceFingerprint: enhancedEvent.deviceFingerprint,
          sessionId: enhancedEvent.sessionId,
        },
      });

      // Broadcast real-time event for critical threats
      if (enhancedEvent.severity === 'critical' || enhancedEvent.severity === 'high') {
        await realTimeSyncService.broadcastEvent({
          type: 'security_alert',
          entityId: enhancedEvent.id || crypto.randomUUID(),
          entityType: 'security_event',
          organizationId: enhancedEvent.organizationId || 'system',
          data: enhancedEvent,
          timestamp: new Date(),
        });
      }

      // Process threat detection
      const threatDetection = await this.analyzeThreat(enhancedEvent);
      
      if (threatDetection.isBlocked || threatDetection.severity === 'critical') {
        await this.handleThreatResponse(enhancedEvent, threatDetection);
      }
    } catch (error) {
      console.error('Error logging security event:', error);
    }
  }

  /**
   * Analyze incoming requests for threats
   */
  async analyzeThreat(event: SecurityEvent): Promise<ThreatDetection> {
    let riskScore = 0;
    const actions: string[] = [];
    const recommendedActions: string[] = [];
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';

    try {
      // Check IP reputation
      const ipRisk = await this.checkIpReputation(event.ipAddress);
      riskScore += ipRisk.score;

      if (ipRisk.isBlacklisted) {
        actions.push('block');
        severity = 'high';
        recommendedActions.push('Block IP permanently');
      }

      // Check for brute force attacks
      const bruteForceRisk = await this.detectBruteForce(event);
      riskScore += bruteForceRisk.score;

      if (bruteForceRisk.detected) {
        actions.push('block', 'alert');
        severity = 'high';
        recommendedActions.push('Implement progressive lockout');
      }

      // Check for unusual activity patterns
      const behaviorRisk = await this.analyzeBehaviorPattern(event);
      riskScore += behaviorRisk.score;

      if (behaviorRisk.isAnomalous) {
        actions.push('challenge', 'log');
        severity = severity === 'low' ? 'medium' : severity;
        recommendedActions.push('Require additional verification');
      }

      // Check for rapid requests (DDoS/API abuse)
      const rateRisk = await this.checkRateLimit(event);
      riskScore += rateRisk.score;

      if (rateRisk.exceeded) {
        actions.push('block', 'alert');
        severity = 'high';
        recommendedActions.push('Implement rate limiting');
      }

      // Check for geographical anomalies
      const geoRisk = await this.checkGeographicalAnomaly(event);
      riskScore += geoRisk.score;

      if (geoRisk.isAnomalous) {
        actions.push('challenge');
        severity = severity === 'low' ? 'medium' : severity;
        recommendedActions.push('Verify user location');
      }

      // Check device fingerprint changes
      const deviceRisk = await this.checkDeviceFingerprint(event);
      riskScore += deviceRisk.score;

      if (deviceRisk.isNew && deviceRisk.suspicious) {
        actions.push('challenge', 'alert');
        severity = severity === 'low' ? 'medium' : severity;
        recommendedActions.push('Verify device ownership');
      }

      // Determine final severity and blocking decision
      if (riskScore >= 80) {
        severity = 'critical';
        actions.push('block', 'alert', 'notify_admin');
      } else if (riskScore >= 60) {
        severity = 'high';
        actions.push('challenge', 'alert');
      } else if (riskScore >= 40) {
        severity = 'medium';
        actions.push('log', 'challenge');
      }

      return {
        isBlocked: actions.includes('block'),
        reason: this.generateThreatReason(riskScore, actions),
        severity,
        actions: [...new Set(actions)], // Remove duplicates
        riskScore,
        recommendedActions: [...new Set(recommendedActions)],
      };
    } catch (error) {
      console.error('Error analyzing threat:', error);
      return {
        isBlocked: false,
        severity: 'low',
        actions: ['log'],
        riskScore: 0,
        recommendedActions: [],
      };
    }
  }

  /**
   * Handle threat response
   */
  private async handleThreatResponse(event: SecurityEvent, detection: ThreatDetection): Promise<void> {
    try {
      // Create security alert
      const alert: SecurityAlert = {
        id: crypto.randomUUID(),
        type: this.mapEventTypeToAlertType(event.type),
        severity: detection.severity.toUpperCase() as SecurityAlert['severity'],
        message: `${detection.reason} (Risk Score: ${detection.riskScore})`,
        userId: event.userId,
        ipAddress: event.ipAddress,
        timestamp: new Date(),
        resolved: false,
        details: {
          event,
          detection,
          actions: detection.actions,
          recommendedActions: detection.recommendedActions,
        },
        organizationId: event.organizationId,
      };

      // Store alert
      await prisma.securityAlert.create({
        data: alert,
      });

      // Execute automated responses
      for (const action of detection.actions) {
        await this.executeSecurityAction(action, event, detection);
      }

      // Notify administrators for high-severity threats
      if (detection.severity === 'critical' || detection.severity === 'high') {
        await this.notifyAdministrators(alert);
      }
    } catch (error) {
      console.error('Error handling threat response:', error);
    }
  }

  /**
   * Execute security action
   */
  private async executeSecurityAction(
    action: string,
    event: SecurityEvent,
    detection: ThreatDetection
  ): Promise<void> {
    try {
      switch (action) {
        case 'block':
          await this.blockIpAddress(event.ipAddress, event.organizationId);
          if (event.userId) {
            await this.lockUserAccount(event.userId, 'Security threat detected');
          }
          break;

        case 'challenge':
          if (event.userId) {
            await this.requireAdditionalVerification(event.userId);
          }
          break;

        case 'alert':
          await this.createSecurityAlert(event, detection);
          break;

        case 'log':
          // Already logged in logSecurityEvent
          break;

        case 'notify_admin':
          await this.notifySystemAdministrators(event, detection);
          break;

        default:
          console.warn(`Unknown security action: ${action}`);
      }
    } catch (error) {
      console.error(`Error executing security action ${action}:`, error);
    }
  }

  /**
   * Check IP reputation
   */
  private async checkIpReputation(ipAddress: string): Promise<{ score: number; isBlacklisted: boolean; reason?: string }> {
    try {
      // Check local blacklist
      if (this.ipBlacklist.has(ipAddress)) {
        return { score: 100, isBlacklisted: true, reason: 'IP in local blacklist' };
      }

      // Check whitelist
      if (this.ipWhitelist.has(ipAddress)) {
        return { score: 0, isBlacklisted: false };
      }

      // Check database for previous incidents
      const recentIncidents = await prisma.securityEvent.count({
        where: {
          ipAddress,
          severity: { in: ['high', 'critical'] },
          timestamp: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
      });

      let score = recentIncidents * 10;

      // Check for known malicious patterns
      if (await this.isKnownMaliciousIp(ipAddress)) {
        score += 50;
      }

      return {
        score: Math.min(score, 100),
        isBlacklisted: score >= 80,
        reason: recentIncidents > 0 ? `${recentIncidents} recent security incidents` : undefined,
      };
    } catch (error) {
      console.error('Error checking IP reputation:', error);
      return { score: 0, isBlacklisted: false };
    }
  }

  /**
   * Detect brute force attacks
   */
  private async detectBruteForce(event: SecurityEvent): Promise<{ detected: boolean; score: number; attempts: number }> {
    try {
      if (event.type !== 'failed_login' && event.type !== 'login_attempt') {
        return { detected: false, score: 0, attempts: 0 };
      }

      const timeWindow = new Date(Date.now() - this.bruteForceConfig.timeWindow * 60 * 1000);

      // Count failed attempts from same IP
      const failedAttempts = await prisma.securityEvent.count({
        where: {
          ipAddress: event.ipAddress,
          type: 'failed_login',
          timestamp: { gte: timeWindow },
        },
      });

      const detected = failedAttempts >= this.bruteForceConfig.maxAttempts;
      const score = Math.min((failedAttempts / this.bruteForceConfig.maxAttempts) * 60, 60);

      return { detected, score, attempts: failedAttempts };
    } catch (error) {
      console.error('Error detecting brute force:', error);
      return { detected: false, score: 0, attempts: 0 };
    }
  }

  /**
   * Analyze behavior patterns
   */
  private async analyzeBehaviorPattern(event: SecurityEvent): Promise<{ isAnomalous: boolean; score: number; reasons: string[] }> {
    try {
      let score = 0;
      const reasons: string[] = [];

      if (!event.userId) {
        return { isAnomalous: false, score: 0, reasons: [] };
      }

      // Check for unusual time patterns
      const hour = new Date(event.timestamp).getHours();
      if (hour >= this.suspiciousActivityThresholds.unusualHours.start && 
          hour <= this.suspiciousActivityThresholds.unusualHours.end) {
        score += 15;
        reasons.push('Activity during unusual hours');
      }

      // Check for rapid successive requests
      const recentEvents = await prisma.securityEvent.count({
        where: {
          userId: event.userId,
          timestamp: {
            gte: new Date(Date.now() - 60 * 1000), // Last minute
          },
        },
      });

      if (recentEvents > this.suspiciousActivityThresholds.rapidRequests / 60) {
        score += 25;
        reasons.push('Rapid successive requests');
      }

      // Check for multiple device usage
      const recentDevices = await prisma.securityEvent.findMany({
        where: {
          userId: event.userId,
          deviceFingerprint: { not: null },
          timestamp: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
        select: { deviceFingerprint: true },
        distinct: ['deviceFingerprint'],
      });

      if (recentDevices.length > this.suspiciousActivityThresholds.deviceChanges) {
        score += 20;
        reasons.push('Multiple device usage');
      }

      return {
        isAnomalous: score >= 30,
        score,
        reasons,
      };
    } catch (error) {
      console.error('Error analyzing behavior pattern:', error);
      return { isAnomalous: false, score: 0, reasons: [] };
    }
  }

  /**
   * Check rate limits
   */
  private async checkRateLimit(event: SecurityEvent): Promise<{ exceeded: boolean; score: number; requestCount: number }> {
    try {
      const timeWindow = new Date(Date.now() - 60 * 1000); // Last minute

      const requestCount = await prisma.securityEvent.count({
        where: {
          ipAddress: event.ipAddress,
          timestamp: { gte: timeWindow },
        },
      });

      const exceeded = requestCount > this.suspiciousActivityThresholds.rapidRequests;
      const score = exceeded ? 40 : Math.min((requestCount / this.suspiciousActivityThresholds.rapidRequests) * 20, 20);

      return { exceeded, score, requestCount };
    } catch (error) {
      console.error('Error checking rate limit:', error);
      return { exceeded: false, score: 0, requestCount: 0 };
    }
  }

  /**
   * Check geographical anomalies
   */
  private async checkGeographicalAnomaly(event: SecurityEvent): Promise<{ isAnomalous: boolean; score: number; reason?: string }> {
    try {
      if (!event.userId || !event.location) {
        return { isAnomalous: false, score: 0 };
      }

      // Get user's recent locations
      const recentEvents = await prisma.securityEvent.findMany({
        where: {
          userId: event.userId,
          location: { not: null },
          timestamp: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
        select: { location: true, timestamp: true },
        orderBy: { timestamp: 'desc' },
        take: 10,
      });

      if (recentEvents.length === 0) {
        return { isAnomalous: false, score: 0 };
      }

      // Check for impossible travel (too fast between locations)
      const lastEvent = recentEvents[0];
      if (lastEvent.location && event.location) {
        const timeDiff = (event.timestamp.getTime() - lastEvent.timestamp.getTime()) / (1000 * 60 * 60); // hours
        const distance = this.calculateDistance(
          lastEvent.location as any,
          event.location
        );

        // Assume maximum travel speed of 1000 km/h (commercial flight)
        const maxPossibleDistance = timeDiff * 1000;

        if (distance > maxPossibleDistance && timeDiff < 2) {
          return {
            isAnomalous: true,
            score: 30,
            reason: `Impossible travel: ${distance.toFixed(0)}km in ${timeDiff.toFixed(1)} hours`,
          };
        }
      }

      // Check for multiple countries in short time
      const uniqueCountries = new Set(
        recentEvents.map(e => (e.location as any)?.country).filter(Boolean)
      );

      if (uniqueCountries.size > this.suspiciousActivityThresholds.multipleLocations) {
        return {
          isAnomalous: true,
          score: 25,
          reason: `Access from ${uniqueCountries.size} different countries`,
        };
      }

      return { isAnomalous: false, score: 0 };
    } catch (error) {
      console.error('Error checking geographical anomaly:', error);
      return { isAnomalous: false, score: 0 };
    }
  }

  /**
   * Check device fingerprint
   */
  private async checkDeviceFingerprint(event: SecurityEvent): Promise<{ isNew: boolean; suspicious: boolean; score: number }> {
    try {
      if (!event.userId || !event.deviceFingerprint) {
        return { isNew: false, suspicious: false, score: 0 };
      }

      // Check if device is known
      const knownDevice = await prisma.userDevice.findFirst({
        where: {
          userId: event.userId,
          fingerprint: event.deviceFingerprint,
        },
      });

      if (knownDevice) {
        // Update last seen
        await prisma.userDevice.update({
          where: { id: knownDevice.id },
          data: { lastSeenAt: new Date() },
        });
        return { isNew: false, suspicious: false, score: 0 };
      }

      // New device - check if suspicious
      const recentDevices = await prisma.userDevice.count({
        where: {
          userId: event.userId,
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
      });

      const suspicious = recentDevices > 2; // More than 2 new devices in 24 hours
      const score = suspicious ? 20 : 10;

      // Register new device
      await prisma.userDevice.create({
        data: {
          userId: event.userId,
          fingerprint: event.deviceFingerprint,
          userAgent: event.userAgent,
          trusted: false,
          lastSeenAt: new Date(),
        },
      });

      return { isNew: true, suspicious, score };
    } catch (error) {
      console.error('Error checking device fingerprint:', error);
      return { isNew: false, suspicious: false, score: 0 };
    }
  }

  /**
   * Get security metrics
   */
  async getSecurityMetrics(
    organizationId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<SecurityMetrics> {
    try {
      const events = await prisma.securityEvent.findMany({
        where: {
          organizationId,
          timestamp: {
            gte: timeRange.start,
            lte: timeRange.end,
          },
        },
      });

      const totalEvents = events.length;
      const criticalThreats = events.filter(e => e.severity === 'critical').length;
      const blockedAttempts = events.filter(e => e.details?.blocked === true).length;
      const uniqueAttackers = new Set(events.map(e => e.ipAddress)).size;

      // Top threats
      const threatCounts = events.reduce((acc, event) => {
        acc[event.type] = (acc[event.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const topThreats = Object.entries(threatCounts)
        .map(([type, count]) => ({
          type,
          count,
          severity: events.find(e => e.type === type)?.severity || 'low',
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Geo distribution
      const geoData = events
        .filter(e => e.location)
        .reduce((acc, event) => {
          const country = (event.location as any)?.country || 'Unknown';
          if (!acc[country]) {
            acc[country] = { count: 0, maxSeverity: 'low' };
          }
          acc[country].count++;
          if (this.getSeverityWeight(event.severity) > this.getSeverityWeight(acc[country].maxSeverity)) {
            acc[country].maxSeverity = event.severity;
          }
          return acc;
        }, {} as Record<string, { count: number; maxSeverity: string }>);

      const geoDistribution = Object.entries(geoData)
        .map(([country, data]) => ({
          country,
          count: data.count,
          threatLevel: data.maxSeverity,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Timeline (hourly buckets)
      const timeline = this.generateTimeline(events, timeRange);

      return {
        totalEvents,
        criticalThreats,
        blockedAttempts,
        uniqueAttackers,
        topThreats,
        geoDistribution,
        timeline,
      };
    } catch (error) {
      console.error('Error getting security metrics:', error);
      throw new Error('Failed to get security metrics');
    }
  }

  /**
   * Block IP address
   */
  async blockIpAddress(ipAddress: string, organizationId?: string, reason?: string): Promise<void> {
    try {
      this.ipBlacklist.add(ipAddress);

      await prisma.blockedIp.create({
        data: {
          ipAddress,
          organizationId,
          reason: reason || 'Security threat detected',
          blockedAt: new Date(),
          isActive: true,
        },
      });

      console.log(`Blocked IP address: ${ipAddress}`);
    } catch (error) {
      console.error('Error blocking IP address:', error);
    }
  }

  /**
   * Lock user account
   */
  async lockUserAccount(userId: string, reason: string): Promise<void> {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: {
          isLocked: true,
          lockedAt: new Date(),
          lockReason: reason,
        },
      });

      await this.logSecurityEvent({
        type: 'account_lockout',
        userId,
        ipAddress: '127.0.0.1',
        userAgent: 'system',
        details: { reason },
        severity: 'high',
        timestamp: new Date(),
      });

      console.log(`Locked user account: ${userId}`);
    } catch (error) {
      console.error('Error locking user account:', error);
    }
  }

  /**
   * Generate device fingerprint
   */
  generateDeviceFingerprint(deviceData: Partial<DeviceFingerprint>): string {
    const components = [
      deviceData.userAgent || '',
      deviceData.screenResolution || '',
      deviceData.timezone || '',
      deviceData.language || '',
      deviceData.platform || '',
      (deviceData.plugins || []).join(','),
      deviceData.canvas || '',
      deviceData.webgl || '',
    ];

    return crypto
      .createHash('sha256')
      .update(components.join('|'))
      .digest('hex');
  }

  /**
   * Private helper methods
   */
  private async enhanceEventWithLocation(event: SecurityEvent): Promise<SecurityEvent> {
    try {
      // In a real implementation, you would use a GeoIP service
      // For now, we'll create a mock location
      const location = {
        country: 'US',
        region: 'CA',
        city: 'San Francisco',
        coordinates: [-122.4194, 37.7749] as [number, number],
      };

      return { ...event, location };
    } catch (error) {
      return event;
    }
  }

  private generateThreatReason(riskScore: number, actions: string[]): string {
    if (riskScore >= 80) {
      return 'Critical security threat detected';
    } else if (riskScore >= 60) {
      return 'High-risk activity identified';
    } else if (riskScore >= 40) {
      return 'Suspicious behavior pattern detected';
    } else {
      return 'Low-level security event';
    }
  }

  private mapEventTypeToAlertType(eventType: string): SecurityAlert['type'] {
    switch (eventType) {
      case 'failed_login':
      case 'brute_force':
        return 'LOGIN_ATTEMPT';
      case 'permission_change':
        return 'PERMISSION_VIOLATION';
      case 'suspicious_activity':
      case 'unusual_location':
      case 'device_change':
        return 'SUSPICIOUS_ACTIVITY';
      case 'data_access':
        return 'DATA_BREACH';
      default:
        return 'SUSPICIOUS_ACTIVITY';
    }
  }

  private async isKnownMaliciousIp(ipAddress: string): Promise<boolean> {
    // This would integrate with threat intelligence feeds
    // For now, return false
    return false;
  }

  private async createSecurityAlert(event: SecurityEvent, detection: ThreatDetection): Promise<void> {
    // Alert creation logic - already handled in handleThreatResponse
  }

  private async requireAdditionalVerification(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        requiresVerification: true,
      },
    });
  }

  private async notifyAdministrators(alert: SecurityAlert): Promise<void> {
    try {
      const admins = await prisma.user.findMany({
        where: {
          role: 'ADMIN',
          organizationId: alert.organizationId,
        },
      });

      for (const admin of admins) {
        if (admin.email) {
          await emailService.sendEmail({
            to: admin.email,
            subject: `Security Alert: ${alert.type}`,
            html: `
              <h2>Security Alert</h2>
              <p><strong>Type:</strong> ${alert.type}</p>
              <p><strong>Severity:</strong> ${alert.severity}</p>
              <p><strong>Message:</strong> ${alert.message}</p>
              <p><strong>IP Address:</strong> ${alert.ipAddress}</p>
              <p><strong>Time:</strong> ${alert.timestamp.toISOString()}</p>
              <p>Please review and take appropriate action.</p>
            `,
          });
        }

        if (admin.phone && alert.severity === 'CRITICAL') {
          await smsService.sendSMS({
            to: admin.phone,
            message: `CRITICAL Security Alert: ${alert.type} from ${alert.ipAddress}. Check dashboard immediately.`,
          });
        }
      }
    } catch (error) {
      console.error('Error notifying administrators:', error);
    }
  }

  private async notifySystemAdministrators(event: SecurityEvent, detection: ThreatDetection): Promise<void> {
    // System-wide notification logic
    console.log(`System alert: ${detection.reason} (Score: ${detection.riskScore})`);
  }

  private calculateDistance(loc1: any, loc2: any): number {
    // Haversine formula for calculating distance between two points
    const R = 6371; // Earth's radius in km
    const dLat = this.deg2rad(loc2.coordinates[1] - loc1.coordinates[1]);
    const dLon = this.deg2rad(loc2.coordinates[0] - loc1.coordinates[0]);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(loc1.coordinates[1])) *
        Math.cos(this.deg2rad(loc2.coordinates[1])) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  private getSeverityWeight(severity: string): number {
    switch (severity) {
      case 'critical':
        return 4;
      case 'high':
        return 3;
      case 'medium':
        return 2;
      case 'low':
        return 1;
      default:
        return 0;
    }
  }

  private generateTimeline(events: any[], timeRange: { start: Date; end: Date }): any[] {
    const hours = Math.ceil((timeRange.end.getTime() - timeRange.start.getTime()) / (1000 * 60 * 60));
    const timeline = [];

    for (let i = 0; i < hours; i++) {
      const hourStart = new Date(timeRange.start.getTime() + i * 60 * 60 * 1000);
      const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);

      const hourEvents = events.filter(
        e => e.timestamp >= hourStart && e.timestamp < hourEnd
      );

      const maxSeverity = hourEvents.reduce((max, event) => {
        return this.getSeverityWeight(event.severity) > this.getSeverityWeight(max) ? event.severity : max;
      }, 'low');

      timeline.push({
        timestamp: hourStart,
        count: hourEvents.length,
        severity: maxSeverity,
      });
    }

    return timeline;
  }

  private async loadSecurityRules(): Promise<void> {
    // Load security rules from database
    try {
      const rules = await prisma.securityRule.findMany({
        where: { isActive: true },
      });
      
      // Process and store rules
      console.log(`Loaded ${rules.length} security rules`);
    } catch (error) {
      console.error('Error loading security rules:', error);
    }
  }

  private initializeIpLists(): void {
    // Initialize IP whitelist and blacklist
    // This would typically load from database or configuration
    this.ipWhitelist.add('127.0.0.1');
    this.ipWhitelist.add('::1');
  }
}

export const advancedSecurityService = new AdvancedSecurityService();
