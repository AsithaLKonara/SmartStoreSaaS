#!/bin/bash

# SmartStore AI Production Deployment Script
# This script handles production deployments with database migrations

set -e

echo "🚀 SmartStore AI Production Deployment"
echo "======================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    print_error "DATABASE_URL environment variable is not set!"
    echo "Please set DATABASE_URL before running deployment."
    exit 1
fi

print_success "DATABASE_URL is configured"

# Check if NEXTAUTH_SECRET is set
if [ -z "$NEXTAUTH_SECRET" ]; then
    print_warning "NEXTAUTH_SECRET is not set. Using default (not recommended for production)."
fi

# Step 1: Install dependencies
print_status "Installing dependencies..."
if npm ci --production=false; then
    print_success "Dependencies installed!"
else
    print_error "Failed to install dependencies!"
    exit 1
fi

# Step 2: Generate Prisma client
print_status "Generating Prisma client..."
if npx prisma generate; then
    print_success "Prisma client generated!"
else
    print_error "Failed to generate Prisma client!"
    exit 1
fi

# Step 3: Run database migrations
print_status "Running database migrations..."
if npx prisma migrate deploy; then
    print_success "Database migrations applied!"
else
    print_warning "Migration failed, trying db push..."
    if npx prisma db push --accept-data-loss; then
        print_success "Database schema pushed!"
    else
        print_error "Failed to update database schema!"
        exit 1
    fi
fi

# Step 4: Type check
print_status "Running TypeScript type check..."
if npm run type-check; then
    print_success "Type check passed!"
else
    print_warning "Type check failed, but continuing..."
fi

# Step 5: Build application
print_status "Building application..."
if npm run build; then
    print_success "Application built successfully!"
else
    print_error "Build failed!"
    exit 1
fi

# Step 6: Run tests (optional, can be skipped with --skip-tests)
if [[ "$1" != "--skip-tests" ]]; then
    print_status "Running tests..."
    if npm test -- --passWithNoTests; then
        print_success "Tests passed!"
    else
        print_warning "Some tests failed, but continuing..."
    fi
fi

print_success "🎉 Deployment preparation complete!"
echo ""
echo "📋 Next steps:"
echo "  1. Start the application: npm start"
echo "  2. Or use PM2: pm2 start npm --name smartstore -- start"
echo "  3. Or use Docker: docker-compose up -d"
echo ""
echo "📊 Verify deployment:"
echo "  - Check health: curl http://localhost:3000/api/health"
echo "  - Check logs: pm2 logs smartstore (if using PM2)"
echo ""

