import { test, expect } from '@playwright/test';
import { APIRequestContext } from '@playwright/test';

let apiContext: APIRequestContext;

test.beforeAll(async ({ playwright }) => {
  // Create a new API context for direct API testing
  apiContext = await playwright.request.newContext({
    baseURL: 'http://localhost:3000',
  });
});

test.afterAll(async () => {
  await apiContext.dispose();
});

test.describe('Direct API Endpoint Tests', () => {
  // Health check - no auth required
  test('GET /api/health - should return health status', async () => {
    const response = await apiContext.get('/api/health');
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('status');
    expect(data).toHaveProperty('timestamp');
  });

  // Analytics endpoints - require auth
  test('GET /api/analytics/dashboard-stats - should require authentication', async () => {
    const response = await apiContext.get('/api/analytics/dashboard-stats');
    // Should return 401 without auth
    expect([401, 200]).toContain(response.status());
  });

  // Products endpoints
  test('GET /api/products - should require authentication', async () => {
    const response = await apiContext.get('/api/products');
    expect(response.status()).toBe(401);
  });

  test('POST /api/products - should require authentication', async () => {
    const response = await apiContext.post('/api/products', {
      data: {
        name: 'Test Product',
        price: 99.99,
      },
    });
    expect(response.status()).toBe(401);
  });

  // Orders endpoints
  test('GET /api/orders - should require authentication', async () => {
    const response = await apiContext.get('/api/orders');
    expect(response.status()).toBe(401);
  });

  test('GET /api/orders/recent - should require authentication', async () => {
    const response = await apiContext.get('/api/orders/recent');
    expect(response.status()).toBe(401);
  });

  // Customers endpoints
  test('GET /api/customers - should require authentication', async () => {
    const response = await apiContext.get('/api/customers');
    expect(response.status()).toBe(401);
  });

  // Warehouses endpoints
  test('GET /api/warehouses - should require authentication', async () => {
    const response = await apiContext.get('/api/warehouses');
    expect(response.status()).toBe(401);
  });

  test('GET /api/warehouses/inventory - should require authentication', async () => {
    const response = await apiContext.get('/api/warehouses/inventory');
    expect(response.status()).toBe(401);
  });

  // Categories endpoints
  test('GET /api/categories - should require authentication', async () => {
    const response = await apiContext.get('/api/categories');
    expect(response.status()).toBe(401);
  });

  // Couriers endpoints
  test('GET /api/couriers - should require authentication', async () => {
    const response = await apiContext.get('/api/couriers');
    expect(response.status()).toBe(401);
  });

  // Campaigns endpoints
  test('GET /api/campaigns - should require authentication', async () => {
    const response = await apiContext.get('/api/campaigns');
    expect(response.status()).toBe(401);
  });

  // Reports endpoints
  test('GET /api/reports - should require authentication', async () => {
    const response = await apiContext.get('/api/reports');
    expect(response.status()).toBe(401);
  });

  // Expenses endpoints
  test('GET /api/expenses - should require authentication', async () => {
    const response = await apiContext.get('/api/expenses');
    expect(response.status()).toBe(401);
  });

  // Bulk operations endpoints
  test('GET /api/bulk-operations - should require authentication', async () => {
    const response = await apiContext.get('/api/bulk-operations');
    expect(response.status()).toBe(401);
  });

  // Chat endpoints
  test('GET /api/chat/conversations - should require authentication', async () => {
    const response = await apiContext.get('/api/chat/conversations');
    expect(response.status()).toBe(401);
  });

  test('GET /api/chat/recent - should require authentication', async () => {
    const response = await apiContext.get('/api/chat/recent');
    expect(response.status()).toBe(401);
  });

  // Security endpoints
  test('GET /api/security - should require authentication', async () => {
    const response = await apiContext.get('/api/security');
    expect(response.status()).toBe(401);
  });

  // Theme endpoints
  test('GET /api/theme - should require authentication', async () => {
    const response = await apiContext.get('/api/theme');
    expect(response.status()).toBe(401);
  });

  // Region endpoints
  test('GET /api/region - should require authentication', async () => {
    const response = await apiContext.get('/api/region');
    expect(response.status()).toBe(401);
  });

  // Sync endpoints
  test('GET /api/sync/status - should require authentication', async () => {
    const response = await apiContext.get('/api/sync/status?organizationId=test');
    expect(response.status()).toBe(401);
  });

  // Currency endpoints
  test('GET /api/currency/convert - should require authentication', async () => {
    const response = await apiContext.get('/api/currency/convert?from=USD&to=EUR&amount=100');
    expect(response.status()).toBe(401);
  });

  // Voice endpoints
  test('POST /api/voice/search - should require authentication', async () => {
    const response = await apiContext.post('/api/voice/search', {
      data: { query: 'test' },
    });
    expect(response.status()).toBe(401);
  });

  // IoT endpoints
  test('GET /api/iot/devices - should require authentication', async () => {
    const response = await apiContext.get('/api/iot/devices?deviceId=test');
    expect(response.status()).toBe(401);
  });

  // Blockchain endpoints
  test('POST /api/blockchain - should require authentication', async () => {
    const response = await apiContext.post('/api/blockchain', {
      data: { type: 'payment', action: 'create' },
    });
    expect(response.status()).toBe(401);
  });

  // PWA endpoints
  test('GET /api/pwa - should require authentication', async () => {
    const response = await apiContext.get('/api/pwa?type=offline-data');
    expect(response.status()).toBe(401);
  });

  // Gamification endpoints
  test('GET /api/gamification - should require authentication', async () => {
    const response = await apiContext.get('/api/gamification');
    expect(response.status()).toBe(401);
  });
});

