import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { securityService } from '@/lib/security/securityService';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const organizationId = session.user.organizationId;

    switch (type) {
      case 'audit-logs':
        const userId = searchParams.get('userId');
        const action = searchParams.get('action');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const success = searchParams.get('success');
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');

        const filters: any = {};
        if (userId) filters.userId = userId;
        if (action) filters.action = action;
        if (startDate) filters.startDate = new Date(startDate);
        if (endDate) filters.endDate = new Date(endDate);
        if (success !== null) filters.success = success === 'true';

        const auditLogs = await securityService.getAuditLogs(filters, page, limit);
        return NextResponse.json({ auditLogs });

      case 'security-alerts':
        // Security alerts stored in SecurityEvent model
        const alerts = await prisma.securityEvent.findMany({
          where: { organizationId: organizationId || '' },
          orderBy: { createdAt: 'desc' },
          take: 50,
        });
        return NextResponse.json({ alerts });

      case 'user-permissions':
        const user = await prisma.user.findUnique({
          where: { id: session.user.id },
        });
        
        // UserRole enum doesn't have permissions - return based on role
        const permissions: string[] = [];
        if (user?.role === 'ADMIN') {
          permissions.push('all');
        }

        return NextResponse.json({ 
          permissions,
          role: user?.role,
        });

      case 'mfa-status':
        // MFA status stored in user preferences metadata
        const userPref = await prisma.userPreference.findUnique({
          where: { userId: session.user.id },
        });
        
        return NextResponse.json({ 
          mfaEnabled: (userPref?.notifications as any)?.mfaEnabled || false,
        });

      case 'security-summary':
        // Get security summary for dashboard
        const totalUsers = await prisma.user.count({
          where: { organizationId },
        });

        // MFA users count would require checking user preferences
        const mfaEnabledUsers = 0; // TODO: Implement proper MFA count

        const recentSecurityEvents = await prisma.securityEvent.findMany({
          where: { organizationId: organizationId || '' },
          orderBy: { createdAt: 'desc' },
          take: 10,
        });

        const activeAlerts = await prisma.securityEvent.count({
          where: { 
            organizationId: organizationId || '',
            resolved: false,
          },
        });

        return NextResponse.json({
          totalUsers,
          mfaEnabledUsers,
          mfaAdoptionRate: totalUsers > 0 ? (mfaEnabledUsers / totalUsers) * 100 : 0,
          recentSecurityEvents,
          activeAlerts,
        });

      default:
        return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in security API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await _request.json();
    const { action, data } = body;
    const organizationId = session.user.organizationId;

    switch (action) {
      case 'setup-mfa':
        const mfaSetup = await securityService.setupMFA(session.user.id);
        return NextResponse.json({ mfaSetup });

      case 'verify-mfa':
        const { token } = data;
        const isValid = await securityService.verifyMFAToken(session.user.id, token);
        return NextResponse.json({ isValid });

      case 'create-role':
        const { roleName, permissions, description } = data;
        const role = await securityService.createRole(roleName, permissions, description);
        return NextResponse.json({ role });

      case 'assign-role':
        const { userId, roleId } = data;
        await securityService.assignRoleToUser(userId, roleId);
        return NextResponse.json({ success: true });

      case 'check-permission':
        const { permission } = data;
        const hasPermission = await securityService.checkPermission(session.user.id, permission);
        return NextResponse.json({ hasPermission });

      case 'log-security-event':
        const { eventAction, resource, ipAddress, userAgent, success, details } = data;
        await securityService.logSecurityEvent(
          session.user.id,
          eventAction,
          resource,
          ipAddress,
          userAgent,
          success,
          details
        );
        return NextResponse.json({ success: true });

      case 'create-security-alert':
        const { alertType, severity, message, userId: alertUserId, ipAddress: alertIpAddress, details: alertDetails } = data;
        const alert = await securityService.createSecurityAlert(
          alertType,
          severity,
          message,
          alertUserId,
          alertIpAddress,
          alertDetails
        );
        return NextResponse.json({ alert });

      case 'detect-suspicious-activity':
        const { ipAddress: suspiciousIpAddress, activityAction } = data;
        const isSuspicious = await securityService.detectSuspiciousActivity(
          session.user.id,
          suspiciousIpAddress,
          activityAction
        );
        return NextResponse.json({ isSuspicious });

      case 'encrypt-data':
        const { dataToEncrypt } = data;
        const encryptedData = await securityService.encryptSensitiveData(dataToEncrypt);
        return NextResponse.json({ encryptedData });

      case 'decrypt-data':
        const { dataToDecrypt } = data;
        const decryptedData = await securityService.decryptSensitiveData(dataToDecrypt);
        return NextResponse.json({ decryptedData });

      case 'export-user-data':
        const { userId: exportUserId } = data;
        const userData = await securityService.exportUserData(exportUserId);
        return NextResponse.json({ userData });

      case 'delete-user-data':
        const { userId: deleteUserId } = data;
        await securityService.deleteUserData(deleteUserId);
        return NextResponse.json({ success: true });

      case 'update-security-settings':
        const { settings } = data;
        const updatedSettings = await prisma.organization.update({
          where: { id: organizationId || '' },
          data: { 
            settings: {
              securitySettings: settings,
            } as any,
          },
        });
        return NextResponse.json({ settings: (updatedSettings.settings as any)?.securitySettings });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in security API POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 