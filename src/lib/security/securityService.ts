import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export interface SecurityAudit {
  id: string;
  userId: string;
  action: string;
  resource: string;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  success: boolean;
  details: any;
}

export interface MFASetup {
  userId: string;
  secret: string;
  qrCode: string;
  backupCodes: string[];
  isEnabled: boolean;
}

export interface RolePermission {
  roleId: string;
  roleName: string;
  permissions: string[];
  description: string;
}

export interface SecurityAlert {
  id: string;
  type: 'LOGIN_ATTEMPT' | 'PERMISSION_VIOLATION' | 'SUSPICIOUS_ACTIVITY' | 'DATA_BREACH';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  userId?: string;
  ipAddress: string;
  timestamp: Date;
  resolved: boolean;
  details: any;
}

export class SecurityService {
  /**
   * Multi-Factor Authentication
   */
  async setupMFA(userId: string): Promise<MFASetup> {
    try {
      // Generate secret for TOTP
      const secret = crypto.randomBytes(32).toString('base32');
      
      // Generate QR code URL
      const qrCode = `otpauth://totp/SmartStore:${userId}?secret=${secret}&issuer=SmartStore`;
      
      // Generate backup codes
      const backupCodes = Array.from({ length: 10 }, () => 
        crypto.randomBytes(4).toString('hex').toUpperCase()
      );
      
      // Store MFA setup in database
      await prisma.user.update({
        where: { id: userId },
        data: {
          mfaSecret: secret,
          mfaBackupCodes: backupCodes,
          mfaEnabled: true,
        },
      });
      
      return {
        userId,
        secret,
        qrCode,
        backupCodes,
        isEnabled: true,
      };
    } catch (error) {
      console.error('Error setting up MFA:', error);
      throw new Error('Failed to setup MFA');
    }
  }

  async verifyMFAToken(userId: string, token: string): Promise<boolean> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { mfaSecret: true, mfaBackupCodes: true },
      });
      
      if (!user?.mfaSecret) return false;
      
      // Check if it's a backup code
      if (user.mfaBackupCodes?.includes(token)) {
        // Remove used backup code
        await prisma.user.update({
          where: { id: userId },
          data: {
            mfaBackupCodes: {
              set: user.mfaBackupCodes.filter(code => code !== token),
            },
          },
        });
        return true;
      }
      
      // Verify TOTP token (simplified - in production use a proper TOTP library)
      // This is a placeholder for TOTP verification
      return this.verifyTOTP(user.mfaSecret, token);
    } catch (error) {
      console.error('Error verifying MFA token:', error);
      return false;
    }
  }

  private verifyTOTP(secret: string, token: string): boolean {
    // Simplified TOTP verification - in production use a library like 'speakeasy'
    // This is just a placeholder implementation
    const expectedToken = crypto
      .createHmac('sha1', secret)
      .update(Math.floor(Date.now() / 30000).toString())
      .digest('hex')
      .substring(0, 6);
    
    return token === expectedToken;
  }

  /**
   * Role-Based Access Control (RBAC)
   */
  async createRole(roleName: string, permissions: string[], description: string): Promise<RolePermission> {
    try {
      const role = await prisma.role.create({
        data: {
          name: roleName,
          permissions,
          description,
        },
      });
      
      return {
        roleId: role.id,
        roleName: role.name,
        permissions: role.permissions,
        description: role.description,
      };
    } catch (error) {
      console.error('Error creating role:', error);
      throw new Error('Failed to create role');
    }
  }

  async assignRoleToUser(userId: string, roleId: string): Promise<void> {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { roleId },
      });
    } catch (error) {
      console.error('Error assigning role to user:', error);
      throw new Error('Failed to assign role');
    }
  }

  async checkPermission(userId: string, permission: string): Promise<boolean> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { role: true },
      });
      
      if (!user?.role) return false;
      
      return user.role.permissions.includes(permission);
    } catch (error) {
      console.error('Error checking permission:', error);
      return false;
    }
  }

  /**
   * Audit Logging
   */
  async logSecurityEvent(
    userId: string,
    action: string,
    resource: string,
    ipAddress: string,
    userAgent: string,
    success: boolean,
    details?: any
  ): Promise<void> {
    try {
      await prisma.securityAudit.create({
        data: {
          userId,
          action,
          resource,
          ipAddress,
          userAgent,
          success,
          details: details || {},
        },
      });
    } catch (error) {
      console.error('Error logging security event:', error);
    }
  }

  async getAuditLogs(
    filters: {
      userId?: string;
      action?: string;
      startDate?: Date;
      endDate?: Date;
      success?: boolean;
    },
    page: number = 1,
    limit: number = 50
  ): Promise<SecurityAudit[]> {
    try {
      const where: any = {};
      
      if (filters.userId) where.userId = filters.userId;
      if (filters.action) where.action = filters.action;
      if (filters.success !== undefined) where.success = filters.success;
      if (filters.startDate || filters.endDate) {
        where.timestamp = {};
        if (filters.startDate) where.timestamp.gte = filters.startDate;
        if (filters.endDate) where.timestamp.lte = filters.endDate;
      }
      
      const audits = await prisma.securityAudit.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      });
      
      return audits;
    } catch (error) {
      console.error('Error getting audit logs:', error);
      return [];
    }
  }

  /**
   * Security Monitoring and Alerts
   */
  async createSecurityAlert(
    type: SecurityAlert['type'],
    severity: SecurityAlert['severity'],
    message: string,
    userId?: string,
    ipAddress?: string,
    details?: any
  ): Promise<SecurityAlert> {
    try {
      const alert = await prisma.securityAlert.create({
        data: {
          type,
          severity,
          message,
          userId,
          ipAddress: ipAddress || 'unknown',
          details: details || {},
        },
      });
      
      // Send notification for high/critical alerts
      if (severity === 'HIGH' || severity === 'CRITICAL') {
        await this.sendSecurityNotification(alert);
      }
      
      return alert;
    } catch (error) {
      console.error('Error creating security alert:', error);
      throw new Error('Failed to create security alert');
    }
  }

  async detectSuspiciousActivity(userId: string, ipAddress: string, action: string): Promise<boolean> {
    try {
      // Check for multiple failed login attempts
      const recentFailedLogins = await prisma.securityAudit.count({
        where: {
          userId,
          action: 'LOGIN',
          success: false,
          timestamp: {
            gte: new Date(Date.now() - 15 * 60 * 1000), // Last 15 minutes
          },
        },
      });
      
      if (recentFailedLogins >= 5) {
        await this.createSecurityAlert(
          'SUSPICIOUS_ACTIVITY',
          'HIGH',
          `Multiple failed login attempts for user ${userId}`,
          userId,
          ipAddress
        );
        return true;
      }
      
      // Check for unusual IP addresses
      const userAudits = await prisma.securityAudit.findMany({
        where: { userId },
        orderBy: { timestamp: 'desc' },
        take: 10,
      });
      
      const uniqueIPs = new Set(userAudits.map(audit => audit.ipAddress));
      if (uniqueIPs.size > 3 && !uniqueIPs.has(ipAddress)) {
        await this.createSecurityAlert(
          'SUSPICIOUS_ACTIVITY',
          'MEDIUM',
          `Unusual IP address detected for user ${userId}`,
          userId,
          ipAddress
        );
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error detecting suspicious activity:', error);
      return false;
    }
  }

  private async sendSecurityNotification(alert: SecurityAlert): Promise<void> {
    // Send email/SMS notification to administrators
    // This is a placeholder - implement actual notification logic
    console.log(`SECURITY ALERT: ${alert.severity} - ${alert.message}`);
  }

  /**
   * Data Encryption
   */
  async encryptSensitiveData(data: string): Promise<string> {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default-key', 'salt', 32);
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipher(algorithm, key);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  }

  async decryptSensitiveData(encryptedData: string): Promise<string> {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default-key', 'salt', 32);
    
    const parts = encryptedData.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    
    const decipher = crypto.createDecipher(algorithm, key);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * GDPR Compliance
   */
  async exportUserData(userId: string): Promise<any> {
    try {
      const userData = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          orders: true,
          activities: true,
          chatMessages: true,
        },
      });
      
      return userData;
    } catch (error) {
      console.error('Error exporting user data:', error);
      throw new Error('Failed to export user data');
    }
  }

  async deleteUserData(userId: string): Promise<void> {
    try {
      // Anonymize user data instead of hard delete for compliance
      await prisma.user.update({
        where: { id: userId },
        data: {
          email: `deleted_${Date.now()}@deleted.com`,
          name: 'Deleted User',
          isActive: false,
          deletedAt: new Date(),
        },
      });
    } catch (error) {
      console.error('Error deleting user data:', error);
      throw new Error('Failed to delete user data');
    }
  }
}

export const securityService = new SecurityService(); 