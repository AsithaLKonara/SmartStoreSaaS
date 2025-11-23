import { GET, POST } from '../route';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { securityService } from '@/lib/security/securityService';

// Mock NextRequest
class MockNextRequest {
  url: string;
  method: string;
  body: string;
  
  constructor(url: string, init?: any) {
    this.url = url;
    this.method = init?.method || 'GET';
    this.body = init?.body || '{}';
  }
  
  async json() {
    return JSON.parse(this.body);
  }
}

// Mock dependencies
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    organization: {
      update: jest.fn(),
    },
    securityEvent: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));

jest.mock('@/lib/security/securityService', () => ({
  securityService: {
    getAuditLogs: jest.fn(),
    setupMFA: jest.fn(),
    verifyMFAToken: jest.fn(),
    createRole: jest.fn(),
    assignRoleToUser: jest.fn(),
    checkPermission: jest.fn(),
    logSecurityEvent: jest.fn(),
    createSecurityAlert: jest.fn(),
    detectSuspiciousActivity: jest.fn(),
    encryptSensitiveData: jest.fn(),
    decryptSensitiveData: jest.fn(),
    exportUserData: jest.fn(),
    deleteUserData: jest.fn(),
  },
}));

describe('/api/security', () => {
  const mockSession = {
    user: {
      id: 'user-1',
      organizationId: 'org-1',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getServerSession as jest.Mock).mockResolvedValue(mockSession);
  });

  describe('GET', () => {
    it('should return 401 for unauthorized requests', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(null);

      const request = new MockNextRequest('http://localhost:3000/api/security');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return audit logs', async () => {
      const mockAuditLogs = [
        { id: '1', action: 'login', userId: 'user-1', success: true },
      ];
      (securityService.getAuditLogs as jest.Mock).mockResolvedValue(mockAuditLogs);

      const request = new MockNextRequest('http://localhost:3000/api/security?type=audit-logs');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.auditLogs).toEqual(mockAuditLogs);
    });

    it('should return security alerts', async () => {
      const mockAlerts = [
        { id: '1', type: 'suspicious_login', severity: 'HIGH' },
      ];
      (prisma.securityEvent.findMany as jest.Mock).mockResolvedValue(mockAlerts);

      const request = new MockNextRequest('http://localhost:3000/api/security?type=security-alerts');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.alerts).toEqual(mockAlerts);
    });

    it('should return user permissions', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-1',
        role: 'ADMIN',
      });

      const request = new MockNextRequest('http://localhost:3000/api/security?type=user-permissions');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.permissions).toContain('all');
      expect(data.role).toBe('ADMIN');
    });

    it('should return MFA status', async () => {
      (prisma.userPreference.findUnique as jest.Mock).mockResolvedValue({
        notifications: { mfaEnabled: true },
      });

      const request = new MockNextRequest('http://localhost:3000/api/security?type=mfa-status');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.mfaEnabled).toBe(true);
    });

    it('should return security summary', async () => {
      (prisma.user.count as jest.Mock).mockResolvedValue(10);
      (prisma.securityEvent.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.securityEvent.count as jest.Mock).mockResolvedValue(2);

      const request = new MockNextRequest('http://localhost:3000/api/security?type=security-summary');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.totalUsers).toBe(10);
      expect(data.activeAlerts).toBe(2);
    });

    it('should return 400 for invalid type', async () => {
      const request = new MockNextRequest('http://localhost:3000/api/security?type=invalid');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid type parameter');
    });
  });

  describe('POST', () => {
    it('should return 401 for unauthorized requests', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(null);

      const request = new MockNextRequest('http://localhost:3000/api/security', {
        method: 'POST',
        body: JSON.stringify({ action: 'setup-mfa' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should setup MFA', async () => {
      const mockMFASetup = { secret: 'test-secret', qrCode: 'test-qr' };
      (securityService.setupMFA as jest.Mock).mockResolvedValue(mockMFASetup);

      const request = new MockNextRequest('http://localhost:3000/api/security', {
        method: 'POST',
        body: JSON.stringify({ action: 'setup-mfa' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.mfaSetup).toEqual(mockMFASetup);
      expect(securityService.setupMFA).toHaveBeenCalledWith('user-1');
    });

    it('should verify MFA token', async () => {
      (securityService.verifyMFAToken as jest.Mock).mockResolvedValue(true);

      const request = new MockNextRequest('http://localhost:3000/api/security', {
        method: 'POST',
        body: JSON.stringify({ action: 'verify-mfa', data: { token: '123456' } }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.isValid).toBe(true);
      expect(securityService.verifyMFAToken).toHaveBeenCalledWith('user-1', '123456');
    });

    it('should create role', async () => {
      const mockRole = { id: 'role-1', name: 'Manager', permissions: ['read', 'write'] };
      (securityService.createRole as jest.Mock).mockResolvedValue(mockRole);

      const request = new MockNextRequest('http://localhost:3000/api/security', {
        method: 'POST',
        body: JSON.stringify({
          action: 'create-role',
          data: { roleName: 'Manager', permissions: ['read', 'write'], description: 'Manager role' },
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.role).toEqual(mockRole);
    });

    it('should check permission', async () => {
      (securityService.checkPermission as jest.Mock).mockResolvedValue(true);

      const request = new MockNextRequest('http://localhost:3000/api/security', {
        method: 'POST',
        body: JSON.stringify({ action: 'check-permission', data: { permission: 'read' } }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.hasPermission).toBe(true);
    });

    it('should return 400 for invalid action', async () => {
      const request = new MockNextRequest('http://localhost:3000/api/security', {
        method: 'POST',
        body: JSON.stringify({ action: 'invalid-action' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid action');
    });
  });
});

