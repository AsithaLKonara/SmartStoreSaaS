# Deployment Quick Start Guide

## 🚀 Quick Deployment Options

### Option 1: Docker (Recommended)
```bash
# Build and start all services
npm run docker:build

# Or manually
docker-compose up --build -d

# View logs
npm run docker:logs
```

### Option 2: Production Script
```bash
# Full production deployment
npm run deploy

# Skip tests
npm run deploy --skip-tests
```

### Option 3: Manual Steps
```bash
# 1. Install dependencies
npm ci

# 2. Generate Prisma client
npm run db:generate

# 3. Run migrations
npm run db:migrate:deploy

# 4. Build
npm run build

# 5. Start
npm start
```

---

## 📦 Docker Deployment

### First Time Setup
```bash
# 1. Build and start
docker-compose up --build -d

# 2. Check logs
docker-compose logs -f app

# 3. Verify health
curl http://localhost:3000/api/health
```

### Database Migrations

Migrations run automatically on container startup via `entrypoint.sh`.

**Manual migration** (if needed):
```bash
docker-compose exec app npx prisma migrate deploy
```

---

## 🔧 Environment Setup

### Required Variables
```bash
DATABASE_URL="mongodb://user:pass@host:27017/smartstore"
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"
NODE_ENV="production"
```

### Copy from template
```bash
cp env.production .env
# Edit .env with your values
```

---

## 📊 Service URLs (Docker)

- **Application**: http://localhost:3000
- **MongoDB**: mongodb://localhost:27017
- **Mongo Express**: http://localhost:8081
- **Redis**: redis://localhost:6379

---

## ✅ Health Checks

All services include health checks:
- MongoDB: `mongosh --eval "db.adminCommand('ping')"`
- Redis: `redis-cli ping`
- App: `curl http://localhost:3000/api/health`

---

## 🐛 Troubleshooting

### Container won't start
```bash
# Check logs
docker-compose logs app

# Check service status
docker-compose ps

# Restart services
docker-compose restart
```

### Migration fails
```bash
# Check database connection
docker-compose exec mongodb mongosh --eval "db.adminCommand('ping')"

# Run migration manually
docker-compose exec app npx prisma migrate deploy
```

### Build fails
```bash
# Clean build
docker-compose down --volumes
docker-compose build --no-cache
docker-compose up -d
```

---

## 📝 Useful Commands

```bash
# Docker
npm run docker:up        # Start services
npm run docker:down      # Stop services
npm run docker:logs      # View logs
npm run docker:build     # Build and deploy

# Database
npm run db:migrate       # Run migrations (dev)
npm run db:migrate:deploy # Deploy migrations (prod)
npm run db:push          # Push schema (dev)
npm run db:studio        # Open Prisma Studio

# Application
npm run dev              # Development server
npm run build            # Production build
npm run start            # Production server
npm run deploy           # Full deployment
```

---

## 🔍 Verification

After deployment, verify:
1. Health endpoint: `curl http://localhost:3000/api/health`
2. Database connection: Check logs for "Database is ready!"
3. Migrations: Check logs for "Migrations applied successfully!"
4. Application: Visit http://localhost:3000

---

## 📚 Documentation

- **DEPLOYMENT_SCRIPTS_REVIEW.md** - Detailed review
- **DEPLOYMENT_SCRIPTS_UPDATED.md** - Update summary
- **DEPLOYMENT_CHECKLIST.md** - Pre-deployment checklist

---

## ⚠️ Important Notes

1. **MongoDB**: Uses `prisma db push` for MongoDB (not SQL migrations)
2. **Migrations**: Run automatically on container startup
3. **Health Checks**: Services wait for dependencies to be healthy
4. **New Collections**: Initialized in `mongo-init.js`
5. **Entrypoint**: Handles migrations before starting app

---

## 🎯 Next Steps

1. ✅ Configure environment variables
2. ✅ Run deployment
3. ✅ Verify all services are healthy
4. ✅ Test API endpoints
5. ✅ Monitor logs

---

**Ready to deploy!** 🚀

