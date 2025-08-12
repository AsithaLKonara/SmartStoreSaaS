import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { securityService } from '@/lib/security/securityService';
import { prisma } from '@/lib/prisma';

// Helper function to get permissions based on role
function getPermissionsForRole(role: string): string[] {
  switch (role) {
    case 'ADMIN':
      return ['read', 'write', 'delete', 'manage_users', 'manage_settings', 'view_analytics'];
    case 'MANAGER':
      return ['read', 'write', 'delete', 'manage_users', 'view_analytics'];
    case 'STAFF':
      return ['read', 'write'];
    case 'PACKING':
      return ['read'];
    default:
      return ['read'];
  }
}

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
        // Security alerts not implemented yet
        const alerts: any[] = [];
        return NextResponse.json({ alerts });

      case 'user-permissions':
        const user = await prisma.user.findUnique({
          where: { id: session.user.id },
        });
        
        if (!user?.role) {
          return NextResponse.json({ permissions: [], role: null });
        }

        // Define permissions based on role
        const permissions = getPermissionsForRole(user.role);
        
        return NextResponse.json({ 
          permissions,
          role: user.role,
        });

      case 'mfa-status':
        const mfaUser = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { mfaEnabled: true },
        });
        
        return NextResponse.json({ 
          mfaEnabled: mfaUser?.mfaEnabled || false,
        });

      case 'security-summary':
        // Get security summary for dashboard
        const totalUsers = await prisma.user.count({
          where: { organizationId },
        });

        const mfaEnabledUsers = await prisma.user.count({
          where: { 
            organizationId,
            mfaEnabled: true,
          },
        });

        // Security audit not implemented yet
        const recentSecurityEvents: any[] = [];

        // Security alerts not implemented yet
        const activeAlerts = 0;

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

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, data } = body;
    const organizationId = session.user.organizationId;

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID not found' }, { status: 400 });
    }

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
          where: { id: organizationId },
          data: { securitySettings: settings },
        });
        return NextResponse.json({ settings: updatedSettings.securitySettings });

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