# Browser Testing Guide - SmartStoreSaaS

**Status**: 🟢 READY TO TEST  
**Server**: http://localhost:3000  
**Date**: $(date)

---

## 🚀 Quick Start

### 1. Verify Server is Running
```bash
# Check if server is running on port 3000
curl http://localhost:3000/api/health || echo "Server not ready yet"
```

### 2. Open Browser
- **Primary**: Chrome (recommended)
- **DevTools**: Press `F12` or `Cmd+Option+I`
- **Tabs to Open**:
  - **Console** - Check for JavaScript errors
  - **Network** - Monitor API calls and 404s
  - **Application** - Check cookies/session

### 3. Test Credentials
- **Admin**: `admin@smartstore.ai` / `admin123`
- **Staff**: `user@smartstore.ai` / `user123`

---

## 📋 Systematic Test Plan

### Phase 1: Authentication (5 min)

#### Test 1.1: Login as Admin
1. Navigate to: `http://localhost:3000/auth/signin`
2. Enter: `admin@smartstore.ai` / `admin123`
3. Click "Sign In"
4. **Expected**: Redirect to `/dashboard`
5. **Check Console**: Should be no errors (only harmless warnings)
6. **Check Network**: `/api/auth/session` should return 200

#### Test 1.2: Protected Route (Unauthenticated)
1. Open **Incognito** window
2. Navigate to: `http://localhost:3000/dashboard`
3. **Expected**: Redirect to `/auth/signin`
4. **Check Console**: No errors

#### Test 1.3: Logout
1. While logged in, click "Logout" or "Sign Out"
2. **Expected**: Redirect to `/auth/signin`
3. **Check Application Tab**: Cookies should be cleared
4. Try to access `/dashboard` again → Should redirect

---

### Phase 2: Dashboard Pages (30 min)

Test **ALL** pages below. For each page:
- ✅ Navigate to the URL
- ✅ Check Console tab (should be clean, no red errors)
- ✅ Check Network tab (look for 404s or 500 errors)
- ✅ Verify page content loads
- ✅ Document any issues

#### Dashboard Pages List

| # | Page | URL | Status | Console Errors | 404 Errors | Notes |
|---|------|-----|--------|----------------|------------|-------|
| 1 | Dashboard | `/dashboard` | ⬜ | ⬜ | ⬜ | |
| 2 | Products | `/products` | ⬜ | ⬜ | ⬜ | |
| 3 | New Product | `/products/new` | ⬜ | ⬜ | ⬜ | |
| 4 | Orders | `/orders` | ⬜ | ⬜ | ⬜ | |
| 5 | Customers | `/customers` | ⬜ | ⬜ | ⬜ | |
| 6 | Analytics | `/analytics` | ⬜ | ⬜ | ⬜ | |
| 7 | BI Analytics | `/analytics/bi` | ⬜ | ⬜ | ⬜ | |
| 8 | Enhanced Analytics | `/analytics/enhanced` | ⬜ | ⬜ | ⬜ | |
| 9 | Integrations | `/integrations` | ⬜ | ⬜ | ⬜ | |
| 10 | Payments | `/payments` | ⬜ | ⬜ | ⬜ | |
| 11 | Campaigns | `/campaigns` | ⬜ | ⬜ | ⬜ | |
| 12 | Reports | `/reports` | ⬜ | ⬜ | ⬜ | |
| 13 | Chat | `/chat` | ⬜ | ⬜ | ⬜ | |
| 14 | Warehouse | `/warehouse` | ⬜ | ⬜ | ⬜ | |
| 15 | Couriers | `/couriers` | ⬜ | ⬜ | ⬜ | |
| 16 | Expenses | `/expenses` | ⬜ | ⬜ | ⬜ | |
| 17 | Sync | `/sync` | ⬜ | ⬜ | ⬜ | |
| 18 | Bulk Operations | `/bulk-operations` | ⬜ | ⬜ | ⬜ | |
| 19 | Settings | `/settings` | ⬜ | ⬜ | ⬜ | |

---

### Phase 3: API Endpoints (15 min)

While on each page, check the **Network tab** for API calls:

#### Critical API Endpoints to Verify

| Endpoint | Page | Expected Status | Actual Status | Notes |
|----------|------|-----------------|---------------|-------|
| `/api/auth/session` | All pages | 200 | ⬜ | |
| `/api/products` | Products | 200 | ⬜ | |
| `/api/orders` | Orders | 200 | ⬜ | |
| `/api/customers` | Customers | 200 | ⬜ | |
| `/api/analytics/dashboard-stats` | Dashboard | 200 | ⬜ | |
| `/api/analytics` | Analytics | 200 | ⬜ | |
| `/api/payments` | Payments | 200 | ⬜ | |
| `/api/campaigns` | Campaigns | 200 | ⬜ | |

**Look for**:
- ❌ **404 errors** - API route doesn't exist
- ❌ **500 errors** - Server error (check server logs)
- ❌ **401/403 errors** - Authentication/Authorization issue

---

### Phase 4: Core Functionality (45 min)

#### Products Management

1. **Create Product**
   - Navigate to `/products/new`
   - Fill in: Name, Price, SKU, Description
   - Click "Save" or "Create"
   - **Expected**: Product appears in `/products` list
   - **Check**: No console errors, API call succeeds

2. **Edit Product**
   - Click on a product from the list
   - Change the name
   - Save
   - **Expected**: Changes persist

3. **Delete Product**
   - Click delete on a product
   - Confirm deletion
   - **Expected**: Product removed from list

4. **Search/Filter**
   - Try searching for a product name
   - Try filtering by category
   - **Expected**: Results update correctly

#### Orders Management

1. **Create Order**
   - Navigate to `/orders/new` (or click "New Order")
   - Select a customer
   - Add products
   - Submit
   - **Expected**: Order created with status DRAFT

2. **Update Order Status**
   - Change status: DRAFT → PENDING → CONFIRMED → SHIPPED
   - **Expected**: Status updates correctly

3. **Add Payment**
   - Add payment to an order
   - **Expected**: Payment status updates

#### Customers Management

1. **Create Customer**
   - Navigate to `/customers/new`
   - Fill in: Name, Email, Phone
   - Submit
   - **Expected**: Customer created

2. **View Customer Orders**
   - Click on a customer
   - View their order history
   - **Expected**: Orders display correctly

---

### Phase 5: Error Handling (10 min)

1. **Invalid URL**
   - Navigate to `/products/invalid-id-12345`
   - **Expected**: 404 page or "Not Found" message

2. **Network Error**
   - Open DevTools → Network tab
   - Set to "Offline"
   - Try to create a product
   - **Expected**: Error message (not white screen)

3. **Invalid Form Data**
   - Try to submit empty form
   - **Expected**: Validation errors shown

---

## 🐛 Common Issues to Look For

### Console Errors
- ❌ JavaScript errors (red text)
- ❌ React errors
- ❌ Network errors (not 404s, but actual failures)

### Network Tab
- ❌ 500 errors (server crashes)
- ❌ 401 errors (auth issues)
- ❌ 403 errors (permission issues)
- ⚠️ 404 errors (missing routes - document these)

### UI Issues
- ❌ White screens
- ❌ Infinite loading spinners
- ❌ Broken layouts
- ❌ Missing data (shows "undefined" or "null")

---

## 📝 Quick Test Checklist

Use this while testing:

```
[ ] Server running (http://localhost:3000)
[ ] Logged in as admin@smartstore.ai
[ ] DevTools Console tab open
[ ] DevTools Network tab open
[ ] All 19 dashboard pages tested
[ ] No critical console errors found
[ ] API endpoints returning 200 (or documented 404s)
[ ] Core functionality tested (Create/Read/Update/Delete)
[ ] Error handling verified
```

---

## 🎯 Success Criteria

### ✅ Test Passes If:
- All pages load (200 status)
- No JavaScript console errors (only harmless warnings)
- API endpoints work (200 status, not 404/500)
- Core CRUD operations work
- Error handling shows user-friendly messages

### ❌ Document If:
- Page shows white screen
- Console shows red errors
- API returns 500 error
- Feature doesn't work as expected
- UI is broken/unusable

---

## 📊 Test Results Log

Create a test results file and document:

```markdown
## Test Results - [Date]

### Summary
- Total Pages Tested: __/19
- Pages Passing: __/19
- Critical Issues Found: __
- Minor Issues Found: __

### Critical Issues
1. [Issue description] - [Page/Feature] - [Severity]

### Minor Issues
1. [Issue description] - [Page/Feature] - [Severity]

### Notes
[Any additional observations]
```

---

## 🚨 If You Find Issues

1. **Document Immediately**:
   - Take screenshot
   - Copy console error
   - Note the exact steps to reproduce

2. **Check Server Logs**:
   ```bash
   # Look at terminal where npm run dev is running
   # Check for stack traces or errors
   ```

3. **Check Network Request**:
   - Right-click failed request in Network tab
   - Copy as cURL
   - Check response body for error details

---

## ✅ Ready to Start?

1. ✅ Dev server running? (`npm run dev`)
2. ✅ Browser open with DevTools?
3. ✅ Logged in? (`admin@smartstore.ai` / `admin123`)

**Start with Phase 1: Authentication, then proceed through all phases!**

Good luck! 🎉

