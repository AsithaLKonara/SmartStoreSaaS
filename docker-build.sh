#!/bin/bash

# SmartStore AI Docker Build Script
set -e

echo "🚀 Building SmartStore AI with Docker..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    print_error "docker-compose is not installed. Please install docker-compose and try again."
    exit 1
fi

print_status "Checking environment configuration..."

# Create .env file from template if it doesn't exist
if [ ! -f .env ]; then
    if [ -f env.production ]; then
        print_warning ".env file not found. Copying from env.production..."
        cp env.production .env
    elif [ -f env.example ]; then
        print_warning ".env file not found. Copying from env.example..."
        cp env.example .env
        print_warning "Please update .env file with your actual configuration values."
    else
        print_error "No environment configuration found. Please create .env file."
        exit 1
    fi
fi

print_success "Environment configuration ready!"

# Clean up previous builds
print_status "Cleaning up previous builds..."
docker-compose down --remove-orphans 2>/dev/null || true
docker system prune -f --volumes 2>/dev/null || true

print_success "Cleanup completed!"

# Build the application
print_status "Building Docker images..."
if docker-compose build --no-cache; then
    print_success "Docker images built successfully!"
else
    print_error "Failed to build Docker images!"
    exit 1
fi

# Start the services
print_status "Starting services..."
if docker-compose up -d; then
    print_success "Services started successfully!"
else
    print_error "Failed to start services!"
    exit 1
fi

# Wait for services to be ready
print_status "Waiting for services to be ready..."
sleep 30

# Check service health
print_status "Checking service health..."

# Check MongoDB
if docker-compose exec -T mongodb mongosh --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
    print_success "MongoDB is healthy!"
else
    print_warning "MongoDB might not be ready yet. This is normal on first startup."
fi

# Check Redis
if docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; then
    print_success "Redis is healthy!"
else
    print_warning "Redis might not be ready yet."
fi

# Check main application
if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
    print_success "Application is healthy!"
else
    print_warning "Application might still be starting up."
fi

print_success "🎉 SmartStore AI is now running!"
echo ""
echo "📋 Service URLs:"
echo "   • Main Application: http://localhost:3000"
echo "   • MongoDB Admin: http://localhost:8081"
echo "   • Database: mongodb://localhost:27017"
echo "   • Redis: redis://localhost:6379"
echo ""
echo "🔧 Useful commands:"
echo "   • View logs: docker-compose logs -f"
echo "   • Stop services: docker-compose down"
echo "   • Restart: docker-compose restart"
echo "   • Shell access: docker-compose exec app sh"
echo ""
echo "📖 Check the logs if any service is not working:"
echo "   docker-compose logs app"
