# Deployment Scripts Review

## Overview

This document reviews all deployment scripts and configurations, identifying what needs to be updated after the database integration.

---

## Current Deployment Files

### 1. Dockerfile ✅
**Location**: `/Dockerfile`

**Current Status**: ✅ Good, but needs minor update

**Current Implementation**:
- Multi-stage build (deps → builder → runner)
- Generates Prisma client during build
- Uses temporary DATABASE_URL for Prisma generation
- Copies Prisma files and generated client

**Issues/Recommendations**:
- ✅ Prisma generation is included
- ⚠️ Uses hardcoded DATABASE_URL (line 22) - acceptable for build time
- ⚠️ **MISSING**: Database migration step after container starts
- ✅ Includes all necessary Prisma files

**Recommended Updates**:
```dockerfile
# Add to runner stage, after CMD or as entrypoint script
# Database migration should run on container startup
# Use entrypoint.sh script to handle migrations
```

---

### 2. docker-compose.yml ✅
**Location**: `/docker-compose.yml`

**Current Status**: ✅ Good

**Services**:
- MongoDB (port 27017)
- Redis (port 6379)
- Mongo Express (port 8081)
- App (port 3000)

**Current Configuration**:
- ✅ DATABASE_URL configured correctly
- ✅ Redis URL configured
- ✅ Environment variables set
- ✅ Dependencies configured

**Issues/Recommendations**:
- ⚠️ **MISSING**: Database migration on startup
- ⚠️ **MISSING**: Health check for app service
- ⚠️ **MISSING**: Restart policy for app
- ✅ Services are properly networked

**Recommended Updates**:
```yaml
app:
  # Add health check
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 40s
  
  # Add entrypoint script for migrations
  entrypoint: ["/app/entrypoint.sh"]
```

---

### 3. docker-compose.microservices.yml ✅
**Location**: `/docker-compose.microservices.yml`

**Current Status**: ✅ Good for microservices architecture

**Services**: API Gateway, User Service, Product Service, Order Service, Payment Service

**Note**: This is for microservices architecture. The main app uses the standard docker-compose.yml.

---

### 4. docker-build.sh ✅
**Location**: `/docker-build.sh`

**Current Status**: ✅ Good script

**Features**:
- ✅ Checks Docker availability
- ✅ Creates .env from template if missing
- ✅ Cleans previous builds
- ✅ Builds images
- ✅ Starts services
- ✅ Health checks for MongoDB, Redis, App

**Issues/Recommendations**:
- ⚠️ **MISSING**: Database migration after startup
- ⚠️ **MISSING**: Prisma migration step
- ✅ Health checks are good

**Recommended Updates**:
```bash
# After services start, add:
print_status "Running database migrations..."
docker-compose exec -T app npx prisma migrate deploy || \
docker-compose exec -T app npx prisma db push
```

---

### 5. scripts/setup.sh ✅
**Location**: `/scripts/setup.sh`

**Current Status**: ✅ Good for local development

**Features**:
- ✅ Checks Node.js version
- ✅ Installs dependencies
- ✅ Creates .env.local
- ✅ Generates Prisma client
- ✅ Pushes database schema
- ✅ Seeds database

**Issues/Recommendations**:
- ⚠️ Uses `prisma db push` instead of migrations
- ⚠️ Should mention the new models
- ✅ Good for development setup

**Recommended Updates**:
```bash
# Update to use migrations for production
echo "📦 Running database migrations..."
npx prisma migrate dev --name initial

# Or for production:
npx prisma migrate deploy
```

---

## Missing Deployment Components

### 1. Entrypoint Script ❌
**Status**: **MISSING**

**Purpose**: Run database migrations on container startup

**Recommended File**: `/entrypoint.sh`

```bash
#!/bin/sh
set -e

echo "🚀 Starting SmartStore AI..."

# Wait for database to be ready
echo "⏳ Waiting for database..."
until npx prisma db execute --stdin <<< "db.adminCommand('ping')" > /dev/null 2>&1; do
  echo "Database is unavailable - sleeping"
  sleep 2
done

echo "✅ Database is ready!"

# Run migrations
echo "📦 Running database migrations..."
npx prisma migrate deploy || npx prisma db push

# Start the application
echo "🚀 Starting application..."
exec node server.js
```

---

### 2. Production Migration Script ❌
**Status**: **MISSING**

**Recommended File**: `/scripts/deploy.sh`

```bash
#!/bin/bash
# Production deployment script
# Handles migrations, builds, and deployments

set -e

echo "🚀 Deploying SmartStore AI to production..."

# 1. Build
echo "📦 Building application..."
npm run build

# 2. Run migrations
echo "🗄️ Running database migrations..."
npx prisma migrate deploy

# 3. Start application
echo "🚀 Starting application..."
npm start
```

---

### 3. CI/CD Configuration ❌
**Status**: **MISSING**

**Recommended**: GitHub Actions workflow

**Location**: `.github/workflows/deploy.yml`

Should include:
- Build step
- Test step
- Database migration step
- Deployment step

---

## Required Updates

### Priority 1: Critical

1. **Add Entrypoint Script** (`entrypoint.sh`)
   - Run migrations on container startup
   - Wait for database readiness
   - Start application

2. **Update Dockerfile**
   - Copy entrypoint script
   - Make it executable
   - Use as CMD/ENTRYPOINT

3. **Update docker-compose.yml**
   - Add health checks
   - Add migration step in docker-build.sh

### Priority 2: Important

4. **Update docker-build.sh**
   - Add migration step after services start
   - Add better error handling

5. **Create Production Deployment Script**
   - `scripts/deploy.sh` for production deployments
   - Handles migrations properly

### Priority 3: Nice to Have

6. **CI/CD Pipeline**
   - GitHub Actions workflow
   - Automated testing
   - Automated deployment

---

## Database Migration Strategy

### Development
- Use `prisma db push` for quick schema updates
- Use `prisma migrate dev` for migration history

### Production
- Use `prisma migrate deploy` for applying migrations
- Always backup before migrations
- Run migrations before starting application

### Docker
- Run migrations in entrypoint script
- Wait for database to be ready
- Handle migration failures gracefully

---

## Environment Variables Required

### Database
- `DATABASE_URL` - MongoDB connection string

### Application
- `NEXTAUTH_SECRET` - Authentication secret
- `NEXTAUTH_URL` - Application URL
- `NODE_ENV` - Environment (production/development)

### Optional
- `REDIS_URL` - Redis connection string
- Other service-specific variables

---

## Testing Deployment Scripts

### Test Locally
```bash
# Build and test Docker image
docker build -t smartstore-ai .
docker run -p 3000:3000 smartstore-ai

# Test docker-compose
docker-compose up --build
```

### Test Production Build
```bash
# Test production build
npm run build
npm start
```

---

## Recommendations Summary

1. ✅ **Current scripts are good** - Minor updates needed
2. ⚠️ **Add entrypoint script** - For migrations on startup
3. ⚠️ **Add migration step** - To docker-build.sh
4. ⚠️ **Add health checks** - To docker-compose.yml
5. ⚠️ **Create production script** - For production deployments
6. ⚠️ **Update documentation** - With migration steps

---

## Next Steps

1. Create `entrypoint.sh` script
2. Update `Dockerfile` to use entrypoint
3. Update `docker-build.sh` with migration step
4. Update `docker-compose.yml` with health checks
5. Create `scripts/deploy.sh` for production
6. Test all deployment scripts
7. Document deployment process

