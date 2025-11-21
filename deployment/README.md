# Deployment Configuration

This directory contains deployment configurations and scripts for various platforms.

## 📦 Contents

### Docker Deployment
- `../docker-compose.yml` - Main Docker Compose configuration
- `../docker-compose.microservices.yml` - Microservices configuration
- `../Dockerfile` - Main application Dockerfile
- `../docker-build.sh` - Docker build script
- `../entrypoint.sh` - Container entrypoint script

### Vercel Deployment
- `../vercel.json` - Vercel configuration
- `../.vercelignore` - Vercel ignore patterns
- `../scripts/vercel-deploy.sh` - Vercel deployment script

### CI/CD
- `../.github/workflows/vercel-deploy.yml` - GitHub Actions workflow

### Environment Configuration
- `../env.example` - Environment variables template
- `../env.production` - Production environment template
- `../env.microservices` - Microservices environment template

## 🚀 Deployment Options

### Option 1: Vercel (Recommended for Production)
```bash
npm run deploy:vercel:prod
```

### Option 2: Docker
```bash
npm run docker:build
```

### Option 3: Manual
```bash
npm run deploy
```

## 📚 Documentation

See the [docs/](../docs/) directory for detailed deployment guides:
- [Vercel Deployment Guide](../docs/VERCEL_DEPLOYMENT_GUIDE.md)
- [Git-Based Deployment](../docs/GIT_VERCEL_DEPLOYMENT.md)
- [Docker Deployment](../docs/DEPLOYMENT_QUICK_START.md)

---

**Last Updated**: $(date)

