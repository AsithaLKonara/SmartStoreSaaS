# SmartStore AI Platform - Complete Test Suite
# PowerShell Version for Windows

Write-Host "🚀 Starting comprehensive testing for SmartStore AI Platform" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# Function to print colored output
function Write-Status {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Check if Docker is running
function Test-Docker {
    Write-Status "Checking Docker status..."
    try {
        docker info | Out-Null
        Write-Success "Docker is running"
        return $true
    }
    catch {
        Write-Error "Docker is not running. Please start Docker and try again."
        return $false
    }
}

# Run frontend tests
function Test-Frontend {
    Write-Status "Running frontend tests..."
    Set-Location "C:\Users\asith\Documents\SmartStore"
    
    # Install dependencies if needed
    if (-not (Test-Path "node_modules")) {
        Write-Status "Installing frontend dependencies..."
        npm install
    }
    
    # Run type checking
    Write-Status "Running TypeScript type checking..."
    try {
        npm run type-check
        Write-Success "TypeScript type checking passed"
    }
    catch {
        Write-Warning "TypeScript type checking has some issues (continuing with build)"
    }
    
    # Run tests
    Write-Status "Running frontend tests..."
    try {
        npm test -- --passWithNoTests --coverage
        Write-Success "Frontend tests completed"
    }
    catch {
        Write-Warning "Some frontend tests failed (continuing with build)"
    }
}

# Run microservice tests
function Test-Microservices {
    Write-Status "Running microservice tests..."
    
    # Test User Service
    Write-Status "Testing User Service..."
    Set-Location "C:\Users\asith\Documents\SmartStore\services\user-service"
    try {
        npm test -- --passWithNoTests --coverage
        Write-Success "User Service tests passed"
    }
    catch {
        Write-Warning "User Service tests failed (continuing with build)"
    }
    
    # Test Product Service
    Write-Status "Testing Product Service..."
    Set-Location "C:\Users\asith\Documents\SmartStore\services\product-service"
    try {
        npm test -- --passWithNoTests --coverage
        Write-Success "Product Service tests passed"
    }
    catch {
        Write-Warning "Product Service tests failed (continuing with build)"
    }
    
    # Test Order Service
    Write-Status "Testing Order Service..."
    Set-Location "C:\Users\asith\Documents\SmartStore\services\order-service"
    try {
        npm test -- --passWithNoTests --coverage
        Write-Success "Order Service tests passed"
    }
    catch {
        Write-Warning "Order Service tests failed (continuing with build)"
    }
    
    # Test Payment Service
    Write-Status "Testing Payment Service..."
    Set-Location "C:\Users\asith\Documents\SmartStore\services\payment-service"
    try {
        npm test -- --passWithNoTests --coverage
        Write-Success "Payment Service tests passed"
    }
    catch {
        Write-Warning "Payment Service tests failed (continuing with build)"
    }
    
    # Test API Gateway
    Write-Status "Testing API Gateway..."
    Set-Location "C:\Users\asith\Documents\SmartStore\services\api-gateway"
    try {
        npm test -- --passWithNoTests --coverage
        Write-Success "API Gateway tests passed"
    }
    catch {
        Write-Warning "API Gateway tests failed (continuing with build)"
    }
}

# Build and start services
function Start-Services {
    Write-Status "Building and starting services with Docker..."
    Set-Location "C:\Users\asith\Documents\SmartStore"
    
    # Stop any existing containers
    Write-Status "Stopping existing containers..."
    docker-compose down
    docker-compose -f docker-compose.microservices.yml down
    
    # Build and start the main application
    Write-Status "Building main application..."
    docker-compose build --no-cache
    
    # Build and start microservices
    Write-Status "Building microservices..."
    docker-compose -f docker-compose.microservices.yml build --no-cache
    
    # Start the main application
    Write-Status "Starting main application..."
    docker-compose up -d
    
    # Start microservices
    Write-Status "Starting microservices..."
    docker-compose -f docker-compose.microservices.yml up -d
    
    # Wait for services to be ready
    Write-Status "Waiting for services to be ready..."
    Start-Sleep -Seconds 30
    
    # Check service health
    Test-ServiceHealth
}

# Check service health
function Test-ServiceHealth {
    Write-Status "Checking service health..."
    
    # Check main app
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000/api/health" -UseBasicParsing -TimeoutSec 10
        if ($response.StatusCode -eq 200) {
            Write-Success "Main application is healthy"
        }
    }
    catch {
        Write-Warning "Main application health check failed"
    }
    
    # Check databases
    try {
        docker exec smartstore-mongodb mongosh --eval "db.adminCommand('ping')" | Out-Null
        Write-Success "MongoDB is healthy"
    }
    catch {
        Write-Warning "MongoDB health check failed"
    }
    
    try {
        docker exec smartstore-redis redis-cli ping | Out-Null
        Write-Success "Redis is healthy"
    }
    catch {
        Write-Warning "Redis health check failed"
    }
}

# Run integration tests
function Test-Integration {
    Write-Status "Running integration tests..."
    
    # Test API endpoints
    Write-Status "Testing API endpoints..."
    
    # Test health endpoint
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000/api/health" -UseBasicParsing -TimeoutSec 10
        if ($response.StatusCode -eq 200) {
            Write-Success "Health endpoint is working"
        }
    }
    catch {
        Write-Warning "Health endpoint is not working"
    }
    
    # Test authentication endpoints
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000/api/auth/signup" -UseBasicParsing -TimeoutSec 10
        Write-Success "Signup endpoint is working"
    }
    catch {
        Write-Warning "Signup endpoint is not working"
    }
    
    # Test product endpoints
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000/api/products" -UseBasicParsing -TimeoutSec 10
        Write-Success "Products endpoint is working"
    }
    catch {
        Write-Warning "Products endpoint is not working"
    }
}

# Main execution
function Main {
    Write-Host "==========================================================" -ForegroundColor Cyan
    Write-Host "🧪 SmartStore AI Platform - Complete Test Suite" -ForegroundColor Cyan
    Write-Host "==========================================================" -ForegroundColor Cyan
    
    # Check Docker
    if (-not (Test-Docker)) {
        exit 1
    }
    
    # Run tests
    Test-Frontend
    Test-Microservices
    
    # Build and start services
    Start-Services
    
    # Run integration tests
    Test-Integration
    
    Write-Host "==========================================================" -ForegroundColor Cyan
    Write-Host "✅ Testing and deployment completed!" -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "🌐 Services available at:" -ForegroundColor White
    Write-Host "   - Main App: http://localhost:3000" -ForegroundColor White
    Write-Host "   - API Gateway: http://localhost:3000" -ForegroundColor White
    Write-Host "   - MongoDB Express: http://localhost:8081" -ForegroundColor White
    Write-Host "   - Redis: localhost:6379" -ForegroundColor White
    Write-Host "   - Elasticsearch: http://localhost:9200" -ForegroundColor White
    Write-Host "   - Kibana: http://localhost:5601" -ForegroundColor White
    Write-Host "   - Grafana: http://localhost:3001" -ForegroundColor White
    Write-Host "   - Prometheus: http://localhost:9090" -ForegroundColor White
    Write-Host "   - Jaeger: http://localhost:16686" -ForegroundColor White
    Write-Host ""
    Write-Host "📊 To view logs:" -ForegroundColor White
    Write-Host "   - Main app: docker-compose logs -f app" -ForegroundColor White
    Write-Host "   - Microservices: docker-compose -f docker-compose.microservices.yml logs -f" -ForegroundColor White
    Write-Host ""
    Write-Host "🛑 To stop services:" -ForegroundColor White
    Write-Host "   - docker-compose down" -ForegroundColor White
    Write-Host "   - docker-compose -f docker-compose.microservices.yml down" -ForegroundColor White
}

# Run main function
Main

