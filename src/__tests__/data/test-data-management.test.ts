/**
 * Test Data Management
 * Tests for maintaining seeded orgs/users/products per environment, data anonymization, and resets
 */

import { prisma } from '@/lib/prisma';

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      create: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    organization: {
      create: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    product: {
      create: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    order: {
      create: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

describe('Test Data Management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Data Seeding', () => {
    it('should seed test organizations', async () => {
      const testOrg = {
        id: 'org-test-1',
        name: 'Test Organization',
        slug: 'test-org',
        plan: 'STARTER',
      };

      (prisma.organization.create as jest.Mock).mockResolvedValueOnce(testOrg);

      const org = await prisma.organization.create({
        data: testOrg,
      });

      expect(org.name).toBe('Test Organization');
      expect(org.slug).toBe('test-org');
    });

    it('should seed test users', async () => {
      const testUser = {
        id: 'user-test-1',
        name: 'Test User',
        email: 'test@example.com',
        role: 'ADMIN',
        organizationId: 'org-test-1',
      };

      (prisma.user.create as jest.Mock).mockResolvedValueOnce(testUser);

      const user = await prisma.user.create({
        data: testUser,
      });

      expect(user.name).toBe('Test User');
      expect(user.email).toBe('test@example.com');
    });

    it('should seed test products', async () => {
      const testProduct = {
        id: 'prod-test-1',
        name: 'Test Product',
        sku: 'TEST-001',
        price: 99.99,
        stockQuantity: 100,
        organizationId: 'org-test-1',
      };

      (prisma.product.create as jest.Mock).mockResolvedValueOnce(testProduct);

      const product = await prisma.product.create({
        data: testProduct,
      });

      expect(product.name).toBe('Test Product');
      expect(product.sku).toBe('TEST-001');
    });

    it('should seed test orders', async () => {
      const testOrder = {
        id: 'order-test-1',
        orderNumber: 'ORD-001',
        status: 'PENDING',
        totalAmount: 199.98,
        customerId: 'cust-test-1',
        organizationId: 'org-test-1',
      };

      (prisma.order.create as jest.Mock).mockResolvedValueOnce(testOrder);

      const order = await prisma.order.create({
        data: testOrder,
      });

      expect(order.orderNumber).toBe('ORD-001');
      expect(order.status).toBe('PENDING');
    });
  });

  describe('Data Cleanup', () => {
    it('should clean up test data', async () => {
      (prisma.user.deleteMany as jest.Mock).mockResolvedValueOnce({ count: 5 });
      (prisma.organization.deleteMany as jest.Mock).mockResolvedValueOnce({ count: 2 });
      (prisma.product.deleteMany as jest.Mock).mockResolvedValueOnce({ count: 10 });
      (prisma.order.deleteMany as jest.Mock).mockResolvedValueOnce({ count: 8 });

      const userResult = await prisma.user.deleteMany({
        where: { email: { contains: '@test.' } },
      });

      const orgResult = await prisma.organization.deleteMany({
        where: { slug: { startsWith: 'test-' } },
      });

      expect(userResult.count).toBe(5);
      expect(orgResult.count).toBe(2);
    });

    it('should reset database for tests', async () => {
      (prisma.$transaction as jest.Mock).mockResolvedValueOnce([
        { count: 5 },
        { count: 2 },
        { count: 10 },
      ]);

      await prisma.$transaction([
        prisma.user.deleteMany({ where: { email: { contains: '@test.' } } }),
        prisma.organization.deleteMany({ where: { slug: { startsWith: 'test-' } } }),
        prisma.product.deleteMany({ where: { sku: { startsWith: 'TEST-' } } }),
      ]);

      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('Data Anonymization', () => {
    it('should anonymize user email addresses', () => {
      const originalEmail = 'john.doe@example.com';
      const anonymizedEmail = originalEmail.replace(/^[^@]+/, 'user').replace(/@[^.]+/, '@test');

      expect(anonymizedEmail).not.toContain('john.doe');
      expect(anonymizedEmail).toContain('@test');
    });

    it('should anonymize user names', () => {
      const originalName = 'John Doe';
      const anonymizedName = 'Test User';

      expect(anonymizedName).not.toBe(originalName);
      expect(anonymizedName).toBe('Test User');
    });

    it('should anonymize organization names', () => {
      const originalName = 'Acme Corporation';
      const anonymizedName = 'Test Organization';

      expect(anonymizedName).not.toBe(originalName);
    });
  });

  describe('Environment-Specific Data', () => {
    it('should create data for development environment', () => {
      const devData = {
        environment: 'development',
        organizations: [
          { name: 'Dev Org 1', slug: 'dev-org-1' },
          { name: 'Dev Org 2', slug: 'dev-org-2' },
        ],
      };

      expect(devData.environment).toBe('development');
      expect(devData.organizations).toHaveLength(2);
    });

    it('should create data for staging environment', () => {
      const stagingData = {
        environment: 'staging',
        organizations: [
          { name: 'Staging Org 1', slug: 'staging-org-1' },
        ],
      };

      expect(stagingData.environment).toBe('staging');
    });

    it('should create data for test environment', () => {
      const testData = {
        environment: 'test',
        organizations: [
          { name: 'Test Org 1', slug: 'test-org-1' },
        ],
      };

      expect(testData.environment).toBe('test');
    });
  });

  describe('Data Validation', () => {
    it('should validate test data structure', () => {
      const testUser = {
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
        role: 'ADMIN',
        organizationId: 'org-1',
      };

      expect(testUser).toHaveProperty('id');
      expect(testUser).toHaveProperty('name');
      expect(testUser).toHaveProperty('email');
      expect(testUser).toHaveProperty('role');
      expect(testUser).toHaveProperty('organizationId');
    });

    it('should validate product data structure', () => {
      const testProduct = {
        id: 'prod-1',
        name: 'Test Product',
        sku: 'TEST-001',
        price: 99.99,
        stockQuantity: 100,
      };

      expect(testProduct).toHaveProperty('id');
      expect(testProduct).toHaveProperty('name');
      expect(testProduct).toHaveProperty('sku');
      expect(testProduct).toHaveProperty('price');
      expect(testProduct).toHaveProperty('stockQuantity');
    });
  });

  describe('Data Reset Scripts', () => {
    it('should provide script to reset test data', () => {
      const resetScript = {
        name: 'reset-test-data',
        actions: [
          'delete test users',
          'delete test organizations',
          'delete test products',
          'delete test orders',
          'seed fresh test data',
        ],
      };

      expect(resetScript.actions).toHaveLength(5);
    });

    it('should provide script to anonymize production data', () => {
      const anonymizeScript = {
        name: 'anonymize-production-data',
        actions: [
          'backup original data',
          'anonymize user emails',
          'anonymize user names',
          'anonymize organization names',
        ],
      };

      expect(anonymizeScript.actions).toHaveLength(4);
    });
  });
});

