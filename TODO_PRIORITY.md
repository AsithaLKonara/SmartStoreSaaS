# TODO/FIXME Priority Categorization

**Created**: $(date)  
**Project**: SmartStoreSaaS  
**Total TODOs Found**: 9 (in source code)

---

## Critical Priority (Must Address Before Production)

### Database/Model Related
1. **Inventory Service - Warehouse Count** 
   - **File**: `src/lib/inventory/inventoryService.ts:1135`
   - **Issue**: `Promise.resolve(0); // TODO: Count from warehouse settings`
   - **Impact**: Critical - Inventory counting may be inaccurate
   - **Action**: Implement proper warehouse settings count query
   - **Status**: Pending

2. **Gamification Service - Challenge Model**
   - **File**: `src/lib/advanced/gamificationService.ts:396`
   - **Issue**: `// TODO: Create Challenge model in Prisma schema or use Organization metadata`
   - **Impact**: High - Challenge features may not work correctly
   - **Action**: Create Challenge model in Prisma schema or implement Organization metadata storage
   - **Status**: Pending

---

## High Priority (Should Address Soon)

### Security Related
3. **Security API - MFA Count**
   - **File**: `src/app/api/security/route.ts:80`
   - **Issue**: `const mfaEnabledUsers = 0; // TODO: Implement proper MFA count`
   - **Impact**: High - MFA statistics may be incorrect, affecting security reporting
   - **Action**: Implement proper MFA user count query from database
   - **Status**: Pending

### Integration Related
4. **WhatsApp Service - Template Storage**
   - **File**: `src/lib/whatsapp/whatsappService.ts:414`
   - **Issue**: `// TODO: WhatsAppTemplate model not in schema - store in metadata instead`
   - **Impact**: Medium-High - WhatsApp template features may not persist correctly
   - **Action**: Add WhatsAppTemplate model to Prisma schema or implement metadata storage
   - **Status**: Pending

5. **WhatsApp Catalog API**
   - **File**: `src/app/api/whatsapp/catalog/route.ts:20`
   - **Issue**: `// TODO: Implement updateCatalog method in WhatsAppService`
   - **Impact**: Medium - Catalog update functionality missing
   - **Action**: Implement updateCatalog method in WhatsAppService
   - **Status**: Pending

---

## Medium Priority (Feature Improvements)

### Service Improvements
6. **Gamification Service - Challenge Retrieval**
   - **File**: `src/lib/advanced/gamificationService.ts:425`
   - **Issue**: `// TODO: Retrieve challenge from storage (Organization metadata or separate model)`
   - **Impact**: Medium - Challenge retrieval may not work correctly
   - **Action**: Implement challenge retrieval from storage (related to #2)
   - **Status**: Pending

7. **Email Service - Non-User Email Storage**
   - **File**: `src/lib/email/emailService.ts:483`
   - **Issue**: `// TODO: Also store in a separate list for non-user emails`
   - **Impact**: Medium - Non-user emails may not be tracked properly
   - **Action**: Implement separate storage/list for non-user emails
   - **Status**: Pending

8. **Analytics Service - Courier Name Fetching**
   - **File**: `src/lib/ai/analyticsService.ts:376`
   - **Issue**: `const courierName = courierId || 'Unknown'; // TODO: Fetch from CourierDelivery or metadata`
   - **Impact**: Low-Medium - Analytics may show 'Unknown' for courier names
   - **Action**: Implement proper courier name fetching from CourierDelivery model
   - **Status**: Pending

---

## Low Priority (Optimization Tasks)

### Logging/Audit Improvements
9. **MFA Service - Activity Logging**
   - **File**: `src/lib/auth/mfaService.ts:548`
   - **Issue**: `// TODO: Use Activity model for MFA logs instead of mfaLog`
   - **Impact**: Low - MFA logs may not be properly integrated with activity system
   - **Action**: Refactor to use Activity model for MFA logs
   - **Status**: Pending

---

## Summary by Category

### Database/Model Issues (3)
- Inventory warehouse count
- Challenge model creation
- WhatsAppTemplate model

### Security (1)
- MFA count implementation

### Integration (2)
- WhatsApp catalog update
- WhatsApp template storage

### Service Improvements (2)
- Challenge retrieval
- Email non-user storage
- Courier name fetching

### Logging/Audit (1)
- MFA activity logging

---

## Recommended Action Plan

### Phase 1: Critical Issues (Before Production)
1. Fix inventory warehouse count (#1)
2. Create Challenge model or implement metadata storage (#2)
3. Implement MFA count (#3)

### Phase 2: High Priority (Within 2 Weeks)
4. Implement WhatsAppTemplate model (#4)
5. Implement updateCatalog method (#5)

### Phase 3: Medium Priority (Within 1 Month)
6. Implement challenge retrieval (#6)
7. Implement non-user email storage (#7)
8. Implement courier name fetching (#8)

### Phase 4: Low Priority (Ongoing)
9. Refactor MFA logging (#9)

---

## Notes

- Most TODOs are related to missing Prisma models or incomplete database queries
- Consider creating a unified metadata storage system for features that don't need separate models
- Some TODOs are interdependent (e.g., #2 and #6 both relate to Challenge model)
- Review with product team to determine if all features are still needed

