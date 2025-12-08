# RBAC Testing Guide - SmartStoreSaaS

**Date**: December 26, 2024  
**Purpose**: Guide for testing Role-Based Access Control (RBAC) with authenticated users

---

## Test Users Available

### Mock Users (from `src/lib/auth.ts`)

1. **Admin User**
   - Email: `admin@smartstore.ai`
   - Password: `admin123`
   - Role: `ADMIN`
   - Organization: `org-1`

2. **Regular User**
   - Email: `user@smartstore.ai`
   - Password: `user123`
   - Role: `USER` (Note: Should be one of ADMIN, MANAGER, STAFF, PACKING)
   - Organization: `org-1`

### Database Users (if configured)

To check database users, run:
```bash
node scripts/check-users.js
```

---

## User Roles in System

From Prisma schema (`UserRole` enum):
- **ADMIN** - Full access, can manage everything
- **MANAGER** - Management access, can manage users and view analytics
- **STAFF** - Standard staff access, read and write permissions
- **PACKING** - Limited access, read-only permissions

---

## RBAC Testing Checklist

### 1. Authentication Testing

#### Test Admin Sign In
- [ ] Navigate to `/auth/signin`
- [ ] Enter `admin@smartstore.ai` / `admin123`
- [ ] Verify redirect to `/dashboard`
- [ ] Verify session is created
- [ ] Check browser console for errors

#### Test User Sign In  
- [ ] Navigate to `/auth/signin`
- [ ] Enter `user@smartstore.ai` / `user123`
- [ ] Verify redirect to `/dashboard`
- [ ] Verify session is created
- [ ] Check browser console for errors

#### Test Invalid Credentials
- [ ] Try signing in with wrong password
- [ ] Verify error message appears
- [ ] Verify no redirect occurs

---

### 2. Dashboard Access Testing (Admin User)

Test accessing all dashboard pages as **ADMIN** user:

#### Main Dashboard
- [ ] `/dashboard` - Should load successfully
- [ ] Check console errors
- [ ] Check network requests (404s)
- [ ] Verify page content displays

#### Products
- [ ] `/products` - Should load successfully
- [ ] `/products/new` - Should load successfully
- [ ] Check console errors
- [ ] Check API calls to `/api/products`

#### Orders
- [ ] `/orders` - Should load successfully
- [ ] Check console errors
- [ ] Check API calls to `/api/orders`

#### Customers
- [ ] `/customers` - Should load successfully
- [ ] Check console errors
- [ ] Check API calls

#### Analytics
- [ ] `/analytics` - Should load successfully
- [ ] `/analytics/bi` - Should load successfully
- [ ] `/analytics/enhanced` - Should load successfully
- [ ] Check API calls to:
  - `/api/analytics`
  - `/api/analytics/dashboard-stats`
  - `/api/analytics/ai-insights`
  - `/api/analytics/predictive`
  - `/api/analytics/customer-segments`
  - `/api/analytics/business-insights`

#### Other Pages
- [ ] `/integrations` - Should load successfully
- [ ] `/payments` - Should load successfully
- [ ] `/campaigns` - Should load successfully
- [ ] `/reports` - Should load successfully
- [ ] `/chat` - Should load successfully
- [ ] `/warehouse` - Should load successfully
- [ ] `/couriers` - Should load successfully
- [ ] `/expenses` - Should load successfully
- [ ] `/sync` - Should load successfully
- [ ] `/bulk-operations` - Should load successfully
- [ ] `/test-harness` - Should load successfully

---

### 3. Role-Based Permission Testing

#### ADMIN Role Permissions
According to `src/app/api/security/route.ts`, ADMIN should have:
- ✅ Read
- ✅ Write
- ✅ Delete
- ✅ Manage Users
- ✅ Manage Settings
- ✅ View Analytics

**Test:**
- [ ] Can access all dashboard pages
- [ ] Can create/edit/delete products
- [ ] Can create/edit/delete orders
- [ ] Can view analytics
- [ ] Can access settings (if exists)

#### MANAGER Role Permissions
According to `src/app/api/security/route.ts`, MANAGER should have:
- ✅ Read
- ✅ Write
- ✅ Delete
- ✅ Manage Users
- ✅ View Analytics

**Test (requires MANAGER user):**
- [ ] Can access dashboard pages
- [ ] Can create/edit/delete products
- [ ] Can create/edit/delete orders
- [ ] Can view analytics
- [ ] Cannot access settings (if restricted)

#### STAFF Role Permissions
According to `src/app/api/security/route.ts`, STAFF should have:
- ✅ Read
- ✅ Write

**Test (requires STAFF user):**
- [ ] Can access dashboard pages
- [ ] Can create/edit products (write)
- [ ] Cannot delete products (no delete permission)
- [ ] Cannot view analytics (no analytics permission)

#### PACKING Role Permissions
According to `src/app/api/security/route.ts`, PACKING should have:
- ✅ Read

**Test (requires PACKING user):**
- [ ] Can view dashboard pages (read-only)
- [ ] Cannot create/edit products (no write permission)
- [ ] Cannot delete products (no delete permission)
- [ ] Cannot view analytics (no analytics permission)

---

### 4. API Endpoint Access Testing

Test API endpoints with different roles:

#### As ADMIN
- [ ] `/api/analytics/dashboard-stats` - Returns 200 with data
- [ ] `/api/products` - Returns 200 with data
- [ ] `/api/orders` - Returns 200 with data
- [ ] `/api/customers` - Returns 200 with data

#### As STAFF
- [ ] `/api/products` - Returns 200 (read/write allowed)
- [ ] `/api/analytics` - Should return 403 (no analytics permission?)

#### As PACKING
- [ ] `/api/products` - Returns 200 (read allowed)
- [ ] POST `/api/products` - Should return 403 (no write permission?)

---

### 5. Console Errors Documentation

For each page accessed, document:
- [ ] Console warnings (React DevTools, data-cursor-ref)
- [ ] Console errors
- [ ] JavaScript errors
- [ ] React errors
- [ ] Network errors

---

### 6. Network Requests Documentation

For each page accessed, document:
- [ ] Successful API calls (200 status)
- [ ] Failed API calls (404, 401, 403)
- [ ] Request/response times
- [ ] Missing endpoints

---

## Testing Procedure

### Step 1: Set Up Test Environment

1. Ensure dev server is running:
   ```bash
   npm run dev
   ```

2. Open browser at `http://localhost:3000`

3. Open browser DevTools (F12) to monitor:
   - Console (for errors)
   - Network tab (for API calls)

### Step 2: Test Admin User

1. Navigate to `/auth/signin`
2. Sign in with `admin@smartstore.ai` / `admin123`
3. Access each dashboard page listed above
4. Document console errors for each page
5. Document network requests (404s, etc.)
6. Document any permission issues

### Step 3: Test Other Roles

1. Create test users with different roles (MANAGER, STAFF, PACKING) or use existing ones
2. Sign in with each role
3. Test accessing dashboard pages
4. Verify permissions match expected role capabilities
5. Document any permission violations

### Step 4: Document Results

Update `RBAC_TESTING_REPORT.md` with:
- Access results per role
- Console errors per page
- Network errors per page
- Permission test results
- Any issues found

---

## Expected Results

### Console Errors (All Pages)
- ⚠️ React DevTools suggestion (harmless)
- ⚠️ data-cursor-ref attribute warning (browser tool artifact)

### API Endpoints
All authenticated requests should return:
- ✅ 200 - Success
- ✅ 401 - Unauthorized (if not signed in)
- ❌ 403 - Forbidden (if role doesn't have permission)
- ❌ 404 - Not Found (if endpoint doesn't exist)

---

## Known Issues to Check

1. **Mock User Role Mismatch**
   - `user@smartstore.ai` has role `USER` but enum only has ADMIN, MANAGER, STAFF, PACKING
   - May need to update mock user role to STAFF

2. **Role-Based Permission Checks**
   - Current dashboard layout only checks for authentication, not specific roles
   - Need to verify role checks are implemented in API routes

3. **Missing Database Users**
   - Auth uses mock users, not database users
   - To use database users, update `src/lib/auth.ts` to query Prisma

---

## Quick Test Commands

### Check if users exist in database:
```bash
node scripts/check-users.js
```

### Test authentication endpoint:
```bash
curl -X POST http://localhost:3000/api/test-auth \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@smartstore.ai","password":"admin123"}'
```

### Check session after sign in:
```bash
curl http://localhost:3000/api/auth/session
```

---

## Notes

- Mock users are hardcoded in `src/lib/auth.ts`
- To test with database users, update auth to query Prisma
- Role-based permissions are defined in `src/app/api/security/route.ts`
- Dashboard layout only checks authentication, not roles

---

**Status**: Ready for manual testing  
**Next Steps**: Follow testing procedure above and document results in `RBAC_TESTING_REPORT.md`

