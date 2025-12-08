# API Error Handling Pattern

This document describes the standard pattern for fixing API route 500 errors.

## Standard Error Handling Pattern

All API routes should follow this pattern:

### 1. Imports

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma, executePrismaQuery, validateOrganizationId } from '@/lib/prisma';
import { handleApiError, validateSession } from '@/lib/api-error-handler';
```

### 2. Session Validation

```typescript
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const sessionValidation = validateSession(session);
    if (!sessionValidation.valid) {
      return NextResponse.json({ message: sessionValidation.error || 'Unauthorized' }, { status: 401 });
    }
    
    const organizationId = validateOrganizationId(session?.user?.organizationId);
    // ... rest of handler
  } catch (error) {
    const session = await getServerSession(authOptions).catch(() => null);
    return handleApiError(error, request, session);
  }
}
```

### 3. Prisma Queries

Always wrap Prisma queries with `executePrismaQuery`:

```typescript
// ❌ Bad
const products = await prisma.product.findMany({ where: { organizationId } });

// ✅ Good
const products = await executePrismaQuery(() =>
  prisma.product.findMany({ where: { organizationId } })
);
```

### 4. Error Handling

Always use `handleApiError` in catch blocks:

```typescript
// ❌ Bad
catch (error) {
  console.error('Error:', error);
  return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
}

// ✅ Good
catch (error) {
  const session = await getServerSession(authOptions).catch(() => null);
  return handleApiError(error, request, session);
}
```

## Routes Fixed

- ✅ `/api/products` - GET, POST
- ✅ `/api/orders` - GET, POST
- ✅ `/api/analytics` - GET
- ✅ `/api/customers` - GET, POST
- ✅ `/api/payments` - GET, POST
- ✅ `/api/campaigns` - GET, POST

## Routes Still Needing Fixes

Apply the same pattern to:
- `/api/analytics/*` (bi, enhanced, predictive, etc.)
- `/api/integrations` routes
- `/api/reports` routes
- `/api/chat/*` routes
- `/api/warehouses/*` routes
- `/api/couriers/*` routes
- `/api/expenses` route
- `/api/sync/*` routes
- `/api/bulk-operations/*` routes
- Other routes returning 500 errors

## Benefits

1. **Consistent Error Handling**: All routes use the same error handling pattern
2. **Better Logging**: Errors are logged with context (route, method, session, etc.)
3. **Connection Retry**: `executePrismaQuery` automatically retries on connection errors
4. **Proper Status Codes**: Errors return appropriate HTTP status codes
5. **Development Details**: Error details shown in development, generic in production

