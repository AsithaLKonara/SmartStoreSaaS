# Testing Guide for Database Integration

## Overview

This guide covers testing the newly integrated database endpoints. All mock data has been replaced with real database queries.

## Prisma Mock Setup

When testing API routes, you'll need to mock the following Prisma models:

### New Models to Mock:
```typescript
jest.mock('@/lib/prisma', () => ({
  prisma: {
    // Existing models
    product: { ... },
    order: { ... },
    customer: { ... },
    
    // New models
    report: {
      findMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    reportTemplate: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    campaignTemplate: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    campaignMetric: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    bulkOperation: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    bulkOperationTemplate: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    inventoryMovement: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    courierDelivery: {
      aggregate: jest.fn(),
      findFirst: jest.fn(),
    },
    courierRating: {
      aggregate: jest.fn(),
    },
  },
}));
```

## Test Files to Create/Update

### 1. Reports API Tests
**File**: `src/app/api/reports/__tests__/route.test.ts`

```typescript
describe('Reports API', () => {
  it('should fetch reports from database', async () => {
    const mockReports = [{ id: '1', name: 'Sales Report', ... }];
    (prisma.report.findMany as jest.Mock).mockResolvedValue(mockReports);
    // ... test implementation
  });
});
```

### 2. Campaigns API Tests
**File**: `src/app/api/campaigns/__tests__/route.test.ts`

- Test GET with metrics inclusion
- Test POST with metric initialization
- Verify CampaignMetric is created on campaign creation

### 3. Bulk Operations API Tests
**File**: `src/app/api/bulk-operations/__tests__/route.test.ts`

- Test progress calculation
- Test operation creation with proper fields

### 4. Couriers API Tests
**File**: `src/app/api/couriers/__tests__/route.test.ts`

- Test rating aggregation
- Test delivery count
- Test earnings calculation
- Test online status

### 5. Warehouse Movements API Tests
**File**: `src/app/api/warehouses/movements/__tests__/route.test.ts`

- Test movement creation with transaction
- Test stock quantity updates
- Test movement queries

### 6. Dashboard Stats API Tests
**File**: `src/app/api/analytics/dashboard-stats/__tests__/route.test.ts`

- Test revenue calculation
- Test percentage change calculations
- Test aggregation queries

## Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- reports/__tests__/route.test.ts

# Run with coverage
npm test -- --coverage
```

## Mock Data Patterns

### Example: Campaign Creation Test
```typescript
it('should create campaign with metrics', async () => {
  const mockCampaign = {
    id: 'campaign-1',
    name: 'Test Campaign',
    // ... other fields
  };
  
  const mockMetric = {
    id: 'metric-1',
    campaignId: 'campaign-1',
    sent: 0,
    delivered: 0,
    // ... other fields
  };

  (prisma.campaign.create as jest.Mock).mockResolvedValue({
    ...mockCampaign,
    metrics: [mockMetric],
  });

  const response = await POST(request);
  const data = await response.json();

  expect(data.stats).toEqual({
    sent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    bounced: 0,
  });
});
```

### Example: Aggregation Test (Couriers)
```typescript
it('should calculate courier stats', async () => {
  (prisma.courierRating.aggregate as jest.Mock).mockResolvedValue({
    _avg: { rating: 4.5 },
  });
  
  (prisma.courierDelivery.aggregate as jest.Mock).mockResolvedValue({
    _sum: { earnings: 1500.50 },
  });

  // ... test implementation
});
```

## Common Test Patterns

### 1. Authentication Tests
Always test unauthorized access:
```typescript
it('should return 401 for unauthorized users', async () => {
  (getServerSession as jest.Mock).mockResolvedValue(null);
  const response = await GET(request);
  expect(response.status).toBe(401);
});
```

### 2. Database Query Tests
Verify correct Prisma queries:
```typescript
it('should query with organization filter', async () => {
  await GET(request);
  expect(prisma.report.findMany).toHaveBeenCalledWith({
    where: { organizationId: 'org-1' },
    orderBy: { createdAt: 'desc' },
  });
});
```

### 3. Error Handling Tests
Test error scenarios:
```typescript
it('should handle database errors', async () => {
  (prisma.report.findMany as jest.Mock).mockRejectedValue(
    new Error('Database error')
  );
  const response = await GET(request);
  expect(response.status).toBe(500);
});
```

## Integration Testing

For integration tests, you'll need:
1. Test database setup
2. Seed data
3. Cleanup after tests

Example:
```typescript
beforeAll(async () => {
  // Setup test database
});

afterEach(async () => {
  // Clean test data
});

afterAll(async () => {
  // Teardown
});
```

## Notes

- All tests should mock Prisma client
- Use `jest.fn()` for all Prisma methods
- Test both success and error cases
- Verify correct data transformations
- Test authentication and authorization
- Test pagination where applicable
- Test sorting and filtering

