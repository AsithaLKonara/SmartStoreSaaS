import { test, expect, Page } from '@playwright/test';
import { loginAsAdmin, loginAsUser } from './helpers/auth';

interface PageTestResult {
  url: string;
  status: number;
  consoleErrors: string[];
  networkErrors: Array<{ url: string; status: number; method: string }>;
  pageErrors: string[];
}

// All dashboard pages to test
const dashboardPages = [
  '/dashboard',
  '/products',
  '/products/new',
  '/orders',
  '/customers',
  '/analytics',
  '/analytics/bi',
  '/analytics/enhanced',
  '/integrations',
  '/payments',
  '/campaigns',
  '/reports',
  '/chat',
  '/warehouse',
  '/couriers',
  '/expenses',
  '/sync',
  '/bulk-operations',
  '/test-harness',
];

// Helper function to test a page and collect errors
async function testPage(page: Page, url: string): Promise<PageTestResult> {
  const consoleErrors: string[] = [];
  const networkErrors: Array<{ url: string; status: number; method: string }> = [];
  const pageErrors: string[] = [];

  // Listen for console errors
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Filter out harmless warnings
      if (!text.includes('React DevTools') && !text.includes('data-cursor-ref')) {
        consoleErrors.push(text);
      }
    }
  });

  // Listen for page errors
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  // Listen for failed network requests
  page.on('response', (response) => {
    const status = response.status();
    if (status >= 400) {
      const request = response.request();
      networkErrors.push({
        url: response.url(),
        status,
        method: request.method(),
      });
    }
  });

  // Navigate to page with more lenient timeout
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const status = response?.status() || 0;

  // Wait for page to be interactive
  await page.waitForLoadState('domcontentloaded');
  
  // Wait a bit for any async operations, but shorter
  await page.waitForTimeout(1000);

  return {
    url,
    status,
    consoleErrors,
    networkErrors: networkErrors.filter(err => err.status === 404), // Only 404s
    pageErrors,
  };
}

test.describe('RBAC Dashboard Testing', () => {
  test.describe('Admin User', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
    });

    test('should access all dashboard pages as admin', async ({ page }) => {
      const results: PageTestResult[] = [];

      for (const pageUrl of dashboardPages) {
        const result = await testPage(page, pageUrl);
        results.push(result);

        // Log progress
        console.log(`\n✅ Tested: ${pageUrl}`);
        console.log(`   Status: ${result.status}`);
        console.log(`   Console Errors: ${result.consoleErrors.length}`);
        console.log(`   404 Errors: ${result.networkErrors.length}`);
        console.log(`   Page Errors: ${result.pageErrors.length}`);
      }

      // Generate detailed report
      console.log('\n=== COMPLETE RBAC TEST RESULTS ===\n');
      
      results.forEach((result) => {
        console.log(`\n📄 Page: ${result.url}`);
        console.log(`   Status: ${result.status === 200 ? '✅' : '❌'} ${result.status}`);
        
        if (result.consoleErrors.length > 0) {
          console.log(`   Console Errors (${result.consoleErrors.length}):`);
          result.consoleErrors.forEach((err, i) => {
            console.log(`     ${i + 1}. ${err.substring(0, 100)}...`);
          });
        }
        
        if (result.networkErrors.length > 0) {
          console.log(`   404 Errors (${result.networkErrors.length}):`);
          result.networkErrors.forEach((err, i) => {
            console.log(`     ${i + 1}. ${err.method} ${err.url}`);
          });
        }
        
        if (result.pageErrors.length > 0) {
          console.log(`   Page Errors (${result.pageErrors.length}):`);
          result.pageErrors.forEach((err, i) => {
            console.log(`     ${i + 1}. ${err.substring(0, 100)}...`);
          });
        }
      });

      // Assertions
      results.forEach((result) => {
        expect(result.status).toBe(200);
      });
    });

    test('should verify admin session', async ({ page }) => {
      await page.goto('/dashboard');
      
      // Check session
      const sessionResponse = await page.request.get('/api/auth/session');
      const session = await sessionResponse.json();
      
      expect(sessionResponse.status()).toBe(200);
      expect(session?.user?.email).toBe('admin@smartstore.ai');
      expect(session?.user?.role).toBe('ADMIN');
    });

    // Test individual pages with detailed error reporting
    for (const pageUrl of dashboardPages) {
      test(`admin can access ${pageUrl} without errors`, async ({ page }) => {
        const result = await testPage(page, pageUrl);
        
        expect(result.status).toBe(200);
        expect(result.pageErrors).toHaveLength(0);
        
        // Log any console errors (for debugging)
        if (result.consoleErrors.length > 0) {
          console.log(`Console errors on ${pageUrl}:`, result.consoleErrors);
        }
        
        // Log 404 errors
        if (result.networkErrors.length > 0) {
          console.log(`404 errors on ${pageUrl}:`, result.networkErrors);
        }
      });
    }
  });

  test.describe('Staff User', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsUser(page);
    });

    test('should access dashboard pages as staff', async ({ page }) => {
      const results: PageTestResult[] = [];

      for (const pageUrl of dashboardPages) {
        const result = await testPage(page, pageUrl);
        results.push(result);
      }

      // Verify staff can access pages
      results.forEach((result) => {
        expect(result.status).toBe(200);
      });
    });

    test('should verify staff session', async ({ page }) => {
      await page.goto('/dashboard');
      
      const sessionResponse = await page.request.get('/api/auth/session');
      const session = await sessionResponse.json();
      
      expect(sessionResponse.status()).toBe(200);
      expect(session?.user?.email).toBe('user@smartstore.ai');
      expect(session?.user?.role).toBe('STAFF');
    });
  });

  test.describe('Unauthenticated Access', () => {
    test('should redirect to sign-in when accessing dashboard pages', async ({ page }) => {
      for (const pageUrl of dashboardPages.slice(0, 5)) { // Test first 5 pages
        await page.goto(pageUrl);
        await page.waitForURL(/\/auth\/signin/, { timeout: 5000 });
        expect(page.url()).toContain('/auth/signin');
      }
    });
  });
});

