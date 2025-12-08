# Playwright RBAC Testing Guide

## Status

✅ **Playwright + Chromium Setup Complete**
- Playwright is installed and configured
- Test infrastructure is ready
- Chromium browser can be controlled programmatically

⚠️ **Authentication Flow Needs Manual Verification**
- Automated login via form submission is being refined
- Test helper functions are created but need debugging

## Quick Start

### 1. Start Dev Server

```bash
npm run dev
```

The server should be running on `http://localhost:3000`

### 2. Run RBAC Tests

```bash
# Run complete RBAC test suite
npm run test:e2e e2e/rbac-dashboard-complete.spec.ts

# Run with UI mode (see browser)
npm run test:e2e:ui e2e/rbac-dashboard-complete.spec.ts

# Run in headed mode (see browser)
npm run test:e2e:headed e2e/rbac-dashboard-complete.spec.ts
```

### 3. Test Credentials

**Admin User:**
- Email: `admin@smartstore.ai`
- Password: `admin123`
- Role: `ADMIN`

**Staff User:**
- Email: `user@smartstore.ai`
- Password: `user123`
- Role: `STAFF`

## Test Coverage

The test suite (`e2e/rbac-dashboard-complete.spec.ts`) tests:

1. **Admin Access** - All 19 dashboard pages
2. **Staff Access** - All dashboard pages
3. **Unauthenticated Access** - Redirect to sign-in

### Dashboard Pages Tested

- `/dashboard`
- `/products`
- `/products/new`
- `/orders`
- `/customers`
- `/analytics`
- `/analytics/bi`
- `/analytics/enhanced`
- `/integrations`
- `/payments`
- `/campaigns`
- `/reports`
- `/chat`
- `/warehouse`
- `/couriers`
- `/expenses`
- `/sync`
- `/bulk-operations`
- `/test-harness`

## Error Collection

The test automatically collects:
- ✅ **Console Errors** - JavaScript console errors
- ✅ **404 Errors** - Network requests returning 404
- ✅ **Page Errors** - Unhandled exceptions
- ✅ **HTTP Status Codes** - Response status for each page

## Current Issues

### Login Automation

The automated login is having issues with NextAuth's client-side navigation. Options:

1. **Use Existing Login Helper** - Other test files (`e2e/user-flows.spec.ts`) have working login helpers
2. **Manual Testing** - Sign in manually in headed mode, then run tests
3. **Session Storage** - Save session cookies after manual login

### Fixing Login Helper

The login helper needs to handle:
- Form validation (wait for button to enable)
- NextAuth client-side sign-in API call
- Client-side navigation to `/dashboard`
- Session cookie persistence

## Alternative: Manual Browser Testing

Since automated login has issues, you can:

1. **Open Browser in Headed Mode:**
   ```bash
   npm run test:e2e:headed e2e/rbac-dashboard-complete.spec.ts
   ```

2. **Manually Sign In** when the browser opens

3. **Tests Will Continue** after authentication

## Files Created

- `e2e/rbac-dashboard-complete.spec.ts` - Complete RBAC test suite
- `e2e/rbac-dashboard.spec.ts` - Original RBAC test (alternative)
- `e2e/helpers/auth.ts` - Login helper functions

## Next Steps

1. ✅ Verify dev server is running
2. ✅ Test manual login with credentials
3. 🔧 Fix login helper to handle NextAuth properly
4. ✅ Run complete test suite
5. 📊 Generate error report

## Debugging

### View Test Screenshots

Failed tests create screenshots in:
```
test-results/rbac-dashboard-complete-*/test-failed-1.png
```

### Check Test Reports

HTML reports are generated:
```bash
npx playwright show-report
```

### Run Single Test

```bash
npm run test:e2e e2e/rbac-dashboard-complete.spec.ts -g "Admin User"
```

## Success Criteria

✅ All dashboard pages return HTTP 200
✅ Console errors documented per page
✅ 404 errors documented per page
✅ Session verification working
✅ RBAC redirects working

