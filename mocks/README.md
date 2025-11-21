# Mock Data & Test Fixtures

This directory contains mock data, test fixtures, and placeholder implementations for development and testing.

## 📦 Contents

### Mock Data Files
- Product mock data
- Order mock data
- Customer mock data
- User mock data

### Test Fixtures
- API response mocks
- Database seed data
- Test user accounts

## 🧪 Usage

### Development
Mock data can be used during development when:
- Database is not available
- Testing specific scenarios
- Developing frontend components

### Testing
Test fixtures are used in:
- Unit tests
- Integration tests
- E2E tests

## 📝 Mock Data Structure

```
mocks/
├── README.md (this file)
├── products.json (product mock data)
├── orders.json (order mock data)
├── customers.json (customer mock data)
└── users.json (user mock data)
```

## 🔄 Integration with Database

**Note**: The project has been migrated to use real database queries. Mock data is now primarily used for:
- Testing
- Development seeding
- Documentation examples

See [Database Integration Report](../DATABASE_INTEGRATION_REPORT.md) for details.

## 🚀 Seed Database

To seed the database with mock data:
```bash
npm run db:seed
```

This uses `prisma/seed.ts` which may reference mock data files.

---

**Last Updated**: $(date)

