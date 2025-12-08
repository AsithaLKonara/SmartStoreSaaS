import { Page, BrowserContext } from '@playwright/test';

/**
 * Check if page and browser context are still valid
 */
function isPageValid(page: Page): boolean {
  try {
    if (page.isClosed()) {
      return false;
    }
    const context = page.context();
    if (!context) {
      return false;
    }
    const browser = context.browser();
    if (!browser || !browser.isConnected()) {
      return false;
    }
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Safely get page URL with error handling
 */
async function getPageUrl(page: Page): Promise<string> {
  try {
    if (!isPageValid(page)) {
      throw new Error('Page or browser context is invalid');
    }
    return page.url();
  } catch (error: any) {
    throw new Error(`Failed to get page URL: ${error.message}`);
  }
}

export async function loginAsAdmin(page: Page) {
  await loginAsUser(page, 'admin@smartstore.ai', 'admin123', 'ADMIN');
}

export async function loginAsUser(page: Page, email: string = 'user@smartstore.ai', password: string = 'user123', expectedRole?: string) {
  const role = expectedRole || 'UNKNOWN';
  console.log(`[Login] Starting login process for ${email} (role: ${role})`);
  
  // Enhanced page validity check with retry
  const checkPageValidity = async (): Promise<boolean> => {
    try {
      if (page.isClosed()) {
        console.error(`[Login] Page is closed`);
        return false;
      }
      // Try to access page context
      const context = page.context();
      if (!context) {
        console.error(`[Login] Page context is null`);
        return false;
      }
      const browser = context.browser();
      if (!browser || !browser.isConnected()) {
        console.error(`[Login] Browser is not connected`);
        return false;
      }
      // Try to get URL as final check
      await page.url();
      return true;
    } catch (error: any) {
      console.error(`[Login] Page validity check failed: ${error.message}`);
      return false;
    }
  };
  
  try {
    // Check page state before navigation with retry
    let pageValid = await checkPageValidity();
    if (!pageValid) {
      console.error(`[Login] Page or browser context invalid before starting`);
      throw new Error('Page or browser context is invalid before starting login');
    }
    console.log(`[Login] Page and browser context valid`);

    console.log(`[Login] Navigating to /auth/signin`);
    await page.goto('/auth/signin', { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log(`[Login] Navigation complete, current URL: ${await getPageUrl(page)}`);
  
  // Wait for form to be ready
    console.log(`[Login] Waiting for form elements...`);
    try {
  await page.waitForSelector('input[name="email"]', { timeout: 10000 });
  await page.waitForSelector('input[name="password"]', { timeout: 10000 });
      console.log(`[Login] Form elements found`);
    } catch (error: any) {
      console.error(`[Login] Error waiting for form: ${error.message}`);
      throw new Error(`Form elements not found: ${error.message}`);
    }
  
    // Clear and fill credentials - use type to trigger React onChange events
    console.log(`[Login] Filling credentials for ${email}`);
    try {
      // Clear inputs first
  await page.fill('input[name="email"]', '');
  await page.fill('input[name="password"]', '');
      await page.waitForTimeout(300);
      
      // Focus and type to trigger React onChange events properly
      await page.focus('input[name="email"]');
      await page.type('input[name="email"]', email, { delay: 30 });
      await page.waitForTimeout(300);
      
      await page.focus('input[name="password"]');
      await page.type('input[name="password"]', password, { delay: 30 });
      
      // Wait for React state to update and form validation
      await page.waitForTimeout(1000);
      
      // Verify values are set - retry if needed
      let emailValue = await page.inputValue('input[name="email"]');
      let passwordValue = await page.inputValue('input[name="password"]');
      
      // If email is still empty, try fill as fallback
      if (!emailValue || emailValue !== email) {
        console.log(`[Login] Email not set via type, trying fill...`);
  await page.fill('input[name="email"]', email);
        await page.waitForTimeout(500);
        emailValue = await page.inputValue('input[name="email"]');
      }
      
      console.log(`[Login] Email set: ${emailValue}, Password set: ${passwordValue ? '***' : 'empty'}`);
      
      if (!emailValue || emailValue !== email) {
        throw new Error(`Email not set correctly. Expected: ${email}, Got: ${emailValue || 'empty'}`);
      }
      
      console.log(`[Login] Credentials filled and verified`);
    } catch (error: any) {
      console.error(`[Login] Error filling credentials: ${error.message}`);
      throw new Error(`Failed to fill credentials: ${error.message}`);
    }
  
  // Wait for form validation to enable button
    console.log(`[Login] Waiting for submit button...`);
  const submitButton = page.locator('button[type="submit"]');
    try {
  await submitButton.waitFor({ state: 'visible', timeout: 5000 });
      console.log(`[Login] Submit button visible`);
    } catch (error: any) {
      console.error(`[Login] Error waiting for submit button: ${error.message}`);
      throw new Error(`Submit button not found: ${error.message}`);
    }
  
    // Wait for button to not be disabled - use simple polling instead of waitForFunction
    console.log(`[Login] Waiting for button to be enabled...`);
    let buttonEnabled = false;
    for (let i = 0; i < 10; i++) {
      if (!isPageValid(page)) {
        throw new Error('Page closed during button enable check');
      }
      
      try {
        buttonEnabled = await page.evaluate(() => {
      const btn = document.querySelector('button[type="submit"]') as HTMLButtonElement;
      return btn && !btn.disabled;
        });
        
        if (buttonEnabled) {
          console.log(`[Login] Button is enabled`);
          break;
        }
      } catch (error: any) {
        if (!isPageValid(page)) {
          throw new Error('Page closed during button enable check');
        }
        // Continue polling
      }
      
      await page.waitForTimeout(500);
    }
    
    if (!buttonEnabled) {
      console.log(`[Login] Button enable check timeout, proceeding anyway`);
    }
  
  // Listen for NextAuth API call
  let authSucceeded = false;
    let authResponseStatus: number | null = null;
  page.on('response', (response) => {
      if (response.url().includes('/api/auth/callback/credentials')) {
        authResponseStatus = response.status();
        console.log(`[Login] Auth callback response: ${response.status()} ${response.statusText()}`);
        if (response.status() === 200) {
      authSucceeded = true;
          console.log(`[Login] Authentication succeeded`);
        }
    }
  });
  
    // Click submit button - use evaluate to bypass enabled check
    console.log(`[Login] Clicking submit button...`);
    try {
      if (!isPageValid(page)) {
        throw new Error('Page closed before button click');
      }
      
      // Use evaluate to click directly, bypassing Playwright's enabled check
      await page.evaluate(() => {
        const btn = document.querySelector('button[type="submit"]') as HTMLButtonElement;
        if (btn) {
          // Remove disabled attribute and click
          btn.disabled = false;
          btn.click();
        }
      });
      console.log(`[Login] Submit button clicked via evaluate`);
    } catch (error: any) {
      if (!isPageValid(page)) {
        throw new Error('Page closed during button click');
      }
      console.error(`[Login] Error clicking submit: ${error.message}`);
      // Try alternative method
      try {
        await page.click('button[type="submit"]', { force: true, timeout: 5000 });
        console.log(`[Login] Submit button clicked via force click`);
      } catch (fallbackError: any) {
        throw new Error(`Failed to click submit: ${error.message}`);
      }
    }
  
  // Wait for NextAuth API call to complete
    console.log(`[Login] Waiting for auth API call (1500ms)...`);
    try {
      await page.waitForTimeout(1500);
      console.log(`[Login] Auth wait complete. Auth succeeded: ${authSucceeded}, Status: ${authResponseStatus}`);
    } catch (error: any) {
      console.error(`[Login] Error during auth wait: ${error.message}`);
      if (page.isClosed()) {
        throw new Error('Page closed during auth wait');
      }
    }
  
    // Wait for navigation to dashboard (optimized: reduced from 10 to 8 attempts for Staff users)
  console.log(`[Login] Starting navigation wait loop...`);
  let attempts = 0;
  const maxAttempts = 8; // Increased for Staff users who might need more time
  const isStaffUser = email === 'user@smartstore.ai' || expectedRole === 'STAFF';
  
  if (isStaffUser) {
    console.log(`[Login] Detected Staff user - using extended timeout`);
  }
  
  while (attempts < maxAttempts) {
    console.log(`[Login] Navigation attempt ${attempts + 1}/${maxAttempts}`);
    
    // Enhanced page validity check with detailed logging
    try {
      pageValid = await checkPageValidity();
      if (!pageValid) {
        console.error(`[Login] Page invalid at attempt ${attempts + 1}`);
        throw new Error('Page or browser context became invalid during navigation wait');
      }
    } catch (error: any) {
      if (error.message?.includes('closed') || error.message?.includes('invalid')) {
        console.error(`[Login] Page closure/invalidity confirmed: ${error.message}`);
        throw error;
      }
      // If it's a different error, continue trying
      console.log(`[Login] Page check error (non-critical): ${error.message}`);
    }
    
    try {
      // Double-check page validity before getting URL
      pageValid = await checkPageValidity();
      if (!pageValid) {
        console.error(`[Login] Page invalid before URL check at attempt ${attempts + 1}`);
        throw new Error('Page or browser context became invalid during navigation wait');
      }
      
      const currentUrl = await getPageUrl(page);
      console.log(`[Login] Current URL: ${currentUrl}`);
    
    if (currentUrl.includes('/dashboard')) {
        console.log(`[Login] On dashboard, waiting for load...`);
      await page.waitForLoadState('domcontentloaded');
        console.log(`[Login] Dashboard loaded successfully`);
      break;
    }
    
    if (currentUrl.includes('/auth/signin')) {
        console.log(`[Login] Still on signin page, checking for errors...`);
      // Still on signin - check if there's an error message
        try {
      const errorText = await page.locator('text=/invalid|error|failed/i').first().textContent().catch(() => null);
      if (errorText && !errorText.includes('dashboard data')) {
            console.error(`[Login] Error message found: ${errorText}`);
        // Real login error
        throw new Error(`Login failed: ${errorText}`);
          }
          console.log(`[Login] No error message found, continuing wait...`);
        } catch (error: any) {
          if (error.message?.includes('Login failed')) {
            throw error;
          }
          console.log(`[Login] Error check failed (non-critical): ${error.message}`);
      }
      // Otherwise might be a dashboard error redirect, continue waiting
    }
    
      // Wait for navigation or timeout - longer for Staff users
      const waitTimeout = isStaffUser ? 1200 : 800;
      const urlTimeout = isStaffUser ? 3000 : 2000;
      console.log(`[Login] Waiting for navigation or timeout (${waitTimeout}ms)...`);
      try {
        await Promise.race([
          page.waitForURL(/\/dashboard/, { timeout: urlTimeout }).catch(() => null),
          page.waitForTimeout(waitTimeout)
        ]);
      } catch (error: any) {
        console.log(`[Login] Navigation wait error (non-critical): ${error.message}`);
      }
    } catch (error: any) {
      // Enhanced error checking with page validity
      pageValid = await checkPageValidity().catch(() => false);
      if (!pageValid) {
        console.error(`[Login] Page invalid during navigation wait: ${error.message}`);
        throw new Error('Page or browser context became invalid during login: ' + error.message);
      }
      
      // If page closed, throw immediately
      if (error.message?.includes('Target closed') || error.message?.includes('closed') || error.message?.includes('invalid')) {
        console.error(`[Login] Page closed/invalid during navigation wait: ${error.message}`);
        throw new Error('Page was closed or became invalid during login: ' + error.message);
      }
      // For other errors, continue retrying unless it's the last attempt
      if (attempts === maxAttempts - 1) {
        console.error(`[Login] Final attempt failed: ${error.message}`);
        throw error;
      }
      console.log(`[Login] Error on attempt ${attempts + 1}, retrying... (${error.message})`);
    }
    
    attempts++;
    
    // Add small delay between attempts for Staff users
    if (isStaffUser && attempts < maxAttempts) {
      await page.waitForTimeout(300);
    }
  }
  
  // Check final URL with enhanced validation
  console.log(`[Login] Checking final URL...`);
  let finalUrl: string;
  try {
    pageValid = await checkPageValidity();
    if (!pageValid) {
      throw new Error('Page or browser context invalid while checking final URL');
    }
    finalUrl = await getPageUrl(page);
    console.log(`[Login] Final URL: ${finalUrl}`);
  } catch (error: any) {
    console.error(`[Login] Error getting final URL: ${error.message}`);
    pageValid = await checkPageValidity().catch(() => false);
    if (!pageValid) {
      throw new Error('Page or browser context invalid while checking final URL');
    }
    throw error;
  }

  if (!finalUrl.includes('/dashboard')) {
    console.log(`[Login] Not on dashboard, verifying session and navigating manually...`);
    // If not on dashboard, try navigating manually after verifying session
    try {
    const sessionResponse = await page.request.get('/api/auth/session');
    const session = await sessionResponse.json();
      console.log(`[Login] Session check response: ${JSON.stringify(session)}`);
    
    if (session?.user && session.user.email === email) {
        console.log(`[Login] Session valid, navigating to dashboard...`);
      // Session is valid, navigate manually
      await page.goto('/dashboard');
      await page.waitForLoadState('domcontentloaded');
        console.log(`[Login] Manual navigation to dashboard complete`);
    } else {
        console.error(`[Login] Session invalid. Expected ${email}, got ${session?.user?.email || 'no user'}`);
      throw new Error(`Login failed - not on dashboard. URL: ${finalUrl}, Session: ${JSON.stringify(session)}`);
      }
    } catch (error: any) {
      console.error(`[Login] Error during manual navigation: ${error.message}`);
      throw error;
    }
  }
  
  // Wait for session to be set - more retries for Staff users
  console.log(`[Login] Verifying session...`);
  let session: any = null;
  const sessionRetries = isStaffUser ? 5 : 3;
  for (let i = 0; i < sessionRetries; i++) {
    console.log(`[Login] Session verification attempt ${i + 1}/${sessionRetries}`);
    
    pageValid = await checkPageValidity();
    if (!pageValid) {
      throw new Error('Page or browser context invalid during session verification');
    }
    
    try {
      const sessionWaitTimeout = isStaffUser ? 1000 : 800;
      await page.waitForTimeout(sessionWaitTimeout);
    
    const sessionResponse = await page.request.get('/api/auth/session');
      console.log(`[Login] Session response status: ${sessionResponse.status()}`);
      
    if (sessionResponse.status() === 200) {
      session = await sessionResponse.json();
        console.log(`[Login] Session data: ${JSON.stringify(session)}`);
      if (session?.user && session.user.email === email) {
          console.log(`[Login] Session verified successfully`);
        break;
        } else {
          console.log(`[Login] Session email mismatch. Expected: ${email}, Got: ${session?.user?.email || 'none'}`);
        }
      } else {
        console.log(`[Login] Session response not OK: ${sessionResponse.status()}`);
      }
    } catch (error: any) {
      console.error(`[Login] Session check error on attempt ${i + 1}: ${error.message}`);
      // Check if page is still valid
      pageValid = await checkPageValidity().catch(() => false);
      if (!pageValid) {
        console.error(`[Login] Page became invalid during session check`);
        throw new Error('Page or browser context became invalid during session verification');
      }
      // If session check fails, continue to next attempt
      if (i === sessionRetries - 1) {
        console.error(`[Login] Final session check failed`);
        throw error; // Only throw on last attempt
      }
    }
  }
  
  // Verify session
  if (!session?.user || session.user.email !== email) {
    console.error(`[Login] Session verification failed. Getting debug session...`);
    // Get session one more time for debugging
    try {
    const sessionResponse = await page.request.get('/api/auth/session');
    const debugSession = await sessionResponse.json();
      console.error(`[Login] Debug session: ${JSON.stringify(debugSession)}`);
    throw new Error(`Session verification failed. Expected ${email}, got ${debugSession?.user?.email || 'no user'}. Session: ${JSON.stringify(debugSession)}`);
    } catch (error: any) {
      console.error(`[Login] Error getting debug session: ${error.message}`);
      throw error;
    }
  }
  
  if (expectedRole && session.user.role !== expectedRole) {
    console.error(`[Login] Role verification failed. Expected: ${expectedRole}, Got: ${session.user.role}`);
    throw new Error(`Role verification failed. Expected ${expectedRole}, got ${session.user.role}`);
}
  
  console.log(`[Login] Login successful for ${email} (role: ${session.user.role})`);
  } catch (error: any) {
    console.error(`[Login] Fatal error during login process: ${error.message}`);
    const pageValid = await checkPageValidity().catch(() => false);
    if (!pageValid) {
      console.error(`[Login] Page became invalid - cannot recover`);
      throw new Error('Page or browser context became invalid: ' + error.message);
    }
    throw error;
  }
}

// loginAsUser is now a parameterized function above

export async function logout(page: Page) {
  await page.click('button:has-text("Sign out")');
  await page.waitForURL('/auth/signin', { timeout: 5000 });
}

