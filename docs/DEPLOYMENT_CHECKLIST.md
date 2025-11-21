# Deployment Checklist - Database Integration

## Pre-Deployment

### 1. Database Migration
- [ ] Backup existing database (if any)
- [ ] Set `DATABASE_URL` environment variable
- [ ] Run migration: `npx prisma migrate dev --name add_missing_models`
- [ ] Verify migration was successful
- [ ] Check database connection in production

### 2. Environment Variables
- [ ] `DATABASE_URL` - MongoDB connection string
- [ ] `NEXTAUTH_SECRET` - Authentication secret
- [ ] `NEXTAUTH_URL` - Application URL
- [ ] All other required env vars are set

### 3. Code Verification
- [x] All API routes use database queries (no mock data)
- [x] Prisma client generated successfully
- [x] No TypeScript errors in new/modified files
- [x] No linter errors
- [ ] All tests pass (run `npm test`)

### 4. Testing
- [ ] Test Reports API endpoints
- [ ] Test Campaign Templates API
- [ ] Test Bulk Operations API
- [ ] Test Couriers API with stats
- [ ] Test Campaigns API with metrics
- [ ] Test Warehouse Movements API
- [ ] Test Dashboard Stats API
- [ ] Test Recent Orders API
- [ ] Test Recent Chats API
- [ ] Test Dashboard page loads correctly

## Database Schema Verification

### New Models
- [ ] `Report` - Reports table created
- [ ] `ReportTemplate` - Report templates table created
- [ ] `CampaignTemplate` - Campaign templates table created
- [ ] `CampaignMetric` - Campaign metrics table created
- [ ] `BulkOperationTemplate` - Bulk operation templates table created
- [ ] `InventoryMovement` - Inventory movements table created
- [ ] `CourierDelivery` - Courier deliveries table created
- [ ] `CourierRating` - Courier ratings table created

### Updated Models
- [ ] `BulkOperation` - Has `name` field
- [ ] `Campaign` - Has `metrics` relation
- [ ] `Courier` - Has `deliveries` and `ratings` relations

## API Endpoints Verification

### Reports
- [ ] `GET /api/reports` - Returns reports from database
- [ ] `POST /api/reports` - Creates report in database
- [ ] `GET /api/reports/templates` - Returns templates from database
- [ ] `POST /api/reports/templates` - Creates template in database

### Campaigns
- [ ] `GET /api/campaigns` - Returns campaigns with metrics
- [ ] `POST /api/campaigns` - Creates campaign with metrics
- [ ] `GET /api/campaigns/templates` - Returns templates from database
- [ ] `POST /api/campaigns/templates` - Creates template in database

### Bulk Operations
- [ ] `GET /api/bulk-operations` - Returns operations with progress
- [ ] `POST /api/bulk-operations` - Creates operation in database
- [ ] `GET /api/bulk-operations/templates` - Returns templates from database
- [ ] `POST /api/bulk-operations/templates` - Creates template in database

### Couriers
- [ ] `GET /api/couriers` - Returns couriers with calculated stats
- [ ] Stats calculated from database (rating, deliveries, earnings)

### Warehouse Movements
- [ ] `GET /api/warehouses/movements` - Returns movements from database
- [ ] `POST /api/warehouses/movements` - Creates movement with transaction

### Dashboard
- [ ] `GET /api/analytics/dashboard-stats` - Returns aggregated stats
- [ ] `GET /api/orders/recent` - Returns recent orders
- [ ] `GET /api/chat/recent` - Returns recent chats
- [ ] Dashboard page loads and displays real data

## Frontend Verification

### Dashboard Page
- [ ] Loads without errors
- [ ] Displays real revenue data
- [ ] Displays real order count
- [ ] Displays real customer count
- [ ] Displays real product count
- [ ] Shows percentage changes
- [ ] Displays recent orders
- [ ] Displays recent chats
- [ ] Handles loading states
- [ ] Handles error states

## Performance Considerations

- [ ] Database indexes are optimal
- [ ] Queries are efficient (no N+1 problems)
- [ ] Aggregations are optimized
- [ ] Pagination is implemented where needed
- [ ] Caching strategy considered (if applicable)

## Security

- [ ] All endpoints require authentication
- [ ] Organization isolation is enforced
- [ ] Input validation is in place
- [ ] SQL injection protection (Prisma handles this)
- [ ] Rate limiting considered

## Monitoring

- [ ] Error logging is in place
- [ ] Database query logging (in development)
- [ ] Performance monitoring setup
- [ ] Alerting for database errors

## Rollback Plan

If issues occur:
1. [ ] Revert to previous deployment
2. [ ] Check database state
3. [ ] Review error logs
4. [ ] Fix issues and redeploy

## Post-Deployment

- [ ] Monitor error logs
- [ ] Check database performance
- [ ] Verify all endpoints are working
- [ ] Test with real user data
- [ ] Monitor API response times

## Notes

- MongoDB migrations are handled differently than SQL databases
- Use `prisma db push` for schema changes in development
- Use `prisma migrate dev` for migration files (if using migration history)
- Always backup before running migrations in production

