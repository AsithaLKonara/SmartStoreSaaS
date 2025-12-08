# SmartStoreSaaS Test Suite

This directory contains comprehensive test suites for the SmartStoreSaaS application, organized by test type and functionality.

## Test Structure

```
src/__tests__/
├── e2e/                    # End-to-end tests
│   ├── auth-flow.test.tsx
│   ├── commerce-flow.test.tsx
│   └── search-flow.test.tsx
├── api/                     # API contract tests
│   ├── api-contracts.test.ts
│   └── background-jobs.test.ts
├── integrations/            # Integration tests
│   ├── messaging.test.ts
│   └── commerce-integrations.test.ts
├── non-functional/          # Non-functional tests
│   ├── role-permissions.test.ts
│   ├── accessibility.test.tsx
│   └── performance.test.ts
├── regression/              # Regression tests
│   ├── smoke-suite.test.ts
│   ├── release-regression.test.ts
│   └── observability.test.ts
└── data/                    # Test data management
    └── test-data-management.test.ts
```

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests in watch mode
```bash
npm run test:watch
```

### Run specific test suite
```bash
npm test -- e2e/auth-flow
npm test -- api/api-contracts
npm test -- non-functional/performance
```

### Run with coverage
```bash
npm test -- --coverage
```

## Test Categories

### 1. E2E Tests (`e2e/`)
End-to-end tests covering complete user journeys:
- **auth-flow**: Signup, signin, password reset, MFA
- **commerce-flow**: Product CRUD, inventory, order lifecycle, payments
- **search-flow**: Basic/advanced search, autosuggest, analytics

### 2. API Contract Tests (`api/`)
Tests validating API routes, schemas, and contracts:
- **api-contracts**: Request/response validation, status codes, error handling
- **background-jobs**: Workflow triggers, sync events, webhooks

### 3. Integration Tests (`integrations/`)
Tests for third-party integrations:
- **messaging**: WhatsApp, Facebook, Email, SMS
- **commerce-integrations**: Shopify, WooCommerce sync

### 4. Non-Functional Tests (`non-functional/`)
Tests for quality attributes:
- **role-permissions**: Feature gating, RBAC
- **accessibility**: ARIA labels, keyboard nav, responsive design
- **performance**: Response times, concurrent requests, caching

### 5. Regression Tests (`regression/`)
Automated regression testing:
- **smoke-suite**: Daily critical path checks
- **release-regression**: Full suite before releases
- **observability**: CI/CD, logging, monitoring, alerts

### 6. Test Data Management (`data/`)
Tests for test data handling:
- Data seeding per environment
- Data anonymization
- Data cleanup and reset scripts

## Test Coverage Goals

- **Lines**: 70%+
- **Functions**: 70%+
- **Branches**: 70%+
- **Statements**: 70%+

## Writing New Tests

### E2E Test Example
```typescript
describe('Feature Name', () => {
  it('should perform action', async () => {
    // Arrange
    // Act
    // Assert
  });
});
```

### API Test Example
```typescript
describe('API Endpoint', () => {
  it('should return correct response', async () => {
    const response = await fetch('/api/endpoint');
    expect(response.ok).toBe(true);
  });
});
```

## Best Practices

1. **Isolation**: Each test should be independent
2. **Cleanup**: Clean up test data after tests
3. **Mocking**: Mock external dependencies
4. **Assertions**: Use clear, descriptive assertions
5. **Naming**: Use descriptive test names

## CI/CD Integration

Tests run automatically on:
- Pull requests
- Commits to main branch
- Scheduled nightly runs

## Troubleshooting

### Tests failing locally
1. Ensure all dependencies are installed: `npm install`
2. Check database connection
3. Verify environment variables are set
4. Clear test cache: `npm test -- --clearCache`

### Coverage below threshold
1. Review uncovered code
2. Add tests for missing coverage
3. Check if code is actually needed

## Resources

- [Jest Documentation](https://jestjs.io/)
- [Testing Library](https://testing-library.com/)
- [Next.js Testing](https://nextjs.org/docs/testing)

