# E2E Browser Testing Guide

## Overview

The E2E browser tests verify that all dashboard pages are accessible and working correctly for both Admin and Staff users. The tests check for:
- Page load status (200)
- Console errors
- 404 errors
- **500 errors** (API route issues - newly added)
- Page errors

## Running E2E Tests

### Prerequisites

1. **Start the Development Server**:
   ```bash
   npm run dev
   ```
   The server must be running on `http://localhost:3000` for tests to work.

2. **In another terminal, run the tests**:
   ```bash
   npm run test:e2e
   ```

### Test Commands

- `npm run test:e2e` - Run all E2E tests
- `npm run test:e2e:ui` - Run with Playwright UI
- `npm run test:e2e:headed` - Run in headed mode (see browser)
- `npm run test:e2e:debug` - Run in debug mode

### Running Specific Test File

```bash
npm run test:e2e e2e/rbac-dashboard-complete.spec.ts
```

## What the Tests Check

### Admin User Test
- Tests all 19 dashboard pages
- Verifies pages load successfully
- Collects and reports errors:
  - Console errors (JavaScript errors)
  - 404 errors (missing resources)
  - **500 errors (API route failures)**
  - Page errors

### Staff User Test
- Same as Admin test but with Staff credentials
- Verifies Staff users can access pages
- Checks role-based access

### Unauthenticated Access Test
- Verifies redirect to sign-in page

## Enhanced Error Detection

The tests now track:
- ✅ **404 Errors**: Missing files/resources
- ✅ **500 Errors**: API route failures (newly added)
- ✅ **Console Errors**: JavaScript runtime errors
- ✅ **Page Errors**: Page-level exceptions

## Test Output

The tests provide detailed output:
- Status for each page (✅ or ❌)
- Error counts by type
- Summary of all errors found
- Failed pages list

## Troubleshooting

### Connection Refused Error
**Error**: `ERR_CONNECTION_REFUSED at http://localhost:3000`

**Solution**: Start the dev server first:
```bash
npm run dev
```

### Staff Login Failing
The login helper has been enhanced with:
- Better error handling
- Retry logic
- Extended timeouts for Staff users
- Page validity checks

If Staff login still fails, check:
- Server logs for authentication errors
- Session configuration
- Role-based access settings

### Page Load Timeouts
- Tests have extended timeouts (10 minutes)
- Pages wait for `domcontentloaded` state
- Additional wait time for API calls

## Recent Improvements

1. **Enhanced Error Tracking**: Added 500 error detection for API route issues
2. **Better Login Handling**: Improved Staff login with retry logic
3. **Detailed Reporting**: Better error summaries and categorization
4. **Recovery Logic**: Tests continue even if individual pages fail

## Dashboard Pages Tested

The following pages are tested:
1. `/dashboard` - Main Dashboard
2. `/products` - Products Management
3. `/products/new` - New Product
4. `/orders` - Orders Management
5. `/customers` - Customers Management
6. `/analytics` - Analytics
7. `/analytics/bi` - Business Intelligence
8. `/analytics/enhanced` - Enhanced Analytics
9. `/integrations` - Integrations
10. `/payments` - Payments
11. `/campaigns` - Campaigns
12. `/reports` - Reports
13. `/chat` - Chat
14. `/warehouse` - Warehouse
15. `/couriers` - Couriers
16. `/expenses` - Expenses
17. `/sync` - Sync
18. `/bulk-operations` - Bulk Operations
19. `/test-harness` - Test Harness

## Expected Results

After fixing API route 500 errors, you should see:
- ✅ All pages return 200 status
- ✅ 0 or minimal 500 errors (API routes fixed)
- ✅ Console errors reduced
- ✅ No page errors

## Next Steps

1. Run `npm run dev` in one terminal
2. Run `npm run test:e2e e2e/rbac-dashboard-complete.spec.ts` in another
3. Review the test output and fix any remaining 500 errors
4. Check console errors and address JavaScript issues
5. Verify Staff login works correctly

