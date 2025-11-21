#!/bin/bash

# Vercel Deployment Script for SmartStore AI
# This script prepares and deploys the application to Vercel

set -e

echo "🚀 Vercel Deployment for SmartStore AI"
echo "========================================"
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

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    print_error "Vercel CLI is not installed!"
    echo ""
    echo "Install it with:"
    echo "  npm i -g vercel"
    echo ""
    exit 1
fi

print_success "Vercel CLI is installed"

# Check if logged in to Vercel
if ! vercel whoami &> /dev/null; then
    print_warning "Not logged in to Vercel"
    echo "Logging in..."
    vercel login
fi

print_success "Logged in to Vercel"

# Check required environment variables
print_status "Checking environment variables..."

REQUIRED_VARS=(
    "DATABASE_URL"
    "NEXTAUTH_SECRET"
    "NEXTAUTH_URL"
)

MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
    print_error "Missing required environment variables:"
    for var in "${MISSING_VARS[@]}"; do
        echo "  - $var"
    done
    echo ""
    echo "Set these in Vercel dashboard or use:"
    echo "  vercel env add DATABASE_URL"
    echo "  vercel env add NEXTAUTH_SECRET"
    echo "  vercel env add NEXTAUTH_URL"
    echo ""
    exit 1
fi

print_success "Required environment variables are set"

# Generate Prisma client
print_status "Generating Prisma client..."
if npx prisma generate; then
    print_success "Prisma client generated!"
else
    print_error "Failed to generate Prisma client!"
    exit 1
fi

# Run database migrations (if DATABASE_URL is set locally)
if [ -n "$DATABASE_URL" ]; then
    print_status "Running database migrations..."
    if npx prisma migrate deploy &> /dev/null; then
        print_success "Database migrations applied!"
    elif npx prisma db push &> /dev/null; then
        print_success "Database schema pushed!"
    else
        print_warning "Could not run migrations locally. Will run on Vercel build."
    fi
fi

# Build locally to check for errors
print_status "Building application locally..."
if npm run build; then
    print_success "Build successful!"
else
    print_error "Build failed! Please fix errors before deploying."
    exit 1
fi

# Deploy to Vercel
print_status "Deploying to Vercel..."
echo ""

# Check if --prod flag is provided
if [[ "$1" == "--prod" ]]; then
    print_status "Deploying to PRODUCTION..."
    vercel --prod
else
    print_status "Deploying to PREVIEW (use --prod for production)..."
    vercel
fi

print_success "🎉 Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "  1. Check your Vercel dashboard for deployment status"
echo "  2. Verify environment variables are set correctly"
echo "  3. Run database migrations on production database"
echo "  4. Test the deployed application"
echo ""
echo "🔧 Useful commands:"
echo "  vercel env ls              - List environment variables"
echo "  vercel env add VAR_NAME    - Add environment variable"
echo "  vercel logs                - View deployment logs"
echo "  vercel inspect             - Inspect deployment"
echo ""

