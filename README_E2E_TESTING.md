# E2E Testing with Playwright

This project uses Playwright for end-to-end browser testing of all API routes.

## Setup

1. Install dependencies (already done):
   ```bash
   npm install
   ```

2. Install Playwright browsers (already done):
   ```bash
   npx playwright install chromium
   ```

## Running Tests

### Run all E2E tests
```bash
npm run test:e2e
```

### Run tests with UI (interactive mode)
```bash
npm run test:e2e:ui
```

### Run tests in headed mode (see browser)
```bash
npm run test:e2e:headed
```

### Run tests in debug mode
```bash
npm run test:e2e:debug
```

## Test Structure

### 1. Test Harness Page (`/test-harness`)
- Accessible at `http://localhost:3000/test-harness` when logged in
- Provides UI to test all API routes individually or in bulk
- Shows test results, status codes, and response data
- Filter routes by category

### 2. Test Files

#### `e2e/api-routes.spec.ts`
Tests the test harness page functionality:
- Route filtering by category
- Individual route testing
- Bulk route testing
- Test result display

#### `e2e/user-flows.spec.ts`
Tests API routes through actual user flows:
- Dashboard page → tests analytics, orders, chat APIs
- Products page → tests products API
- Orders page → tests orders API
- And more...

#### `e2e/api-direct.spec.ts`
Direct API endpoint testing:
- Tests all routes without UI
- Verifies authentication requirements
- Fastest test execution

## Test Data

Test users are defined in `e2e/fixtures/test-data.ts`:
- Admin: `admin@smartstore.ai` / `admin123`
- User: `user@smartstore.ai` / `user123`

## Configuration

Playwright configuration is in `playwright.config.ts`:
- Base URL: `http://localhost:3000`
- Automatically starts dev server before tests
- Runs tests in parallel
- Generates HTML reports

## How It Works

1. **Test Harness Approach**: 
   - Navigate to `/test-harness` page
   - Click "Test" buttons to test individual routes
   - Click "Test All" to test all routes in a category
   - View results, status codes, and response data

2. **User Flow Approach**:
   - Navigate to actual app pages
   - Monitor API calls made by the page
   - Verify correct APIs are called

3. **Direct API Approach**:
   - Use Playwright's request API
   - Test endpoints directly without browser
   - Fastest execution

## Testing All Routes

The test harness page includes all 83 API routes organized by category:
- Analytics
- Products
- Orders
- Payments
- Customers
- Warehouses
- Categories
- Couriers
- Campaigns
- Reports
- Expenses
- Bulk Operations
- Chat
- Security
- Theme
- Region
- Sync
- Currency
- Voice
- IoT
- Blockchain
- PWA
- Gamification
- Health

## Notes

- Tests require the app to be running (`npm run dev`)
- Playwright automatically starts the dev server if not running
- Tests use real authentication (login as admin/user)
- All tests verify authentication requirements
- Test results are saved in `test-results/` directory
- HTML reports are generated in `playwright-report/` directory

## Troubleshooting

If tests fail:
1. Ensure the app is running on `http://localhost:3000`
2. Check that test users exist in the database
3. Verify authentication is working
4. Check browser console for errors
5. Run tests in headed mode to see what's happening

