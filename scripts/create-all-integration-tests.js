#!/usr/bin/env node
/**
 * Script to create test files for all integration routes
 * This is a Node.js script (not TypeScript) to avoid module issues
 */

const fs = require('fs');
const path = require('path');

const integrations = [
  { name: 'facebook', service: 'FacebookCommerceService', model: 'facebookIntegration', fields: ['pageId', 'accessToken'] },
  { name: 'instagram', service: 'InstagramShoppingService', model: 'instagramIntegration', fields: ['businessAccountId', 'accessToken'] },
  { name: 'tiktok', service: 'TikTokShopService', model: 'tikTokIntegration', fields: ['shopId', 'accessToken'] },
  { name: 'pinterest', service: 'PinterestService', model: 'pinterestIntegration', fields: ['boardId', 'accessToken'] },
  { name: 'magento', service: 'MagentoService', model: 'magentoIntegration', fields: ['baseUrl', 'accessToken'] },
  { name: 'crm', service: null, model: 'cRMIntegration', fields: ['provider', 'apiKey'] },
  { name: 'accounting', service: null, model: 'accountingIntegration', fields: ['provider', 'apiKey'] },
];

const testTemplate = (integration) => `import { GET, POST } from '../route';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
${integration.service ? `import { ${integration.service} } from '@/lib/integrations/${integration.name}/${integration.name.toLowerCase()}${integration.name === 'facebook' ? 'Commerce' : integration.name === 'instagram' ? 'Shopping' : integration.name === 'tiktok' ? 'Shop' : ''}Service';` : ''}

// Mock NextRequest
class MockNextRequest {
  url: string;
  method: string;
  body: string;
  
  constructor(url: string, init?: { method?: string; body?: unknown }) {
    this.url = url;
    this.method = init?.method || 'GET';
    this.body = typeof init?.body === 'string' ? init.body : JSON.stringify(init?.body || {});
  }
  
  async json() {
    return JSON.parse(this.body);
  }
}

// Mock dependencies
jest.mock('@/lib/prisma', () => ({
  prisma: {
    ${integration.model}: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));

${integration.service ? `jest.mock('@/lib/integrations/${integration.name}/${integration.name.toLowerCase()}${integration.name === 'facebook' ? 'Commerce' : integration.name === 'instagram' ? 'Shopping' : integration.name === 'tiktok' ? 'Shop' : ''}Service', () => ({
  ${integration.service}: jest.fn().mockImplementation(() => ({
    testConnection: jest.fn(),
    getOrCreateCatalog: jest.fn(),
  })),
}));` : ''}

describe('/api/integrations/${integration.name}', () => {
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
      (getServerSession as jest.Mock).mockResolvedValue({ user: {} });

      const request = new MockNextRequest('http://localhost:3000/api/integrations/${integration.name}');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.message || data.error).toBe('Unauthorized');
    });

    it('should return integration when found', async () => {
      const mockIntegration = {
        id: 'int-1',
        isActive: true,
        lastSync: new Date(),
        ${integration.fields.map(f => `${f}: 'test-${f}'`).join(',\n        ')},
      };
      ${integration.name === 'crm' || integration.name === 'accounting' ? `(prisma.${integration.model}.findMany as jest.Mock).mockResolvedValue([mockIntegration]);` : `(prisma.${integration.model}.findFirst as jest.Mock).mockResolvedValue(mockIntegration);`}

      const request = new MockNextRequest('http://localhost:3000/api/integrations/${integration.name}');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id || (Array.isArray(data) && data[0]?.id)).toBe('int-1');
    });

    it('should return 404 when integration not found', async () => {
      ${integration.name === 'crm' || integration.name === 'accounting' ? `(prisma.${integration.model}.findMany as jest.Mock).mockResolvedValue([]);` : `(prisma.${integration.model}.findFirst as jest.Mock).mockResolvedValue(null);`}

      const request = new MockNextRequest('http://localhost:3000/api/integrations/${integration.name}');
      const response = await GET(request);
      const data = await response.json();

      ${integration.name === 'crm' || integration.name === 'accounting' ? `expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(0);` : `expect(response.status).toBe(404);
      expect(data.message).toBe('Integration not found');`}
    });

    it('should return 500 on server error', async () => {
      ${integration.name === 'crm' || integration.name === 'accounting' ? `(prisma.${integration.model}.findMany as jest.Mock).mockRejectedValue(new Error('Database error'));` : `(prisma.${integration.model}.findFirst as jest.Mock).mockRejectedValue(new Error('Database error'));`}

      const request = new MockNextRequest('http://localhost:3000/api/integrations/${integration.name}');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message || data.error).toBe('Internal server error');
    });
  });

  describe('POST', () => {
    it('should return 401 for unauthorized requests', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: {} });

      const request = new MockNextRequest('http://localhost:3000/api/integrations/${integration.name}', {
        method: 'POST',
        body: JSON.stringify({ ${integration.fields.map(f => `${f}: 'test'`).join(', ')} }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.message || data.error).toBe('Unauthorized');
    });

    it('should return 400 for missing required fields', async () => {
      const request = new MockNextRequest('http://localhost:3000/api/integrations/${integration.name}', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message || data.error).toBeDefined();
    });

    ${integration.service ? `it('should create integration successfully', async () => {
      const mockService = {
        testConnection: jest.fn().mockResolvedValue(true),
        getOrCreateCatalog: jest.fn().mockResolvedValue('catalog-1'),
      };
      (${integration.service} as jest.Mock).mockImplementation(() => mockService);

      const mockIntegration = {
        id: 'int-1',
        isActive: true,
      };
      (prisma.${integration.model}.upsert as jest.Mock).mockResolvedValue(mockIntegration);
      ${integration.name === 'crm' || integration.name === 'accounting' ? `(prisma.${integration.model}.update as jest.Mock).mockResolvedValue(mockIntegration);` : ''}

      const request = new MockNextRequest('http://localhost:3000/api/integrations/${integration.name}', {
        method: 'POST',
        body: JSON.stringify({
          ${integration.fields.map(f => `${f}: 'test-${f}'`).join(',\n          ')},
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe('int-1');
    });` : `it('should create integration successfully', async () => {
      const mockIntegration = {
        id: 'int-1',
        isActive: true,
      };
      (prisma.${integration.model}.create as jest.Mock).mockResolvedValue(mockIntegration);

      const request = new MockNextRequest('http://localhost:3000/api/integrations/${integration.name}', {
        method: 'POST',
        body: JSON.stringify({
          ${integration.fields.map(f => `${f}: 'test-${f}'`).join(',\n          ')},
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(300);
      expect(data).toBeDefined();
    });`}

    ${integration.service ? `it('should return 400 when connection test fails', async () => {
      const mockService = {
        testConnection: jest.fn().mockResolvedValue(false),
      };
      (${integration.service} as jest.Mock).mockImplementation(() => mockService);

      const request = new MockNextRequest('http://localhost:3000/api/integrations/${integration.name}', {
        method: 'POST',
        body: JSON.stringify({
          ${integration.fields.map(f => `${f}: 'test-${f}'`).join(',\n          ')},
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message || data.error).toBeDefined();
    });` : ''}

    it('should return 500 on server error', async () => {
      ${integration.service ? `const mockService = {
        testConnection: jest.fn().mockRejectedValue(new Error('Connection error')),
      };
      (${integration.service} as jest.Mock).mockImplementation(() => mockService);` : ''}

      const request = new MockNextRequest('http://localhost:3000/api/integrations/${integration.name}', {
        method: 'POST',
        body: JSON.stringify({
          ${integration.fields.map(f => `${f}: 'test-${f}'`).join(',\n          ')},
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message || data.error).toBe('Internal server error');
    });
  });
});
`;

integrations.forEach(integration => {
  const testDir = path.join(__dirname, '..', 'src', 'app', 'api', 'integrations', integration.name, '__tests__');
  const testFile = path.join(testDir, 'route.test.ts');
  
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  
  fs.writeFileSync(testFile, testTemplate(integration));
  console.log(`✅ Created test file: ${testFile}`);
});

console.log(`\n✅ Created ${integrations.length} integration test files!`);

