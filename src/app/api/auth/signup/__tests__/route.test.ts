import { POST } from '../route';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

// Mock NextRequest
class MockNextRequest {
  url: string;
  method: string;
  body: string;
  
  constructor(url: string, init?: { method?: string; body?: unknown }) {
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
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
}));

jest.mock('@/lib/utils', () => ({
  generateSlug: jest.fn((name) => name.toLowerCase().replace(/\s+/g, '-')),
}));

describe('/api/auth/signup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
  });

  describe('POST', () => {
    it('should create user and organization successfully', async () => {
      const mockUser = {
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
        password: 'hashed-password',
        role: 'ADMIN',
        organizationId: 'org-1',
      };

      const mockOrganization = {
        id: 'org-1',
        name: 'Test Organization',
        slug: 'test-organization',
        plan: 'STARTER',
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          organization: {
            create: jest.fn().mockResolvedValue(mockOrganization),
          },
          user: {
            create: jest.fn().mockResolvedValue(mockUser),
          },
        };
        // The callback should return { user, organization }
        return await callback(tx);
      });

      const request = new MockNextRequest('http://localhost:3000/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123',
          organizationName: 'Test Organization',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.message).toBe('User created successfully');
      expect(data.user.email).toBe('test@example.com');
      expect(data.user.password).toBeUndefined();
      expect(data.organization.name).toBe('Test Organization');
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 12);
    });

    it('should return 400 for missing required fields', async () => {
      const request = new MockNextRequest('http://localhost:3000/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test User',
          // Missing email, password, organizationName
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toBe('Missing required fields');
    });

    it('should return 400 for invalid email format', async () => {
      const request = new MockNextRequest('http://localhost:3000/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test User',
          email: 'invalid-email',
          password: 'password123',
          organizationName: 'Test Organization',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toBe('Invalid email format');
    });

    it('should return 400 for weak password', async () => {
      const request = new MockNextRequest('http://localhost:3000/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test User',
          email: 'test@example.com',
          password: 'short', // Less than 8 characters
          organizationName: 'Test Organization',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toBe('Password must be at least 8 characters long');
    });

    it('should return 409 for duplicate email', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'existing-user',
        email: 'test@example.com',
      });

      const request = new MockNextRequest('http://localhost:3000/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123',
          organizationName: 'Test Organization',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.message).toBe('User with this email already exists');
    });

    it('should return 409 for duplicate organization slug', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue({
        id: 'existing-org',
        slug: 'test-organization',
      });

      const request = new MockNextRequest('http://localhost:3000/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123',
          organizationName: 'Test Organization',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.message).toBe('Organization URL is already taken');
    });

    it('should use provided organization slug if provided', async () => {
      const mockUser = {
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
        password: 'hashed-password',
        role: 'ADMIN',
        organizationId: 'org-1',
      };

      const mockOrganization = {
        id: 'org-1',
        name: 'Test Organization',
        slug: 'custom-slug',
        plan: 'STARTER',
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          organization: {
            create: jest.fn().mockResolvedValue(mockOrganization),
          },
          user: {
            create: jest.fn().mockResolvedValue(mockUser),
          },
        };
        // The callback should return { user, organization }
        return await callback(tx);
      });

      const request = new MockNextRequest('http://localhost:3000/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123',
          organizationName: 'Test Organization',
          organizationSlug: 'custom-slug',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(201);
      expect(prisma.organization.findUnique).toHaveBeenCalledWith({
        where: { slug: 'custom-slug' },
      });
    });

    it('should return 500 on server error', async () => {
      (prisma.user.findUnique as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = new MockNextRequest('http://localhost:3000/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123',
          organizationName: 'Test Organization',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe('Internal server error');
    });
  });
});

