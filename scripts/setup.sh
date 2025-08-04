#!/bin/bash

# SmartStore AI Setup Script
# This script will help you set up the SmartStore AI platform

set -e

echo "🚀 SmartStore AI Setup Script"
echo "=============================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ npm version: $(npm -v)"

# Check if Docker is installed (optional)
if command -v docker &> /dev/null; then
    echo "✅ Docker is installed"
    DOCKER_AVAILABLE=true
else
    echo "⚠️  Docker is not installed (optional for local development)"
    DOCKER_AVAILABLE=false
fi

# Check if PostgreSQL is installed
if command -v psql &> /dev/null; then
    echo "✅ PostgreSQL is installed"
    PSQL_AVAILABLE=true
else
    echo "⚠️  PostgreSQL is not installed locally"
    PSQL_AVAILABLE=false
fi

echo ""
echo "📦 Installing dependencies..."
npm install

echo ""
echo "🔧 Setting up environment variables..."

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "📝 Creating .env.local file..."
    cp env.example .env.local
    echo "✅ Created .env.local file"
    echo "⚠️  Please edit .env.local with your configuration before continuing"
    echo ""
    echo "Required environment variables:"
    echo "  - DATABASE_URL: Your PostgreSQL connection string"
    echo "  - NEXTAUTH_SECRET: A random string for session encryption"
    echo "  - NEXTAUTH_URL: Your application URL (http://localhost:3000 for development)"
    echo ""
    echo "Optional but recommended:"
    echo "  - GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET: For Google OAuth"
    echo "  - STRIPE_PUBLISHABLE_KEY & STRIPE_SECRET_KEY: For payments"
    echo "  - TWILIO_ACCOUNT_SID & TWILIO_AUTH_TOKEN: For WhatsApp integration"
    echo ""
    read -p "Press Enter after you've configured .env.local..."
else
    echo "✅ .env.local already exists"
fi

echo ""
echo "🗄️  Setting up database..."

# Generate Prisma client
echo "📦 Generating Prisma client..."
npx prisma generate

# Push database schema
echo "🗄️  Pushing database schema..."
npx prisma db push

# Seed database
echo "🌱 Seeding database with demo data..."
npx prisma db seed

echo ""
echo "🎉 Setup completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Start the development server: npm run dev"
echo "2. Open http://localhost:3000 in your browser"
echo "3. Sign in with the demo account:"
echo "   Email: admin@smartstore.ai"
echo "   Password: password123"
echo ""
echo "🔧 Available commands:"
echo "  npm run dev          - Start development server"
echo "  npm run build        - Build for production"
echo "  npm run start        - Start production server"
echo "  npm run db:studio    - Open Prisma Studio"
echo "  npm run db:migrate   - Run database migrations"
echo "  npm run db:seed      - Seed database with demo data"
echo ""
echo "🐳 Docker (optional):"
if [ "$DOCKER_AVAILABLE" = true ]; then
    echo "  docker-compose up -d  - Start all services with Docker"
    echo "  docker-compose down   - Stop all services"
else
    echo "  Install Docker to use docker-compose for easy deployment"
fi
echo ""
echo "📚 Documentation:"
echo "  - README.md: Project overview and setup instructions"
echo "  - env.example: Environment variables reference"
echo "  - prisma/schema.prisma: Database schema"
echo ""
echo "🚀 Happy coding!" 