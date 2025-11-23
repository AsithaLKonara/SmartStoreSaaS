import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { prisma } from '@/lib/prisma';
import { smsService } from '@/lib/sms/smsService';
import { emailService } from '@/lib/email/emailService';
import crypto from 'crypto';

export interface MFASecret {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

export interface MFAVerification {
  isValid: boolean;
  usedBackupCode?: string;
}

export interface MFAMethod {
  id: string;
  type: 'totp' | 'sms' | 'email' | 'backup_codes';
  isEnabled: boolean;
  isVerified: boolean;
  createdAt: Date;
  lastUsedAt?: Date;
}

export interface SMSMFARequest {
  phone: string;
  code: string;
  expiresAt: Date;
}

export interface EmailMFARequest {
  email: string;
  code: string;
  expiresAt: Date;
}

export class MFAService {
  private readonly issuer = 'SmartStore AI';
  private readonly codeLength = 6;
  private readonly codeValidityMinutes = 5;
  private readonly backupCodeCount = 10;
  private readonly backupCodeLength = 8;

  // Helper method to get MFA data from UserPreference
  private async getMFAData(userId: string, type?: string): Promise<any> {
    const userPref = await prisma.userPreference.findUnique({
      where: { userId },
    });
    const mfaData = (userPref?.notifications as Record<string, unknown> & { mfa?: unknown })?.mfa;
    if (!mfaData) return null;
    if (type && mfaData.type !== type) return null;
    return mfaData;
  }

  // Helper method to update MFA data in UserPreference
  private async updateMFAData(userId: string, updates: Record<string, unknown>): Promise<void> {
    const userPref = await prisma.userPreference.findUnique({
      where: { userId },
    });
    await prisma.userPreference.upsert({
      where: { userId },
      update: {
        notifications: {
          ...(userPref?.notifications as any || {}),
          mfa: {
            ...((userPref?.notifications as Record<string, unknown> & { mfa?: Record<string, unknown> })?.mfa || {}),
            ...updates,
          },
        } as any,
      },
      create: {
        userId,
        notifications: {
          mfa: updates,
        } as any,
      },
    });
  }

  /**
   * Generate TOTP secret and QR code for user
   */
  async generateTOTPSecret(userId: string, email: string): Promise<MFASecret> {
    try {
      // Generate secret
      const secret = speakeasy.generateSecret({
        issuer: this.issuer,
        name: email,
        length: 32,
      });

      // Generate QR code
      const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);

      // Generate backup codes
      const backupCodes = this.generateBackupCodes();

      // Store in UserPreference metadata
      const mfaData = {
        type: 'totp',
        secret: secret.base32,
        backupCodes: backupCodes.map(code => this.hashBackupCode(code)),
        isEnabled: false,
        isVerified: false,
        createdAt: new Date(),
      };

      await prisma.userPreference.upsert({
        where: { userId },
        update: {
          notifications: {
            ...((await prisma.userPreference.findUnique({ where: { userId } }))?.notifications as Record<string, unknown> || {}),
            mfa: mfaData,
          } as Record<string, unknown>,
        },
        create: {
          userId,
          notifications: {
            mfa: mfaData,
          } as Record<string, unknown>,
        },
      });

      return {
        secret: secret.base32,
        qrCodeUrl,
        backupCodes,
      };
    } catch (error) {
      console.error('Error generating TOTP secret:', error);
      throw new Error('Failed to generate TOTP secret');
    }
  }

  /**
   * Verify TOTP code
   */
  async verifyTOTP(userId: string, token: string, window = 1): Promise<MFAVerification> {
    try {
      const userPref = await prisma.userPreference.findUnique({
        where: { userId },
      });

      const mfaData = (userPref?.notifications as Record<string, unknown> & { mfa?: unknown })?.mfa;

      if (!mfaData || mfaData.type !== 'totp' || !mfaData.isEnabled) {
        return { isValid: false };
      }

      if (!mfaData.secret) {
        return { isValid: false };
      }

      const isValid = speakeasy.totp.verify({
        secret: mfaData.secret,
        encoding: 'base32',
        token,
        window,
      });

      if (isValid) {
        // Update last used timestamp
        await prisma.userPreference.update({
          where: { userId },
          data: {
            notifications: {
              ...(userPref?.notifications as Record<string, unknown> || {}),
              mfa: {
                ...mfaData,
                lastUsedAt: new Date(),
              },
            } as Record<string, unknown>,
          },
        });

        // Log successful verification
        await this.logMFAEvent(userId, 'totp_verified', 'success');
      } else {
        // Log failed verification
        await this.logMFAEvent(userId, 'totp_verification_failed', 'failure');
      }

      return { isValid };
    } catch (error) {
      console.error('Error verifying TOTP:', error);
      await this.logMFAEvent(userId, 'totp_verification_error', 'error');
      return { isValid: false };
    }
  }

  /**
   * Enable TOTP after initial verification
   */
  async enableTOTP(userId: string, token: string): Promise<boolean> {
    try {
      const mfaData = await this.getMFAData(userId, 'totp');

      if (!mfaData || mfaData.isEnabled) {
        return false;
      }

      if (!mfaData.secret) {
        return false;
      }

      const isValid = speakeasy.totp.verify({
        secret: mfaData.secret,
        encoding: 'base32',
        token,
        window: 2,
      });

      if (isValid) {
        await this.updateMFAData(userId, {
          isEnabled: true,
          isVerified: true,
          lastUsedAt: new Date(),
        });

        await this.logMFAEvent(userId, 'totp_enabled', 'success');
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error enabling TOTP:', error);
      return false;
    }
  }

  /**
   * Disable TOTP
   */
  async disableTOTP(userId: string, token: string): Promise<boolean> {
    try {
      const verification = await this.verifyTOTP(userId, token);
      
      if (verification.isValid) {
        await this.updateMFAData(userId, {
          isEnabled: false,
        });

        await this.logMFAEvent(userId, 'totp_disabled', 'success');
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error disabling TOTP:', error);
      return false;
    }
  }

  /**
   * Send SMS MFA code
   */
  async sendSMSCode(userId: string, phone: string): Promise<boolean> {
    try {
      const code = this.generateNumericCode();
      const expiresAt = new Date(Date.now() + this.codeValidityMinutes * 60 * 1000);

      // Store code in UserPreference metadata
      await this.updateMFAData(userId, {
        type: 'sms',
        tempCode: code,
        tempCodeExpiresAt: expiresAt,
        phone,
        isEnabled: true,
        isVerified: false,
      });

      // Send SMS
      await smsService.sendOTPCode(phone, code);

      await this.logMFAEvent(userId, 'sms_code_sent', 'success');
      return true;
    } catch (error) {
      console.error('Error sending SMS MFA code:', error);
      await this.logMFAEvent(userId, 'sms_code_send_failed', 'error');
      return false;
    }
  }

  /**
   * Verify SMS MFA code
   */
  async verifySMSCode(userId: string, code: string): Promise<MFAVerification> {
    try {
      const mfaData = await this.getMFAData(userId, 'sms');

      if (!mfaData || !mfaData.tempCode || !mfaData.tempCodeExpiresAt || !mfaData.isEnabled) {
        return { isValid: false };
      }

      const now = new Date();
      const isExpired = new Date(mfaData.tempCodeExpiresAt) < now;

      if (isExpired) {
        await this.logMFAEvent(userId, 'sms_code_expired', 'failure');
        return { isValid: false };
      }

      const isValid = mfaData.tempCode === code;

      if (isValid) {
        // Clear temp code and mark as verified
        await this.updateMFAData(userId, {
          tempCode: null,
          tempCodeExpiresAt: null,
          isVerified: true,
          lastUsedAt: now,
        });

        await this.logMFAEvent(userId, 'sms_verified', 'success');
      } else {
        await this.logMFAEvent(userId, 'sms_verification_failed', 'failure');
      }

      return { isValid };
    } catch (error) {
      console.error('Error verifying SMS code:', error);
      await this.logMFAEvent(userId, 'sms_verification_error', 'error');
      return { isValid: false };
    }
  }

  /**
   * Send Email MFA code
   */
  async sendEmailCode(userId: string, email: string): Promise<boolean> {
    try {
      const code = this.generateNumericCode();
      const expiresAt = new Date(Date.now() + this.codeValidityMinutes * 60 * 1000);

      // Store code in UserPreference metadata
      await this.updateMFAData(userId, {
        type: 'email',
        tempCode: code,
        tempCodeExpiresAt: expiresAt,
        email,
        isEnabled: true,
        isVerified: false,
      });

      // Send email
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });

      if (!user) {
        throw new Error('User not found');
      }

      const mfaEmailTemplate = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Verification Code</h2>
            <p>Your verification code is:</p>
            <div style="background: #f8f9fa; padding: 20px; text-align: center; margin: 20px 0;">
              <h1 style="color: #007bff; font-size: 32px; margin: 0; letter-spacing: 4px;">${code}</h1>
            </div>
            <p style="color: #666;">This code will expire in ${this.codeValidityMinutes} minutes.</p>
            <p style="color: #666; font-size: 12px;">If you didn't request this code, please ignore this email.</p>
          </div>
        `;

      await emailService.sendEmail({
        to: user.email,
        subject: 'MFA Code',
        htmlContent: mfaEmailTemplate,
        textContent: mfaEmailTemplate.replace(/<[^>]*>/g, '')
      });

      await this.logMFAEvent(userId, 'email_code_sent', 'success');
      return true;
    } catch (error) {
      console.error('Error sending email MFA code:', error);
      await this.logMFAEvent(userId, 'email_code_send_failed', 'error');
      return false;
    }
  }

  /**
   * Verify Email MFA code
   */
  async verifyEmailCode(userId: string, code: string): Promise<MFAVerification> {
    try {
      const mfaData = await this.getMFAData(userId, 'email');

      if (!mfaData || !mfaData.tempCode || !mfaData.tempCodeExpiresAt || !mfaData.isEnabled) {
        return { isValid: false };
      }

      const now = new Date();
      const isExpired = new Date(mfaData.tempCodeExpiresAt) < now;

      if (isExpired) {
        await this.logMFAEvent(userId, 'email_code_expired', 'failure');
        return { isValid: false };
      }

      const isValid = mfaData.tempCode === code;

      if (isValid) {
        // Clear temp code and mark as verified
        await this.updateMFAData(userId, {
          tempCode: null,
          tempCodeExpiresAt: null,
          isVerified: true,
          lastUsedAt: now,
        });

        await this.logMFAEvent(userId, 'email_verified', 'success');
      } else {
        await this.logMFAEvent(userId, 'email_verification_failed', 'failure');
      }

      return { isValid };
    } catch (error) {
      console.error('Error verifying email code:', error);
      await this.logMFAEvent(userId, 'email_verification_error', 'error');
      return { isValid: false };
    }
  }

  /**
   * Verify backup code (not implemented in current schema)
   */
  async verifyBackupCode(userId: string, code: string): Promise<MFAVerification> {
    try {
      const mfaData = await this.getMFAData(userId, 'totp');

      if (!mfaData || !mfaData.backupCodes || !mfaData.isEnabled) {
        return { isValid: false };
      }

      const hashedCode = this.hashBackupCode(code);
      const backupCodes = (mfaData.backupCodes || []) as string[];
      const codeIndex = backupCodes.findIndex(bc => bc === hashedCode);

      if (codeIndex === -1) {
        await this.logMFAEvent(userId, 'backup_code_invalid', 'failure');
        return { isValid: false };
      }

      // Remove used backup code
      const updatedCodes = backupCodes.filter((_, index) => index !== codeIndex);

      await this.updateMFAData(userId, {
        backupCodes: updatedCodes,
        lastUsedAt: new Date(),
      });

      await this.logMFAEvent(userId, 'backup_code_used', 'success');

      return {
        isValid: true,
        usedBackupCode: code,
      };
    } catch (error) {
      console.error('Error verifying backup code:', error);
      await this.logMFAEvent(userId, 'backup_code_verification_error', 'error');
      return { isValid: false };
    }
  }

  /**
   * Generate new backup codes
   */
  async regenerateBackupCodes(userId: string, totpToken: string): Promise<string[] | null> {
    try {
      // Verify TOTP token first
      const verification = await this.verifyTOTP(userId, totpToken);
      
      if (!verification.isValid) {
        return null;
      }

      const newBackupCodes = this.generateBackupCodes();
      const hashedCodes = newBackupCodes.map(code => this.hashBackupCode(code));

      await this.updateMFAData(userId, {
        backupCodes: hashedCodes,
      });

      await this.logMFAEvent(userId, 'backup_codes_regenerated', 'success');

      return newBackupCodes;
    } catch (error) {
      console.error('Error regenerating backup codes:', error);
      return null;
    }
  }

  /**
   * Get user's MFA methods
   */
  async getUserMFAMethods(userId: string): Promise<MFAMethod[]> {
    try {
      const userPref = await prisma.userPreference.findUnique({
        where: { userId },
      });
      const mfaData = (userPref?.notifications as Record<string, unknown> & { mfa?: unknown })?.mfa;

      if (!mfaData) return [];

      return [{
        id: userId,
        type: mfaData.type as 'totp' | 'sms' | 'email' | 'backup_codes',
        isEnabled: mfaData.isEnabled || false,
        isVerified: mfaData.isVerified || false,
        createdAt: mfaData.createdAt ? new Date(mfaData.createdAt) : new Date(),
        lastUsedAt: mfaData.lastUsedAt ? new Date(mfaData.lastUsedAt) : undefined,
      }];
    } catch (error) {
      console.error('Error getting user MFA methods:', error);
      return [];
    }
  }

  /**
   * Check if user has MFA enabled
   */
  async hasMFAEnabled(userId: string): Promise<boolean> {
    try {
      const mfaData = await this.getMFAData(userId);
      return !!(mfaData && mfaData.isEnabled && mfaData.isVerified);
    } catch (error) {
      console.error('Error checking MFA status:', error);
      return false;
    }
  }

  /**
   * Disable all MFA methods for user
   */
  async disableAllMFA(userId: string, totpToken: string): Promise<boolean> {
    try {
      // Verify TOTP token first
      const verification = await this.verifyTOTP(userId, totpToken);
      
      if (!verification.isValid) {
        return false;
      }

      await this.updateMFAData(userId, {
        isEnabled: false,
      });

      await this.logMFAEvent(userId, 'all_mfa_disabled', 'success');
      return true;
    } catch (error) {
      console.error('Error disabling all MFA:', error);
      return false;
    }
  }

  /**
   * Get MFA authentication logs (not implemented in current schema)
   */
  async getMFALogs(userId: string, limit = 50): Promise<any[]> {
    try {
      // MFA logs stored in UserPreference metadata or Activity model
      // TODO: Use Activity model for MFA logs instead of mfaLog
      const userPref = await prisma.userPreference.findUnique({
        where: { userId },
      });
      const logs = (userPref?.notifications as Record<string, unknown> & { mfaLogs?: unknown[] })?.mfaLogs || [];
      return logs.slice(0, limit);
    } catch (error) {
      console.error('Error getting MFA logs:', error);
      return [];
    }
  }

  /**
   * Private helper methods
   */
  private generateBackupCodes(): string[] {
    const codes: string[] = [];
    
    for (let i = 0; i < this.backupCodeCount; i++) {
      let code = '';
      for (let j = 0; j < this.backupCodeLength; j++) {
        code += Math.floor(Math.random() * 10).toString();
      }
      codes.push(code);
    }
    
    return codes;
  }

  private hashBackupCode(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex');
  }

  private generateNumericCode(): string {
    let code = '';
    for (let i = 0; i < this.codeLength; i++) {
      code += Math.floor(Math.random() * 10).toString();
    }
    return code;
  }

  private async logMFAEvent(
    userId: string,
    action: string,
    result: 'success' | 'failure' | 'error',
    details?: any
  ): Promise<void> {
    try {
      // Store MFA log in Activity model
      await prisma.activity.create({
        data: {
          userId,
          type: 'mfa_log',
          description: `MFA ${action}: ${result}`,
          metadata: {
            action,
            result,
            details,
            timestamp: new Date(),
            ipAddress: '', // This would be passed from the request context
            userAgent: '', // This would be passed from the request context
          } as Record<string, unknown>,
        },
      });
    } catch (error) {
      console.error('Error logging MFA event:', error);
    }
  }

  /**
   * Generate QR code for manual entry
   */
  async generateManualEntryQR(secret: string, email: string): Promise<string> {
    try {
      const otpauthUrl = speakeasy.otpauthURL({
        secret,
        label: email,
        issuer: this.issuer,
        encoding: 'base32',
      });

      return await QRCode.toDataURL(otpauthUrl);
    } catch (error) {
      console.error('Error generating manual entry QR:', error);
      throw new Error('Failed to generate QR code');
    }
  }

  /**
   * Validate TOTP setup by requiring multiple successful verifications
   */
  async validateTOTPSetup(userId: string, tokens: string[]): Promise<boolean> {
    if (tokens.length < 2) {
      return false;
    }

    try {
      const mfaData = await this.getMFAData(userId, 'totp');

      if (!mfaData || mfaData.isEnabled) {
        return false;
      }

      // Verify multiple tokens with different time windows
      let validCount = 0;
      for (let i = 0; i < tokens.length; i++) {
        if (!mfaData.secret) {
          continue;
        }

        const isValid = speakeasy.totp.verify({
          secret: mfaData.secret,
          encoding: 'base32',
          token: tokens[i],
          window: 1,
        });

        if (isValid) {
          validCount++;
        }
      }

      // Require at least 2 valid tokens
      if (validCount >= 2) {
        await this.updateMFAData(userId, {
          isEnabled: true,
          isVerified: true,
          lastUsedAt: new Date(),
        });

        await this.logMFAEvent(userId, 'totp_setup_validated', 'success');
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error validating TOTP setup:', error);
      return false;
    }
  }
}

export const mfaService = new MFAService();
