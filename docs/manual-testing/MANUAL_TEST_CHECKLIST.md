# SmartStoreSaaS - Manual Test Checklist

**Version**: 1.0  
**Date**: _______________  
**Tester**: _______________  
**Environment**: Local Development (http://localhost:3000)

---

## Pre-Test Setup

- [ ] Development server running (`npm run dev`)
- [ ] Browser: Chrome (DevTools open)
- [ ] Browser: Firefox (for cross-browser)
- [ ] Incognito/Private mode enabled
- [ ] Test accounts created:
  - [ ] ADMIN: admin@smartstore.ai / admin123
  - [ ] STAFF: user@smartstore.ai / user123
  - [ ] Additional test users if needed

---

## LAYER 1: Authentication & Access

### Test Cases

| # | Test Action | Expected Result | ✅ Pass | ❌ Fail | Notes |
|---|------------|-----------------|---------|---------|-------|
| 1.1 | Valid Login | Redirect to dashboard, session created | ⬜ | ⬜ | |
| 1.2 | Invalid Password | Error message, no redirect | ⬜ | ⬜ | |
| 1.3 | Session Persistence | Still logged in after refresh | ⬜ | ⬜ | |
| 1.4 | Protected Route (Logged Out) | Redirect to signin | ⬜ | ⬜ | |
| 1.5 | Logout | Session destroyed, cookies cleared | ⬜ | ⬜ | |
| 1.6 | MFA Login (if enabled) | MFA prompt → correct code → success | ⬜ | ⬜ | |

**Issues Found**:  
_____________________________________________________  
_____________________________________________________

---

## LAYER 2: Multi-Tenant Isolation (CRITICAL)

### Test Cases

| # | Test Action | Expected Result | ✅ Pass | ❌ Fail | Notes |
|---|------------|-----------------|---------|---------|-------|
| 2.1 | Org A Data Separation | Org B cannot see Org A data | ⬜ | ⬜ | |
| 2.2 | Direct URL Access | 404/redirect for cross-org access | ⬜ | ⬜ | |
| 2.3 | API Data Leakage | No Org A data in Org B API responses | ⬜ | ⬜ | |
| 2.4 | Cross-Org API Test | fetch('/api/products') returns only org data | ⬜ | ⬜ | |

**Issues Found**:  
_____________________________________________________  
_____________________________________________________

---

## LAYER 3: Core Business Flows

### 3.1 Product Management

| # | Test Action | ✅ Pass | ❌ Fail | Notes |
|---|------------|---------|---------|-------|
| 3.1.1 | Navigate to `/products` | ⬜ | ⬜ | |
| 3.1.2 | Click "New Product" | ⬜ | ⬜ | |
| 3.1.3 | Fill required fields | ⬜ | ⬜ | |
| 3.1.4 | Submit missing required field | ⬜ | ⬜ | |
| 3.1.5 | Submit valid product | ⬜ | ⬜ | |
| 3.1.6 | Edit product | ⬜ | ⬜ | |
| 3.1.7 | Update product name | ⬜ | ⬜ | |
| 3.1.8 | Add product variant | ⬜ | ⬜ | |
| 3.1.9 | Upload product image | ⬜ | ⬜ | |
| 3.1.10 | Set stock to 0 | ⬜ | ⬜ | |
| 3.1.11 | Low stock alert | ⬜ | ⬜ | |
| 3.1.12 | Search product | ⬜ | ⬜ | |
| 3.1.13 | Filter by category | ⬜ | ⬜ | |
| 3.1.14 | Delete product | ⬜ | ⬜ | |
| 3.1.15 | Duplicate SKU error | ⬜ | ⬜ | |
| 3.1.16 | Data persists after refresh | ⬜ | ⬜ | |
| 3.1.17 | Bulk import CSV | ⬜ | ⬜ | |

**Issues Found**:  
_____________________________________________________  
_____________________________________________________

### 3.2 Order Management

| # | Test Action | ✅ Pass | ❌ Fail | Notes |
|---|------------|---------|---------|-------|
| 3.2.1 | Navigate to `/orders` | ⬜ | ⬜ | |
| 3.2.2 | Click "New Order" | ⬜ | ⬜ | |
| 3.2.3 | Select customer | ⬜ | ⬜ | |
| 3.2.4 | Add product to order | ⬜ | ⬜ | |
| 3.2.5 | Change quantity | ⬜ | ⬜ | |
| 3.2.6 | Submit order | ⬜ | ⬜ | |
| 3.2.7 | View order details | ⬜ | ⬜ | |
| 3.2.8 | Status: DRAFT → PENDING | ⬜ | ⬜ | |
| 3.2.9 | Status: PENDING → CONFIRMED | ⬜ | ⬜ | |
| 3.2.10 | Add payment | ⬜ | ⬜ | |
| 3.2.11 | Add tracking number | ⬜ | ⬜ | |
| 3.2.12 | Status: CONFIRMED → SHIPPED | ⬜ | ⬜ | |
| 3.2.13 | Status: SHIPPED → DELIVERED | ⬜ | ⬜ | |
| 3.2.14 | Cancel order | ⬜ | ⬜ | |
| 3.2.15 | Process refund | ⬜ | ⬜ | |
| 3.2.16 | Invalid status transition | ⬜ | ⬜ | |
| 3.2.17 | Insufficient stock error | ⬜ | ⬜ | |

**Issues Found**:  
_____________________________________________________  
_____________________________________________________

### 3.3 Customer Management

| # | Test Action | ✅ Pass | ❌ Fail | Notes |
|---|------------|---------|---------|-------|
| 3.3.1 | Navigate to `/customers` | ⬜ | ⬜ | |
| 3.3.2 | Click "New Customer" | ⬜ | ⬜ | |
| 3.3.3 | Fill required fields | ⬜ | ⬜ | |
| 3.3.4 | Submit valid customer | ⬜ | ⬜ | |
| 3.3.5 | Duplicate email error | ⬜ | ⬜ | |
| 3.3.6 | Duplicate phone error | ⬜ | ⬜ | |
| 3.3.7 | View customer details | ⬜ | ⬜ | |
| 3.3.8 | View customer orders | ⬜ | ⬜ | |
| 3.3.9 | Total Spent calculation | ⬜ | ⬜ | |
| 3.3.10 | Edit customer | ⬜ | ⬜ | |
| 3.3.11 | Add customer tags | ⬜ | ⬜ | |
| 3.3.12 | Search customer | ⬜ | ⬜ | |

**Issues Found**:  
_____________________________________________________  
_____________________________________________________

### 3.4 Inventory & Warehouse

| # | Test Action | ✅ Pass | ❌ Fail | Notes |
|---|------------|---------|---------|-------|
| 3.4.1 | Navigate to `/warehouse` | ⬜ | ⬜ | |
| 3.4.2 | View inventory list | ⬜ | ⬜ | |
| 3.4.3 | Filter by location | ⬜ | ⬜ | |
| 3.4.4 | Stock In: Add 10 units | ⬜ | ⬜ | |
| 3.4.5 | Stock Out: Remove 5 units | ⬜ | ⬜ | |
| 3.4.6 | Stock Out > available | ⬜ | ⬜ | |
| 3.4.7 | View inventory history | ⬜ | ⬜ | |
| 3.4.8 | Low stock alert | ⬜ | ⬜ | |
| 3.4.9 | Set expiry date | ⬜ | ⬜ | |
| 3.4.10 | Manual adjustment | ⬜ | ⬜ | |
| 3.4.11 | Stock never negative | ⬜ | ⬜ | |

**Issues Found**:  
_____________________________________________________  
_____________________________________________________

---

## LAYER 4: Role-Based Access Control (RBAC)

### Permission Matrix

Test each role (ADMIN, MANAGER, STAFF, PACKING) for:

| Action | ADMIN | MANAGER | STAFF | PACKING | Test Result |
|--------|-------|---------|-------|---------|-------------|
| Create Product | ✅ | ✅ | ❌ | ❌ | ⬜ ⬜ ⬜ ⬜ |
| Edit Product | ✅ | ✅ | ✅ | ❌ | ⬜ ⬜ ⬜ ⬜ |
| Delete Product | ✅ | ✅ | ❌ | ❌ | ⬜ ⬜ ⬜ ⬜ |
| Create Order | ✅ | ✅ | ✅ | ❌ | ⬜ ⬜ ⬜ ⬜ |
| Cancel Order | ✅ | ❌ | ❌ | ❌ | ⬜ ⬜ ⬜ ⬜ |
| Process Refund | ✅ | ✅ | ❌ | ❌ | ⬜ ⬜ ⬜ ⬜ |
| View Settings | ✅ | ❌ | ❌ | ❌ | ⬜ ⬜ ⬜ ⬜ |
| Edit Settings | ✅ | ❌ | ❌ | ❌ | ⬜ ⬜ ⬜ ⬜ |
| Manage Users | ✅ | ✅ | ❌ | ❌ | ⬜ ⬜ ⬜ ⬜ |
| View Analytics | ✅ | ✅ | ✅ | ❌ | ⬜ ⬜ ⬜ ⬜ |
| Export Reports | ✅ | ✅ | ❌ | ❌ | ⬜ ⬜ ⬜ ⬜ |

**Issues Found**:  
_____________________________________________________  
_____________________________________________________

---

## LAYER 5: Data Integrity

| # | Test Action | ✅ Pass | ❌ Fail | Notes |
|---|------------|---------|---------|-------|
| 5.1 | Order → Inventory Sync | ⬜ | ⬜ | |
| 5.2 | Cancel Order → Stock Restore | ⬜ | ⬜ | |
| 5.3 | Payment → Order Status | ⬜ | ⬜ | |
| 5.4 | Customer → Order Relationship | ⬜ | ⬜ | |
| 5.5 | Revenue Calculation | ⬜ | ⬜ | |

**Issues Found**:  
_____________________________________________________  
_____________________________________________________

---

## LAYER 6: Analytics & Dashboard

| # | Test Action | ✅ Pass | ❌ Fail | Notes |
|---|------------|---------|---------|-------|
| 6.1 | Dashboard metrics load | ⬜ | ⬜ | |
| 6.2 | No NaN/undefined values | ⬜ | ⬜ | |
| 6.3 | Charts render correctly | ⬜ | ⬜ | |
| 6.4 | Date range filter works | ⬜ | ⬜ | |
| 6.5 | Revenue trends chart | ⬜ | ⬜ | |
| 6.6 | Top products display | ⬜ | ⬜ | |
| 6.7 | Export to PDF/Excel | ⬜ | ⬜ | |
| 6.8 | Empty state handling | ⬜ | ⬜ | |

**Issues Found**:  
_____________________________________________________  
_____________________________________________________

---

## LAYER 7: AI Features

| # | Test Action | ✅ Pass | ❌ Fail | Notes |
|---|------------|---------|---------|-------|
| 7.1 | Customer Intelligence segments | ⬜ | ⬜ | |
| 7.2 | Inventory AI forecasts | ⬜ | ⬜ | |
| 7.3 | Chat AI responses | ⬜ | ⬜ | |
| 7.4 | No sensitive data leakage | ⬜ | ⬜ | |

**Issues Found**:  
_____________________________________________________  
_____________________________________________________

---

## LAYER 8: Workflows & Automation

| # | Test Action | ✅ Pass | ❌ Fail | Notes |
|---|------------|---------|---------|-------|
| 8.1 | Create workflow | ⬜ | ⬜ | |
| 8.2 | Manual workflow trigger | ⬜ | ⬜ | |
| 8.3 | Automatic workflow trigger | ⬜ | ⬜ | |
| 8.4 | Disable workflow | ⬜ | ⬜ | |

**Issues Found**:  
_____________________________________________________  
_____________________________________________________

---

## LAYER 9: Communication Channels

| # | Test Action | ✅ Pass | ❌ Fail | Notes |
|---|------------|---------|---------|-------|
| 9.1 | Email sent correctly | ⬜ | ⬜ | |
| 9.2 | SMS sent correctly | ⬜ | ⬜ | |
| 9.3 | WhatsApp message sent | ⬜ | ⬜ | |
| 9.4 | No duplicate messages | ⬜ | ⬜ | |

**Issues Found**:  
_____________________________________________________  
_____________________________________________________

---

## LAYER 10: Error Handling

| # | Test Action | ✅ Pass | ❌ Fail | Notes |
|---|------------|---------|---------|-------|
| 10.1 | Network offline handling | ⬜ | ⬜ | |
| 10.2 | Invalid form submission | ⬜ | ⬜ | |
| 10.3 | Invalid URL access | ⬜ | ⬜ | |
| 10.4 | API error handling | ⬜ | ⬜ | |
| 10.5 | Large data handling | ⬜ | ⬜ | |
| 10.6 | No white screens | ⬜ | ⬜ | |
| 10.7 | User-friendly errors | ⬜ | ⬜ | |

**Issues Found**:  
_____________________________________________________  
_____________________________________________________

---

## LAYER 11: Business Owner Acceptance

### Critical Questions

1. **Can I run my business without help?**
   - [ ] Yes
   - [ ] No
   - **Notes**: _____________________________________________________

2. **Is anything confusing?**
   - [ ] Yes
   - [ ] No
   - **Notes**: _____________________________________________________

3. **Can mistakes be undone?**
   - [ ] Yes
   - [ ] No
   - **Notes**: _____________________________________________________

4. **Do numbers make sense?**
   - [ ] Yes
   - [ ] No
   - **Notes**: _____________________________________________________

5. **Would I trust money here?**
   - [ ] Yes
   - [ ] No
   - **Notes**: _____________________________________________________

**Acceptance Status**: ⬜ **APPROVED** ⬜ **NOT APPROVED**

---

## Test Summary

**Total Tests**: _______  
**Passed**: _______  
**Failed**: _______  
**Blocked**: _______

**Critical Issues**: _______  
**High Issues**: _______  
**Medium Issues**: _______  
**Low Issues**: _______

---

## Sign-Off

**Tester Name**: _______________________  
**Date**: _______________________  
**Signature**: _______________________

**Approver Name**: _______________________  
**Date**: _______________________  
**Signature**: _______________________

---

## Notes & Observations

_____________________________________________________  
_____________________________________________________  
_____________________________________________________  
_____________________________________________________

