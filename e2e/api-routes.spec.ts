import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

test.describe('API Routes Test Harness', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/test-harness');
    await page.waitForLoadState('networkidle');
  });

  test('should display test harness page', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('API Test Harness');
    await expect(page.locator('button:has-text("Test All")')).toBeVisible();
  });

  test('should filter routes by category', async ({ page }) => {
    const categorySelect = page.locator('select');
    await categorySelect.selectOption('Payments');
    
    // Wait for routes to filter
    await page.waitForTimeout(500);
    
    // Check that only payment routes are visible
    const routeCards = page.locator('.border.rounded-lg');
    const count = await routeCards.count();
    
    // Should have payment routes visible
    expect(count).toBeGreaterThan(0);
    
    // Verify all visible routes are payment routes
    for (let i = 0; i < count; i++) {
      const card = routeCards.nth(i);
      const category = await card.locator('.bg-gray-100').textContent();
      expect(category).toContain('Payments');
    }
  });

  test('should test individual route', async ({ page }) => {
    // Find a GET route (health check doesn't require auth)
    const healthRoute = page.locator('text=/api/health').first();
    
    if (await healthRoute.isVisible()) {
      // Click test button for health route
      const testButton = healthRoute.locator('..').locator('button:has-text("Test")');
      await testButton.click();
      
      // Wait for test to complete
      await page.waitForTimeout(2000);
      
      // Check for status indicator
      const status = healthRoute.locator('..').locator('.text-green-600, .text-red-600').first();
      await expect(status).toBeVisible();
    }
  });

  test('should test all routes in category', async ({ page }) => {
    // Select a category with fewer routes for faster testing
    await page.locator('select').selectOption('Health');
    await page.waitForTimeout(500);
    
    // Click "Test All" button
    const testAllButton = page.locator('button:has-text("Test All")');
    await testAllButton.click();
    
    // Wait for tests to complete (with timeout)
    await page.waitForTimeout(5000);
    
    // Check that test summary shows results
    const summary = page.locator('text=Test Summary');
    await expect(summary).toBeVisible();
  });

  test('should display test results', async ({ page }) => {
    // Test a single route
    const firstRoute = page.locator('.border.rounded-lg').first();
    const testButton = firstRoute.locator('button:has-text("Test")');
    
    await testButton.click();
    
    // Wait for result
    await page.waitForTimeout(2000);
    
    // Check that status is displayed
    const status = firstRoute.locator('.text-green-600, .text-red-600, .text-blue-600');
    await expect(status.first()).toBeVisible();
  });

  test('should show response details', async ({ page }) => {
    // Test a route
    const firstRoute = page.locator('.border.rounded-lg').first();
    const testButton = firstRoute.locator('button:has-text("Test")');
    
    await testButton.click();
    await page.waitForTimeout(2000);
    
    // Check if "View Response" details exist
    const viewResponse = firstRoute.locator('summary:has-text("View Response")');
    
    if (await viewResponse.isVisible()) {
      await viewResponse.click();
      
      // Check that response JSON is displayed
      const responsePre = firstRoute.locator('pre');
      await expect(responsePre).toBeVisible();
    }
  });

  test('should show test summary', async ({ page }) => {
    // Run a few tests
    const routes = page.locator('.border.rounded-lg');
    const count = Math.min(await routes.count(), 3);
    
    for (let i = 0; i < count; i++) {
      const route = routes.nth(i);
      const testButton = route.locator('button:has-text("Test")');
      await testButton.click();
      await page.waitForTimeout(500);
    }
    
    // Check summary section
    const summary = page.locator('text=Test Summary');
    await expect(summary).toBeVisible();
    
    // Check summary stats
    await expect(page.locator('text=/Total:/')).toBeVisible();
    await expect(page.locator('text=/Passed:/')).toBeVisible();
    await expect(page.locator('text=/Failed:/')).toBeVisible();
  });
});

