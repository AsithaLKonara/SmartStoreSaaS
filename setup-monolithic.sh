#!/bin/bash

echo "🚀 Setting up SmartStore AI Monolithic Architecture..."

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

# Check if Docker is installed
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    print_success "Docker and Docker Compose are installed"
}

# Check if Node.js is installed
check_node() {
    if ! command -v node &> /dev/null; then
        print_warning "Node.js is not installed. This is required for local development."
        print_warning "You can still run the application using Docker."
    else
        NODE_VERSION=$(node --version)
        print_success "Node.js $NODE_VERSION is installed"
    fi
}

# Create necessary directories
create_directories() {
    print_status "Creating necessary directories..."
    
    mkdir -p uploads
    mkdir -p logs
    mkdir -p backups
    
    print_success "Directories created successfully"
}

# Setup environment file
setup_environment() {
    print_status "Setting up environment configuration..."
    
    if [ ! -f .env.local ]; then
        cp env.monolithic .env.local
        print_success "Environment file created from template"
        print_warning "Please edit .env.local with your actual configuration values"
    else
        print_warning "Environment file already exists. Skipping..."
    fi
}

# Install dependencies (if Node.js is available)
install_dependencies() {
    if command -v npm &> /dev/null; then
        print_status "Installing Node.js dependencies..."
        npm install
        print_success "Dependencies installed successfully"
    else
        print_warning "npm not available. Dependencies will be installed in Docker container."
    fi
}

# Setup database
setup_database() {
    print_status "Setting up database..."
    
    if command -v npx &> /dev/null; then
        print_status "Generating Prisma client..."
        npx prisma generate
        
        print_status "Pushing database schema..."
        npx prisma db push
        
        print_success "Database setup completed"
    else
        print_warning "npx not available. Database setup will be done in Docker container."
    fi
}

# Build and start services
start_services() {
    print_status "Building and starting monolithic application..."
    
    # Stop any existing containers
    docker-compose down 2>/dev/null
    docker-compose -f docker-compose.microservices.yml down 2>/dev/null
    
    # Build and start monolithic application
    docker-compose -f docker-compose.monolithic.yml build --no-cache
    
    if [ $? -eq 0 ]; then
        print_success "Application built successfully"
        
        print_status "Starting services..."
        docker-compose -f docker-compose.monolithic.yml up -d
        
        if [ $? -eq 0 ]; then
            print_success "Services started successfully"
        else
            print_error "Failed to start services"
            exit 1
        fi
    else
        print_error "Failed to build application"
        exit 1
    fi
}

# Wait for services to be ready
wait_for_services() {
    print_status "Waiting for services to be ready..."
    
    # Wait for MongoDB
    print_status "Waiting for MongoDB..."
    until docker exec smartstore-mongodb mongosh --eval "db.adminCommand('ping')" >/dev/null 2>&1; do
        sleep 2
    done
    print_success "MongoDB is ready"
    
    # Wait for Redis
    print_status "Waiting for Redis..."
    until docker exec smartstore-redis redis-cli ping >/dev/null 2>&1; do
        sleep 2
    done
    print_success "Redis is ready"
    
    # Wait for main application
    print_status "Waiting for main application..."
    until curl -f http://localhost:3000/api/health >/dev/null 2>&1; do
        sleep 5
    done
    print_success "Main application is ready"
}

# Check service health
check_health() {
    print_status "Checking service health..."
    
    # Check main app
    if curl -f http://localhost:3000/api/health >/dev/null 2>&1; then
        print_success "Main application is healthy"
    else
        print_error "Main application health check failed"
    fi
    
    # Check MongoDB
    if docker exec smartstore-mongodb mongosh --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
        print_success "MongoDB is healthy"
    else
        print_error "MongoDB health check failed"
    fi
    
    # Check Redis
    if docker exec smartstore-redis redis-cli ping >/dev/null 2>&1; then
        print_success "Redis is healthy"
    else
        print_error "Redis health check failed"
    fi
}

# Display final information
display_info() {
    echo ""
    echo "🎉 SmartStore AI Monolithic Setup Complete!"
    echo ""
    echo "📋 Service Information:"
    echo "   • Main Application: http://localhost:3000"
    echo "   • MongoDB: localhost:27017"
    echo "   • Redis: localhost:6379"
    echo "   • MongoDB Express: http://localhost:8081"
    echo "   • MQTT Broker: localhost:1883"
    echo ""
    echo "🔧 Management Commands:"
    echo "   • View logs: docker-compose -f docker-compose.monolithic.yml logs -f"
    echo "   • Stop services: docker-compose -f docker-compose.monolithic.yml down"
    echo "   • Restart services: docker-compose -f docker-compose.monolithic.yml restart"
    echo "   • View containers: docker ps"
    echo ""
    echo "📚 Next Steps:"
    echo "   1. Open http://localhost:3000 in your browser"
    echo "   2. Complete the initial setup wizard"
    echo "   3. Configure your environment variables in .env.local"
    echo "   4. Set up your payment gateways and external services"
    echo ""
    echo "🚀 Your monolithic SmartStore AI is ready to use!"
}

# Main execution
main() {
    echo "🏗️  SmartStore AI Monolithic Migration"
    echo "======================================"
    echo ""
    
    check_docker
    check_node
    create_directories
    setup_environment
    install_dependencies
    setup_database
    start_services
    wait_for_services
    check_health
    display_info
}

# Run main function
main "$@"

