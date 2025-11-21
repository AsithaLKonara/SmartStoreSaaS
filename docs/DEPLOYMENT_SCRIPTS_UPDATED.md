# Deployment Scripts - Updates Summary

## ✅ Updates Completed

All deployment scripts have been reviewed and updated to support the new database integration.

---

## Files Updated

### 1. ✅ Dockerfile
**Changes**:
- Added `curl` package for health checks
- Added entrypoint script copy
- Updated CMD to use entrypoint script
- Entrypoint handles database migrations on startup

**Key Updates**:
```dockerfile
# Install curl for health checks
RUN apk add --no-cache openssl curl

# Copy entrypoint script
COPY --from=builder --chown=nextjs:nodejs /app/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

# Use entrypoint to handle migrations
ENTRYPOINT ["./entrypoint.sh"]
```

---

### 2. ✅ docker-compose.yml
**Changes**:
- Added health checks for MongoDB, Redis, and App
- Added service dependencies with health conditions
- App waits for MongoDB and Redis to be healthy before starting

**Key Updates**:
```yaml
# MongoDB health check
healthcheck:
  test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
  interval: 10s
  timeout: 5s
  retries: 5
  start_period: 20s

# Redis health check
healthcheck:
  test: ["CMD", "redis-cli", "ping"]
  interval: 10s
  timeout: 5s
  retries: 5
  start_period: 10s

# App depends on healthy services
depends_on:
  mongodb:
    condition: service_healthy
  redis:
    condition: service_healthy
```

---

### 3. ✅ docker-build.sh
**Changes**:
- Added database migration step after services start
- Tries `prisma migrate deploy` first, falls back to `prisma db push`

**Key Updates**:
```bash
# Run database migrations
print_status "Running database migrations..."
if docker-compose exec -T app npx prisma migrate deploy > /dev/null 2>&1; then
    print_success "Database migrations applied!"
elif docker-compose exec -T app npx prisma db push > /dev/null 2>&1; then
    print_success "Database schema pushed!"
else
    print_warning "Migration failed, but continuing..."
fi
```

---

### 4. ✅ mongo-init.js
**Changes**:
- Added collection creation for 8 new models
- Added indexes for new collections

**New Collections**:
- `reports`
- `report_templates`
- `campaign_templates`
- `campaign_metrics`
- `bulk_operation_templates`
- `inventory_movements`
- `courier_deliveries`
- `courier_ratings`

**New Indexes**:
- Organization-based indexes for all new collections
- Type/status indexes for filtering
- Foreign key indexes for relations

---

### 5. ✅ entrypoint.sh (NEW)
**Purpose**: Run database migrations before starting the app

**Features**:
- Waits for database to be ready
- Runs `prisma migrate deploy` (production)
- Falls back to `prisma db push` if migrations fail
- Starts Next.js application

**Location**: `/entrypoint.sh`

---

### 6. ✅ scripts/deploy.sh (NEW)
**Purpose**: Production deployment script

**Features**:
- Checks environment variables
- Installs dependencies
- Generates Prisma client
- Runs database migrations
- Type checks
- Builds application
- Optional test execution

**Location**: `/scripts/deploy.sh`

**Usage**:
```bash
npm run deploy
# or
npm run deploy --skip-tests
```

---

### 7. ✅ package.json
**Changes**:
- Added new npm scripts for deployment

**New Scripts**:
```json
{
  "db:migrate": "prisma migrate dev",
  "db:migrate:deploy": "prisma migrate deploy",
  "deploy": "bash scripts/deploy.sh",
  "docker:build": "bash docker-build.sh",
  "docker:up": "docker-compose up -d",
  "docker:down": "docker-compose down",
  "docker:logs": "docker-compose logs -f"
}
```

---

## Deployment Workflows

### Development Deployment
```bash
# 1. Setup (first time)
npm install
npm run db:push
npm run db:seed

# 2. Run development server
npm run dev
```

### Production Deployment (Docker)
```bash
# Option 1: Using docker-build.sh
npm run docker:build
# or
bash docker-build.sh

# Option 2: Manual docker-compose
docker-compose build
docker-compose up -d

# Check logs
npm run docker:logs
```

### Production Deployment (Non-Docker)
```bash
# Using deploy script
npm run deploy

# Or manually
npm ci
npm run db:migrate:deploy
npm run build
npm start
```

---

## Migration Strategy

### Docker Deployment
1. Container starts
2. Entrypoint script runs
3. Waits for database
4. Runs `prisma migrate deploy`
5. Starts application

### Manual Deployment
1. Run `npm run deploy`
2. Or manually:
   - `npm run db:migrate:deploy`
   - `npm run build`
   - `npm start`

---

## Health Checks

All services now have health checks:
- **MongoDB**: Checks database connectivity
- **Redis**: Checks Redis connectivity
- **App**: Checks `/api/health` endpoint

---

## New Collections in MongoDB

The following collections are now initialized:
- `reports`
- `report_templates`
- `campaign_templates`
- `campaign_metrics`
- `bulk_operation_templates`
- `inventory_movements`
- `courier_deliveries`
- `courier_ratings`

All have proper indexes for performance.

---

## Testing Deployment

### Test Docker Build
```bash
docker build -t smartstore-ai .
docker run -p 3000:3000 -e DATABASE_URL="mongodb://..." smartstore-ai
```

### Test Docker Compose
```bash
docker-compose up --build
curl http://localhost:3000/api/health
```

### Test Deploy Script
```bash
npm run deploy --skip-tests
```

---

## Troubleshooting

### Migration Fails
- Check DATABASE_URL is correct
- Check database is accessible
- Check Prisma schema is valid
- Review logs: `docker-compose logs app`

### Container Won't Start
- Check health checks: `docker-compose ps`
- Check logs: `docker-compose logs`
- Verify database is running: `docker-compose ps mongodb`

### Health Check Fails
- Wait longer for services to start
- Check service logs
- Verify ports are not in use

---

## Next Steps

1. ✅ Test deployment scripts locally
2. ✅ Verify migrations run correctly
3. ✅ Test health checks
4. ⚠️ Create CI/CD pipeline (optional)
5. ⚠️ Add monitoring/alerting (optional)

---

## Summary

✅ **All deployment scripts updated**
✅ **Database migrations integrated**
✅ **Health checks added**
✅ **New collections initialized**
✅ **Production deployment script created**

The deployment process now fully supports the new database models and will automatically run migrations on startup.

