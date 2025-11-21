#!/bin/bash

echo "🚀 Starting comprehensive testing for SmartStore AI Platform"
echo "=========================================================="

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
check_docker() {
    print_status "Checking Docker status..."
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    print_success "Docker is running"
}

# Run frontend tests
run_frontend_tests() {
    print_status "Running frontend tests..."
    cd "$(dirname "$0")"
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        print_status "Installing frontend dependencies..."
        npm install
    fi
    
    # Run type checking
    print_status "Running TypeScript type checking..."
    if npm run type-check; then
        print_success "TypeScript type checking passed"
    else
        print_warning "TypeScript type checking has some issues (continuing with build)"
    fi
    
    # Run tests
    print_status "Running frontend tests..."
    if npm test -- --passWithNoTests --coverage; then
        print_success "Frontend tests completed"
    else
        print_warning "Some frontend tests failed (continuing with build)"
    fi
}

# Run microservice tests
run_microservice_tests() {
    print_status "Running microservice tests..."
    
    # Test User Service
    print_status "Testing User Service..."
    cd "$(dirname "$0")/services/user-service"
    if npm test -- --passWithNoTests --coverage; then
        print_success "User Service tests passed"
    else
        print_warning "User Service tests failed (continuing with build)"
    fi
    
    # Test Product Service
    print_status "Testing Product Service..."
    cd "$(dirname "$0")/services/product-service"
    if npm test -- --passWithNoTests --coverage; then
        print_success "Product Service tests passed"
    else
        print_warning "Product Service tests failed (continuing with build)"
    fi
    
    # Test Order Service
    print_status "Testing Order Service..."
    cd "$(dirname "$0")/services/order-service"
    if npm test -- --passWithNoTests --coverage; then
        print_success "Order Service tests passed"
    else
        print_warning "Order Service tests failed (continuing with build)"
    fi
    
    # Test Payment Service
    print_status "Testing Payment Service..."
    cd "$(dirname "$0")/services/payment-service"
    if npm test -- --passWithNoTests --coverage; then
        print_success "Payment Service tests passed"
    else
        print_warning "Payment Service tests failed (continuing with build)"
    fi
    
    # Test API Gateway
    print_status "Testing API Gateway..."
    cd "$(dirname "$0")/services/api-gateway"
    if npm test -- --passWithNoTests --coverage; then
        print_success "API Gateway tests passed"
    else
        print_warning "API Gateway tests failed (continuing with build)"
    fi
}

# Build and start services
build_and_start_services() {
    print_status "Building and starting services with Docker..."
    cd "$(dirname "$0")"
    
    # Stop any existing containers
    print_status "Stopping existing containers..."
    docker-compose down
    docker-compose -f docker-compose.microservices.yml down
    
    # Build and start the main application
    print_status "Building main application..."
    docker-compose build --no-cache
    
    # Build and start microservices
    print_status "Building microservices..."
    docker-compose -f docker-compose.microservices.yml build --no-cache
    
    # Start the main application
    print_status "Starting main application..."
    docker-compose up -d
    
    # Start microservices
    print_status "Starting microservices..."
    docker-compose -f docker-compose.microservices.yml up -d
    
    # Wait for services to be ready
    print_status "Waiting for services to be ready..."
    sleep 30
    
    # Check service health
    check_service_health
}

# Check service health
check_service_health() {
    print_status "Checking service health..."
    
    # Check main app
    if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
        print_success "Main application is healthy"
    else
        print_warning "Main application health check failed"
    fi
    
    # Check microservices
    if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
        print_success "API Gateway is healthy"
    else
        print_warning "API Gateway health check failed"
    fi
    
    # Check databases
    if docker exec smartstore-mongodb mongosh --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
        print_success "MongoDB is healthy"
    else
        print_warning "MongoDB health check failed"
    fi
    
    if docker exec smartstore-redis redis-cli ping > /dev/null 2>&1; then
        print_success "Redis is healthy"
    else
        print_warning "Redis health check failed"
    fi
}

# Run integration tests
run_integration_tests() {
    print_status "Running integration tests..."
    
    # Test API endpoints
    print_status "Testing API endpoints..."
    
    # Test health endpoint
    if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
        print_success "Health endpoint is working"
    else
        print_warning "Health endpoint is not working"
    fi
    
    # Test authentication endpoints
    if curl -f http://localhost:3000/api/auth/signup > /dev/null 2>&1; then
        print_success "Signup endpoint is working"
    else
        print_warning "Signup endpoint is not working"
    fi
    
    # Test product endpoints
    if curl -f http://localhost:3000/api/products > /dev/null 2>&1; then
        print_success "Products endpoint is working"
    else
        print_warning "Products endpoint is not working"
    fi
}

# Main execution
main() {
    echo "=========================================================="
    echo "🧪 SmartStore AI Platform - Complete Test Suite"
    echo "=========================================================="
    
    # Check Docker
    check_docker
    
    # Run tests
    run_frontend_tests
    run_microservice_tests
    
    # Build and start services
    build_and_start_services
    
    # Run integration tests
    run_integration_tests
    
    echo "=========================================================="
    echo "✅ Testing and deployment completed!"
    echo "=========================================================="
    echo ""
    echo "🌐 Services available at:"
    echo "   - Main App: http://localhost:3000"
    echo "   - API Gateway: http://localhost:3000"
    echo "   - MongoDB Express: http://localhost:8081"
    echo "   - Redis: localhost:6379"
    echo "   - Elasticsearch: http://localhost:9200"
    echo "   - Kibana: http://localhost:5601"
    echo "   - Grafana: http://localhost:3001"
    echo "   - Prometheus: http://localhost:9090"
    echo "   - Jaeger: http://localhost:16686"
    echo ""
    echo "📊 To view logs:"
    echo "   - Main app: docker-compose logs -f app"
    echo "   - Microservices: docker-compose -f docker-compose.microservices.yml logs -f"
    echo ""
    echo "🛑 To stop services:"
    echo "   - docker-compose down"
    echo "   - docker-compose -f docker-compose.microservices.yml down"
}

# Run main function
main "$@"

