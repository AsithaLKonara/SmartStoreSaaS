#!/usr/bin/env ts-node
/**
 * Test Generator for API Routes
 * 
 * Generates test files for API routes based on configuration
 * Usage: ts-node scripts/generate-route-test.ts <route-path>
 * Example: ts-node scripts/generate-route-test.ts /api/products
 */

import * as fs from 'fs';
import * as path from 'path';

interface RouteConfig {
  path: string;
  methods: string[];
  prismaModels?: string[];
  services?: string[];
  requiresEmail?: boolean;
  noAuth?: boolean;
  sampleGetResponse?: any;
  samplePostBody?: any;
  samplePutBody?: any;
  sampleDeleteBody?: any;
}

const TEMPLATE_PATH = path.join(__dirname, '../templates/route-test-template.ts');
const CONFIG_PATH = path.join(__dirname, 'route-test-config.json');

function loadTemplate(): string {
  return fs.readFileSync(TEMPLATE_PATH, 'utf-8');
}

function loadConfig(): { routes: RouteConfig[] } {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
}

function findRouteConfig(routePath: string): RouteConfig | undefined {
  const config = loadConfig();
  return config.routes.find(r => r.path === routePath);
}

function generatePrismaMocks(models: string[] = []): string {
  if (models.length === 0) {
    return '    // No Prisma models needed';
  }

  const mocks = models.map(model => {
    const modelName = model.charAt(0).toUpperCase() + model.slice(1);
    return `    ${model}: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },`;
  }).join('\n');

  return mocks;
}

function generateServiceMocks(services: string[] = []): string {
  if (services.length === 0) {
    return '';
  }

  const serviceMocks = services.map(service => {
    const serviceName = service.charAt(0).toUpperCase() + service.slice(1).replace(/Service$/, '') + 'Service';
    return `jest.mock('@/lib/${service}', () => ({
  ${service}: {
    // Add service methods here
  },
}));`;
  }).join('\n\n');

  return serviceMocks;
}

function generateMethodTests(method: string, config: RouteConfig): string {
  const methodLower = method.toLowerCase();
  const routeName = config.path.replace(/^\/api\//, '').replace(/\//g, '-');
  
  let tests = `  describe('${method}', () => {
    it('should return 401 for unauthorized requests', async () => {
      ${config.noAuth ? '// No auth required' : `(getServerSession as jest.Mock).mockResolvedValue({ user: {} });`}

      const request = new MockNextRequest('http://localhost:3000${config.path}');
      const response = await ${method}(request);
      const data = await response.json();

      expect(response.status).toBe(${config.noAuth ? '200' : '401'});
      ${config.noAuth ? '' : `expect(data.message || data.error).toBe('Unauthorized');`}
    });`;

  if (method === 'GET') {
    tests += `
    it('should return ${routeName} list', async () => {
      const mockData = ${JSON.stringify(config.sampleGetResponse || [], null, 6)};
      ${config.prismaModels?.[0] ? `(prisma.${config.prismaModels[0]}.findMany as jest.Mock).mockResolvedValue(mockData);` : ''}

      const request = new MockNextRequest('http://localhost:3000${config.path}');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toBeDefined();
    });

    it('should ensure organization data isolation', async () => {
      ${config.prismaModels?.[0] ? `(prisma.${config.prismaModels[0]}.findMany as jest.Mock).mockResolvedValue([]);` : ''}

      const request = new MockNextRequest('http://localhost:3000${config.path}');
      await GET(request);

      ${config.prismaModels?.[0] ? `expect(prisma.${config.prismaModels[0]}.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org-1' },
        })
      );` : '// Organization isolation check'}
    });`;
  } else if (method === 'POST') {
    tests += `
    it('should return 400 for missing required fields', async () => {
      const request = new MockNextRequest('http://localhost:3000${config.path}', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.status).toBeLessThan(500);
    });

    it('should create ${routeName} successfully', async () => {
      const mockData = ${JSON.stringify(config.samplePostBody || {}, null, 6)};
      ${config.prismaModels?.[0] ? `(prisma.${config.prismaModels[0]}.create as jest.Mock).mockResolvedValue({ id: 'test-id', ...mockData });` : ''}

      const request = new MockNextRequest('http://localhost:3000${config.path}', {
        method: 'POST',
        body: JSON.stringify(mockData),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(300);
      expect(data).toBeDefined();
    });`;
  } else if (method === 'PUT') {
    tests += `
    it('should update ${routeName} successfully', async () => {
      const mockData = ${JSON.stringify(config.samplePutBody || config.samplePostBody || {}, null, 6)};
      ${config.prismaModels?.[0] ? `(prisma.${config.prismaModels[0]}.update as jest.Mock).mockResolvedValue({ id: 'test-id', ...mockData });` : ''}

      const request = new MockNextRequest('http://localhost:3000${config.path}?id=test-id', {
        method: 'PUT',
        body: JSON.stringify(mockData),
      });
      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(300);
      expect(data).toBeDefined();
    });`;
  } else if (method === 'DELETE') {
    tests += `
    it('should delete ${routeName} successfully', async () => {
      ${config.prismaModels?.[0] ? `(prisma.${config.prismaModels[0]}.delete as jest.Mock).mockResolvedValue({ id: 'test-id' });` : ''}

      const request = new MockNextRequest('http://localhost:3000${config.path}?id=test-id', {
        method: 'DELETE',
      });
      const response = await DELETE(request);

      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(300);
    });`;
  }

  tests += `
    it('should return 500 on server error', async () => {
      ${config.prismaModels?.[0] ? `(prisma.${config.prismaModels[0]}.${method === 'GET' ? 'findMany' : method === 'POST' ? 'create' : method === 'PUT' ? 'update' : 'delete'} as jest.Mock).mockRejectedValue(new Error('Database error'));` : ''}

      const request = new MockNextRequest('http://localhost:3000${config.path}', {
        method: '${method}',
        ${method !== 'GET' && method !== 'DELETE' ? `body: JSON.stringify(${JSON.stringify(config.samplePostBody || {})}),` : ''}
      });
      const response = await ${method}(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message || data.error).toBe('Internal server error');
    });
  });`;

  return tests;
}

function generateTestFile(config: RouteConfig): string {
  const template = loadTemplate();
  const methods = config.methods.join(', ');
  const routePath = config.path;
  const routeName = routePath.replace(/^\/api\//, '').replace(/\//g, '-');
  
  // Generate imports
  const serviceImports = config.services?.map(s => {
    const serviceName = s.charAt(0).toUpperCase() + s.slice(1).replace(/Service$/, '') + 'Service';
    return `import { ${serviceName} } from '@/lib/${s}';`;
  }).join('\n') || '';

  // Generate service mocks
  const serviceMocks = generateServiceMocks(config.services);
  const serviceClear = config.services?.map(s => {
    return `    // Clear ${s} mocks if needed`;
  }).join('\n') || '';

  // Generate Prisma mocks
  const prismaMocks = generatePrismaMocks(config.prismaModels);

  // Generate method tests
  const getTests = config.methods.includes('GET') ? generateMethodTests('GET', config) : '';
  const postTests = config.methods.includes('POST') ? generateMethodTests('POST', config) : '';
  const putTests = config.methods.includes('PUT') ? generateMethodTests('PUT', config) : '';
  const deleteTests = config.methods.includes('DELETE') ? generateMethodTests('DELETE', config) : '';

  // Determine if headers are needed
  const needsHeaders = false; // Can be enhanced based on route
  const headersProperty = needsHeaders ? 'headers: Headers;' : '';
  const headersParam = needsHeaders ? '; headers?: HeadersInit' : '';
  const headersInit = needsHeaders ? 'this.headers = new Headers(init?.headers || {});' : '';
  const textMethod = needsHeaders ? '\n  async text() {\n    return this.body;\n  }' : '';

  // Email property
  const emailProperty = config.requiresEmail ? "email: 'test@example.com',\n      " : '';

  // Replace template placeholders
  return template
    .replace(/{{METHODS}}/g, methods)
    .replace(/{{ROUTE_PATH}}/g, routePath)
    .replace(/{{SERVICE_IMPORTS}}/g, serviceImports)
    .replace(/{{PRISMA_MOCKS}}/g, prismaMocks)
    .replace(/{{SERVICE_MOCKS}}/g, serviceMocks)
    .replace(/{{SERVICE_CLEAR}}/g, serviceClear)
    .replace(/{{GET_TESTS}}/g, getTests)
    .replace(/{{POST_TESTS}}/g, postTests)
    .replace(/{{PUT_TESTS}}/g, putTests)
    .replace(/{{DELETE_TESTS}}/g, deleteTests)
    .replace(/{{HEADERS_PROPERTY}}/g, headersProperty)
    .replace(/{{HEADERS_PARAM}}/g, headersParam)
    .replace(/{{HEADERS_INIT}}/g, headersInit)
    .replace(/{{TEXT_METHOD}}/g, textMethod)
    .replace(/{{EMAIL_PROPERTY}}/g, emailProperty);
}

function getTestFilePath(routePath: string): string {
  const routeParts = routePath.replace(/^\/api\//, '').split('/');
  const testDir = path.join(__dirname, '..', 'src', 'app', 'api', ...routeParts, '__tests__');
  return path.join(testDir, 'route.test.ts');
}

function main() {
  const routePath = process.argv[2];
  
  if (!routePath) {
    console.error('Usage: ts-node scripts/generate-route-test.ts <route-path>');
    console.error('Example: ts-node scripts/generate-route-test.ts /api/products');
    process.exit(1);
  }

  const config = findRouteConfig(routePath);
  if (!config) {
    console.error(`Route config not found for: ${routePath}`);
    console.error('Available routes:');
    const allConfig = loadConfig();
    allConfig.routes.forEach(r => console.error(`  - ${r.path}`));
    process.exit(1);
  }

  const testContent = generateTestFile(config);
  const testFilePath = getTestFilePath(routePath);
  const testDir = path.dirname(testFilePath);

  // Create directory if it doesn't exist
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  // Write test file
  fs.writeFileSync(testFilePath, testContent);
  console.log(`✅ Generated test file: ${testFilePath}`);
  console.log(`   Methods: ${config.methods.join(', ')}`);
  console.log(`   Prisma models: ${config.prismaModels?.join(', ') || 'none'}`);
  console.log(`   Services: ${config.services?.join(', ') || 'none'}`);
}

if (require.main === module) {
  main();
}

export { generateTestFile, findRouteConfig, loadConfig };

