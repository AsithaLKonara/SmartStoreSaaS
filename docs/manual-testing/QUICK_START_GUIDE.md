# Manual Testing Quick Start Guide

**For**: QA Testers, Developers, Business Owners  
**Time Required**: 2-4 hours for full suite

---

## Step 1: Setup (5 minutes)

```bash
# Terminal 1: Start the server
cd /Users/asithalakmal/Documents/web/SmartStoreSaaS
npm run dev

# Wait for: "Ready on http://localhost:3000"
```

**Browser Setup**:
1. Open Chrome
2. Open DevTools (F12 or Cmd+Option+I)
3. Open tabs: Network, Console, Application
4. Use Incognito mode (Cmd+Shift+N)

---

## Step 2: Test Accounts (2 minutes)

### Option A: Use Existing Mock Users
- **Admin**: `admin@smartstore.ai` / `admin123`
- **Staff**: `user@smartstore.ai` / `user123`

### Option B: Create New Test Users
Navigate to `/auth/signup` and create:
- Owner/Admin account
- Manager account  
- Staff account
- Packing account

---

## Step 3: Execute Tests (2-4 hours)

### Priority Order

1. **CRITICAL PATH** (30-45 min) - Must test first:
   - [ ] Layer 1: Authentication
   - [ ] Layer 2: Multi-Tenant Isolation ⚠️ CRITICAL
   - [ ] Layer 3: Core Business Flows (Products, Orders, Customers)
   - [ ] Layer 5: Data Integrity

2. **HIGH PRIORITY** (45-60 min):
   - [ ] Layer 4: RBAC
   - [ ] Layer 10: Error Handling
   - [ ] Layer 6: Analytics

3. **MEDIUM PRIORITY** (30-45 min):
   - [ ] Layer 7: AI Features
   - [ ] Layer 8: Workflows
   - [ ] Layer 9: Communication

4. **FINAL GATE** (15 min):
   - [ ] Layer 11: Business Owner Acceptance

---

## Step 4: Document Results

### Use the Checklist
- Open: `MANUAL_TEST_CHECKLIST.md`
- Check ✅ or ❌ for each test
- Add notes for any issues

### Log Issues
- Use: `ISSUES_LOG.md` template
- Document severity, steps to reproduce, screenshots

### Update Execution Log
- Update: `TEST_EXECUTION_LOG.csv`
- Track pass/fail for each test case

---

## Step 5: Sign-Off

### Complete Sign-Off Document
- Fill: `QA_SIGN_OFF_TEMPLATE.md`
- Get approvals from:
  - QA Lead
  - Development Lead
  - Business Owner

---

## Tips for Efficient Testing

### Use Cursor AI Assistance

While testing, ask Cursor:
- "What should happen when I click this button?"
- "What edge cases should I test for products?"
- "What API calls should I see in Network tab?"

### Focus Areas

**Most Important**:
1. Multi-tenant isolation (data leakage)
2. Order → Inventory sync
3. Payment processing
4. RBAC permissions

**Watch For**:
- Console errors (check Console tab)
- API 500 errors (check Network tab)
- Data not persisting after refresh
- Cross-organization data leakage

---

## Testing Time Estimates

| Layer | Estimated Time | Priority |
|-------|----------------|----------|
| Layer 1: Auth | 15 min | Critical |
| Layer 2: Multi-Tenant | 30 min | Critical |
| Layer 3: Core Flows | 60 min | Critical |
| Layer 4: RBAC | 30 min | High |
| Layer 5: Data Integrity | 20 min | Critical |
| Layer 6: Analytics | 20 min | High |
| Layer 7: AI | 15 min | Medium |
| Layer 8: Workflows | 15 min | Medium |
| Layer 9: Communication | 15 min | Medium |
| Layer 10: Errors | 20 min | High |
| Layer 11: Acceptance | 15 min | Critical |
| **Total** | **~4 hours** | |

---

## Quick Checklist for Daily Testing

If testing incrementally, use this daily checklist:

**Daily Quick Test** (15 minutes):
- [ ] Login/Logout works
- [ ] Can create product
- [ ] Can create order
- [ ] Can create customer
- [ ] Dashboard loads
- [ ] No console errors
- [ ] No API 500 errors

**Weekly Full Test** (2 hours):
- [ ] Complete Layer 1-3
- [ ] Complete Layer 5
- [ ] Complete Layer 10

**Pre-Release Full Test** (4 hours):
- [ ] Complete all 11 layers
- [ ] All critical path tests pass
- [ ] Business owner acceptance

---

## Common Issues to Watch For

### Authentication
- Infinite redirects
- Session not persisting
- Logout not working

### Multi-Tenant
- Seeing other organization's data
- Direct URL access to other org resources
- API returning wrong org data

### Orders & Inventory
- Stock not updating when order created
- Stock not restored when order cancelled
- Negative stock allowed

### Permissions
- Staff users can delete orders
- Packing users can create products
- Buttons visible but actions blocked

### Data Integrity
- Revenue calculations incorrect
- Customer order history missing
- Payment status not updating

---

## Getting Help

### If You Get Stuck

1. **Check Console Tab**: Look for JavaScript errors
2. **Check Network Tab**: Look for failed API calls
3. **Ask Cursor AI**: "What should I expect to see?"
4. **Check Documentation**: See PROJECT_OVERVIEW.md

### Reporting Issues

1. Document in ISSUES_LOG.md
2. Take screenshots
3. Note browser and steps to reproduce
4. Assign severity (Critical/High/Medium/Low)

---

## Success Criteria

**You're Done When**:
- ✅ All critical path tests passed
- ✅ Zero critical/high severity issues
- ✅ Business owner acceptance = YES
- ✅ Sign-off document completed

**You Can Ship When**:
- ✅ QA sign-off = APPROVED
- ✅ Dev lead sign-off = APPROVED  
- ✅ Business owner sign-off = APPROVED

---

**Happy Testing! 🧪**

