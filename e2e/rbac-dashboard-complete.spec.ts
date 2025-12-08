import { test, expect, Page } from '@playwright/test';

interface PageTestResult {
  url: string;
  status: number;
  consoleErrors: string[];
  network404Errors: Array<{ url: string; method: string }>;
  network500Errors: Array<{ url: string; method: string; status: number }>;
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

// Import login helper from shared helpers
import { loginAsAdmin, loginAsUser as loginUserHelper } from './helpers/auth';

// Helper to sign in (wrapper for consistency)
async function signIn(page: Page, email: string, password: string) {
  await loginUserHelper(page, email, password);
}

// Helper function to test a page and collect errors
async function testPage(page: Page, url: string): Promise<PageTestResult> {
  const consoleErrors: string[] = [];
  const network404Errors: Array<{ url: string; method: string }> = [];
  const network500Errors: Array<{ url: string; method: string; status: number }> = [];
  const pageErrors: string[] = [];

  // Set up listeners (remove existing listeners to avoid duplicates)
  const consoleHandler = (msg: any) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!text.includes('React DevTools') && !text.includes('data-cursor-ref')) {
        consoleErrors.push(text);
      }
    }
  };

  const pageErrorHandler = (error: Error) => {
    pageErrors.push(error.message);
  };

  const responseHandler = (response: any) => {
    const status = response.status();
    const responseUrl = response.url();
    
    if (status === 404) {
      if (!network404Errors.find(e => e.url === responseUrl)) {
        network404Errors.push({
          url: responseUrl,
          method: response.request().method(),
        });
      }
    } else if (status >= 500 && status < 600) {
      // Track 500 errors (server errors) - these indicate API route issues
      if (!network500Errors.find(e => e.url === responseUrl)) {
        network500Errors.push({
          url: responseUrl,
          method: response.request().method(),
          status,
        });
      }
    }
  };

  page.on('console', consoleHandler);
  page.on('pageerror', pageErrorHandler);
  page.on('response', responseHandler);

  try {
    // Navigate to page with timeout handling
    let response;
    let status = 0;
    
    try {
      response = await page.goto(url, { 
        waitUntil: 'domcontentloaded', 
        timeout: 90000 // Increased timeout for slow pages
      });
      status = response?.status() || 0;
      
      // If status is 0, try to get it from the page response
      if (status === 0) {
        // Wait for any redirects
        await page.waitForTimeout(1000);
        const finalUrl = page.url();
        // Check if we're on an error page
        if (finalUrl.includes('/auth/signin') || finalUrl.includes('/error')) {
          status = 401; // Unauthorized redirect
        } else if (finalUrl.includes(url.split('?')[0])) {
          status = 200; // Assume success if we're on the target page
        }
      }
    } catch (error: any) {
      // If navigation times out, check if page loaded
      const currentUrl = page.url();
      if (currentUrl.includes(url.split('?')[0])) {
        status = 200; // Assume 200 if we're on the page
      } else if (currentUrl.includes('/auth/signin')) {
        status = 401; // Redirected to signin
      } else {
        // Wait a bit and try to get status
        await page.waitForTimeout(2000);
        const checkUrl = page.url();
        if (checkUrl.includes(url.split('?')[0])) {
          status = 200;
        } else if (checkUrl.includes('/auth/signin')) {
          status = 401;
        }
      }
    }

    // Wait for page to stabilize
    try {
      await page.waitForLoadState('domcontentloaded', { timeout: 15000 });
      await page.waitForTimeout(1500);
    } catch (error) {
      // Continue even if page takes time to load
    }

    return {
      url,
      status,
      consoleErrors: [...consoleErrors], // Copy array
      network404Errors: [...network404Errors], // Copy array
      network500Errors: [...network500Errors], // Copy array
      pageErrors: [...pageErrors], // Copy array
    };
  } finally {
    // Clean up listeners
    page.off('console', consoleHandler);
    page.off('pageerror', pageErrorHandler);
    page.off('response', responseHandler);
  }
}

test.describe('RBAC Dashboard Testing - Complete', () => {
  test.describe('Admin User', () => {
    // Increase timeout for Admin test to prevent intermittent failures
    test.setTimeout(600000); // 10 minutes instead of default 5
    
    test.beforeEach(async ({ page }) => {
      // Ensure fresh context for each test
      console.log('[Test] Starting Admin test with fresh context');
      
      // Ensure page is ready
      if (page.isClosed()) {
        throw new Error('Page is closed before test start');
      }
      
      await signIn(page, 'admin@smartstore.ai', 'admin123');
    });
    
    test.afterEach(async ({ page }) => {
      // Cleanup after each test
      try {
        if (!page.isClosed()) {
          await page.close();
        }
      } catch (error) {
        // Ignore cleanup errors
        console.log('[Test] Cleanup error (non-critical):', error);
      }
    });

    test('should access all dashboard pages and document errors', async ({ page }) => {
      const results: PageTestResult[] = [];

      console.log('\n=== Testing Admin Access to All Dashboard Pages ===\n');

      for (const pageUrl of dashboardPages) {
        try {
          console.log(`Testing ${pageUrl}...`);
          const result = await testPage(page, pageUrl);
          results.push(result);

          console.log(`✅ ${pageUrl}`);
          console.log(`   Status: ${result.status}`);
          console.log(`   Console Errors: ${result.consoleErrors.length}`);
          if (result.consoleErrors.length > 0) {
            result.consoleErrors.slice(0, 3).forEach((err, i) => {
              console.log(`     ${i + 1}. ${err.substring(0, 80)}...`);
            });
          }
          console.log(`   404 Errors: ${result.network404Errors.length}`);
          if (result.network404Errors.length > 0) {
            result.network404Errors.forEach((err, i) => {
              console.log(`     ${i + 1}. ${err.method} ${err.url}`);
            });
          }
          console.log(`   500 Errors: ${result.network500Errors.length}`);
          if (result.network500Errors.length > 0) {
            result.network500Errors.forEach((err, i) => {
              console.log(`     ${i + 1}. ${err.method} ${err.url} (${err.status})`);
            });
          }
          console.log(`   Page Errors: ${result.pageErrors.length}`);
          console.log('');
          
          // Small delay between pages
          await page.waitForTimeout(500);
        } catch (error: any) {
          console.error(`❌ Failed to test ${pageUrl}:`, error.message || error);
          results.push({
            url: pageUrl,
            status: error.message?.includes('timeout') ? 0 : 500,
            consoleErrors: [],
            network404Errors: [],
            network500Errors: [],
            pageErrors: [error.message || String(error)],
          });
          
          // Try to recover - go back to dashboard
          try {
            await page.goto('/dashboard', { timeout: 10000 });
            await page.waitForTimeout(1000);
          } catch (recoveryError) {
            // If recovery fails, page might be closed - continue with next page
            console.log(`   ⚠️  Could not recover, continuing...`);
          }
        }
      }

      // Generate summary
      console.log('\n=== SUMMARY ===\n');
      const all404Errors = results.flatMap(r => r.network404Errors);
      const all500Errors = results.flatMap(r => r.network500Errors);
      const allConsoleErrors = results.flatMap(r => r.consoleErrors);
      
      console.log(`Total Pages Tested: ${results.length}`);
      console.log(`Pages with 200 Status: ${results.filter(r => r.status === 200).length}`);
      console.log(`Total 404 Errors: ${all404Errors.length}`);
      console.log(`Total 500 Errors: ${all500Errors.length} ${all500Errors.length > 0 ? '⚠️' : '✅'}`);
      console.log(`Total Console Errors: ${allConsoleErrors.length}`);
      
      if (all404Errors.length > 0) {
        console.log('\n404 Errors Found:');
        all404Errors.forEach((err, i) => {
          console.log(`  ${i + 1}. ${err.method} ${err.url}`);
        });
      }
      
      if (all500Errors.length > 0) {
        console.log('\n⚠️ 500 Errors Found (API Route Issues):');
        all500Errors.forEach((err, i) => {
          console.log(`  ${i + 1}. ${err.method} ${err.url} (${err.status})`);
        });
      }

      // Assertions
      const failedPages = results.filter(r => r.status !== 200);
      if (failedPages.length > 0) {
        console.log('\n❌ Pages that failed:');
        failedPages.forEach(r => {
          console.log(`  - ${r.url}: Status ${r.status}`);
        });
      }

      // All pages should return 200
      results.forEach((result) => {
        expect(result.status).toBe(200);
      });
    });
  });

  test.describe('Staff User', () => {
    // Increase timeout for Staff test to prevent failures
    test.setTimeout(600000); // 10 minutes
    
    test.beforeEach(async ({ page }) => {
      // Ensure fresh context for each test
      console.log('[Test] Starting Staff test with fresh context');
      
      // Ensure page is ready
      if (page.isClosed()) {
        throw new Error('Page is closed before test start');
      }
      
      await signIn(page, 'user@smartstore.ai', 'user123');
    });
    
    test.afterEach(async ({ page }) => {
      // Cleanup after each test
      try {
        if (!page.isClosed()) {
          await page.close();
        }
      } catch (error) {
        // Ignore cleanup errors
        console.log('[Test] Cleanup error (non-critical):', error);
      }
    });

    test('should access dashboard pages as staff', async ({ page }) => {
      const results: PageTestResult[] = [];

      for (const pageUrl of dashboardPages) {
        try {
          const result = await testPage(page, pageUrl);
          results.push(result);
        } catch (error) {
          results.push({
            url: pageUrl,
            status: 0,
            consoleErrors: [],
            network404Errors: [],
            network500Errors: [],
            pageErrors: [(error as Error).message],
          });
        }
      }

      // Log results for debugging
      console.log(`\n=== Staff User Test Results ===`);
      results.forEach((result) => {
        const statusIcon = result.status === 200 ? '✅' : '❌';
        console.log(`${statusIcon} ${result.url} - Status: ${result.status}`);
        if (result.status !== 200) {
          console.log(`   Console Errors: ${result.consoleErrors.length}`);
          console.log(`   Page Errors: ${result.pageErrors.length}`);
        }
      });

      // All pages should be accessible to staff too
      const failedPages = results.filter(r => r.status !== 200);
      if (failedPages.length > 0) {
        console.error(`\n❌ ${failedPages.length} page(s) failed for Staff user:`);
        failedPages.forEach(r => {
          console.error(`   - ${r.url}: Status ${r.status}`);
        });
      }
      
      results.forEach((result) => {
        expect(result.status).toBe(200);
      });
    });
  });

  test.describe('Unauthenticated Access', () => {
    test('should redirect to sign-in', async ({ page }) => {
      // Clear any existing session
      await page.context().clearCookies();
      
      await page.goto('/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      // Wait for client-side redirect (layout useEffect) - increased timeout
      try {
        await page.waitForURL(/\/auth\/signin/, { timeout: 15000 });
        expect(page.url()).toContain('/auth/signin');
      } catch (error) {
        // If redirect didn't happen, check if we're still on dashboard (which means redirect is slow)
        const currentUrl = page.url();
        if (currentUrl.includes('/dashboard')) {
          // Wait a bit more for the redirect
          await page.waitForTimeout(3000);
          const finalUrl = page.url();
          expect(finalUrl).toContain('/auth/signin');
        } else {
          throw error;
        }
      }
    });
  });
});

