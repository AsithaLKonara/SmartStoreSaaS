import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

test.describe('User Flow Tests - API Routes Through UI', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('Dashboard page - should load analytics and orders APIs', async ({ page }) => {
    // Monitor API calls
    const apiCalls: string[] = [];
    
    page.on('response', (response) => {
      const url = response.url();
      if (url.includes('/api/')) {
        apiCalls.push(url);
      }
    });

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Verify API calls were made
    expect(apiCalls.some(url => url.includes('/api/analytics/dashboard-stats'))).toBeTruthy();
    expect(apiCalls.some(url => url.includes('/api/orders/recent'))).toBeTruthy();
    expect(apiCalls.some(url => url.includes('/api/chat/recent'))).toBeTruthy();
  });

  test('Products page - should load products API', async ({ page }) => {
    const apiCalls: string[] = [];
    
    page.on('response', (response) => {
      const url = response.url();
      if (url.includes('/api/products')) {
        apiCalls.push(url);
      }
    });

    await page.goto('/products');
    await page.waitForLoadState('networkidle');

    // Verify products API was called
    expect(apiCalls.length).toBeGreaterThan(0);
    expect(apiCalls.some(url => url.includes('/api/products'))).toBeTruthy();
  });

  test('Orders page - should load orders API', async ({ page }) => {
    const apiCalls: string[] = [];
    
    page.on('response', (response) => {
      const url = response.url();
      if (url.includes('/api/orders')) {
        apiCalls.push(url);
      }
    });

    await page.goto('/orders');
    await page.waitForLoadState('networkidle');

    // Verify orders API was called
    expect(apiCalls.length).toBeGreaterThan(0);
  });

  test('Customers page - should load customers API', async ({ page }) => {
    const apiCalls: string[] = [];
    
    page.on('response', (response) => {
      const url = response.url();
      if (url.includes('/api/customers')) {
        apiCalls.push(url);
      }
    });

    await page.goto('/customers');
    await page.waitForLoadState('networkidle');

    // Verify customers API was called
    expect(apiCalls.length).toBeGreaterThan(0);
  });

  test('Warehouse page - should load warehouse APIs', async ({ page }) => {
    const apiCalls: string[] = [];
    
    page.on('response', (response) => {
      const url = response.url();
      if (url.includes('/api/warehouses')) {
        apiCalls.push(url);
      }
    });

    await page.goto('/warehouse');
    await page.waitForLoadState('networkidle');

    // Verify warehouse APIs were called
    expect(apiCalls.length).toBeGreaterThan(0);
  });

  test('Campaigns page - should load campaigns API', async ({ page }) => {
    const apiCalls: string[] = [];
    
    page.on('response', (response) => {
      const url = response.url();
      if (url.includes('/api/campaigns')) {
        apiCalls.push(url);
      }
    });

    await page.goto('/campaigns');
    await page.waitForLoadState('networkidle');

    // Verify campaigns API was called
    expect(apiCalls.length).toBeGreaterThan(0);
  });

  test('Reports page - should load reports API', async ({ page }) => {
    const apiCalls: string[] = [];
    
    page.on('response', (response) => {
      const url = response.url();
      if (url.includes('/api/reports')) {
        apiCalls.push(url);
      }
    });

    await page.goto('/reports');
    await page.waitForLoadState('networkidle');

    // Verify reports API was called
    expect(apiCalls.length).toBeGreaterThan(0);
  });

  test('Chat page - should load chat APIs', async ({ page }) => {
    const apiCalls: string[] = [];
    
    page.on('response', (response) => {
      const url = response.url();
      if (url.includes('/api/chat')) {
        apiCalls.push(url);
      }
    });

    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // Verify chat APIs were called
    expect(apiCalls.length).toBeGreaterThan(0);
  });

  test('Sync page - should load sync status API', async ({ page }) => {
    const apiCalls: string[] = [];
    
    page.on('response', (response) => {
      const url = response.url();
      if (url.includes('/api/sync/status')) {
        apiCalls.push(url);
      }
    });

    await page.goto('/sync');
    await page.waitForLoadState('networkidle');

    // Verify sync API was called
    expect(apiCalls.length).toBeGreaterThan(0);
  });

  test('Analytics page - should load analytics APIs', async ({ page }) => {
    const apiCalls: string[] = [];
    
    page.on('response', (response) => {
      const url = response.url();
      if (url.includes('/api/analytics')) {
        apiCalls.push(url);
      }
    });

    await page.goto('/analytics');
    await page.waitForLoadState('networkidle');

    // Verify analytics APIs were called
    expect(apiCalls.length).toBeGreaterThan(0);
  });
});

