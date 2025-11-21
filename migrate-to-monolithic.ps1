# SmartStore AI: Microservices to Monolithic Migration Script (PowerShell)
# This script migrates SmartStore AI from microservices to monolithic architecture

param(
    [switch]$Quick,
    [switch]$Rollback,
    [switch]$Help
)

# Colors for output
$Red = "Red"
$Green = "Green"
$Yellow = "Yellow"
$Blue = "Blue"
$White = "White"

# Function to print colored output
function Write-Status {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor $Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor $Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor $Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor $Red
}

# Show help
if ($Help) {
    Write-Host @"
SmartStore AI: Microservices to Monolithic Migration Script

Usage:
    .\migrate-to-monolithic.ps1 [-Quick] [-Rollback] [-Help]

Parameters:
    -Quick      Quick migration (recommended for first-time users)
    -Rollback   Rollback to microservices architecture
    -Help       Show this help message

Examples:
    .\migrate-to-monolithic.ps1 -Quick
    .\migrate-to-monolithic.ps1 -Rollback
    .\migrate-to-monolithic.ps1

"@ -ForegroundColor $White
    exit 0
}

# Check if Docker is running
function Test-Docker {
    try {
        docker version | Out-Null
        Write-Success "Docker is running"
        return $true
    }
    catch {
        Write-Error "Docker is not running. Please start Docker Desktop first."
        return $false
    }
}

# Check if Docker Compose is available
function Test-DockerCompose {
    try {
        docker-compose --version | Out-Null
        Write-Success "Docker Compose is available"
        return $true
    }
    catch {
        Write-Error "Docker Compose is not available. Please install Docker Compose."
        return $false
    }
}

# Stop all services
function Stop-AllServices {
    Write-Status "Stopping all services..."
    
    # Stop microservices
    try {
        docker-compose -f docker-compose.microservices.yml down 2>$null
        Write-Success "Microservices stopped"
    }
    catch {
        Write-Warning "No microservices running or error stopping them"
    }
    
    # Stop simple setup
    try {
        docker-compose down 2>$null
        Write-Success "Simple setup stopped"
    }
    catch {
        Write-Warning "No simple setup running or error stopping it"
    }
    
    # Stop monolithic
    try {
        docker-compose -f docker-compose.monolithic.yml down 2>$null
        Write-Success "Monolithic setup stopped"
    }
    catch {
        Write-Warning "No monolithic setup running or error stopping it"
    }
}

# Setup environment file
function Initialize-Environment {
    Write-Status "Setting up environment configuration..."
    
    if (!(Test-Path ".env.local")) {
        if (Test-Path "env.monolithic") {
            Copy-Item "env.monolithic" ".env.local"
            Write-Success "Environment file created from template"
            Write-Warning "Please edit .env.local with your actual configuration values"
        }
        else {
            Write-Error "env.monolithic template not found"
            return $false
        }
    }
    else {
        Write-Warning "Environment file already exists. Skipping..."
    }
    
    return $true
}

# Create necessary directories
function New-Directories {
    Write-Status "Creating necessary directories..."
    
    $directories = @("uploads", "logs", "backups")
    
    foreach ($dir in $directories) {
        if (!(Test-Path $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
            Write-Success "Created directory: $dir"
        }
        else {
            Write-Status "Directory already exists: $dir"
        }
    }
}

# Start monolithic services
function Start-Monolithic {
    Write-Status "Starting monolithic application..."
    
    # Build and start
    try {
        docker-compose build --no-cache
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Application built successfully"
            
            docker-compose up -d
            
            if ($LASTEXITCODE -eq 0) {
                Write-Success "Services started successfully"
                return $true
            }
            else {
                Write-Error "Failed to start services"
                return $false
            }
        }
        else {
            Write-Error "Failed to build application"
            return $false
        }
    }
    catch {
        Write-Error "Error during build/start: $_"
        return $false
    }
}

# Wait for services to be ready
function Wait-ForServices {
    Write-Status "Waiting for services to be ready..."
    
    # Wait for MongoDB
    Write-Status "Waiting for MongoDB..."
    $maxAttempts = 30
    $attempt = 0
    
    do {
        Start-Sleep -Seconds 2
        $attempt++
        
        try {
            docker exec smartstore-mongodb mongosh --eval "db.adminCommand('ping')" 2>$null | Out-Null
            if ($LASTEXITCODE -eq 0) {
                Write-Success "MongoDB is ready"
                break
            }
        }
        catch {
            # Continue waiting
        }
        
        if ($attempt -ge $maxAttempts) {
            Write-Warning "MongoDB took too long to start. Continuing..."
            break
        }
    } while ($true)
    
    # Wait for Redis
    Write-Status "Waiting for Redis..."
    $attempt = 0
    
    do {
        Start-Sleep -Seconds 2
        $attempt++
        
        try {
            docker exec smartstore-redis redis-cli ping 2>$null | Out-Null
            if ($LASTEXITCODE -eq 0) {
                Write-Success "Redis is ready"
                break
            }
        }
        catch {
            # Continue waiting
        }
        
        if ($attempt -ge $maxAttempts) {
            Write-Warning "Redis took too long to start. Continuing..."
            break
        }
    } while ($true)
    
    # Wait for main application
    Write-Status "Waiting for main application..."
    $attempt = 0
    
    do {
        Start-Sleep -Seconds 5
        $attempt++
        
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:3000/api/health" -UseBasicParsing -TimeoutSec 10 -ErrorAction SilentlyContinue
            if ($response.StatusCode -eq 200) {
                Write-Success "Main application is ready"
                break
            }
        }
        catch {
            # Continue waiting
        }
        
        if ($attempt -ge 24) { # 2 minutes total
            Write-Warning "Main application took too long to start. Continuing..."
            break
        }
    } while ($true)
}

# Check service health
function Test-ServiceHealth {
    Write-Status "Checking service health..."
    
    $healthy = $true
    
    # Check main app
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000/api/health" -UseBasicParsing -TimeoutSec 10
        if ($response.StatusCode -eq 200) {
            Write-Success "Main application is healthy"
        }
        else {
            Write-Error "Main application health check failed"
            $healthy = $false
        }
    }
    catch {
        Write-Error "Main application health check failed: $_"
        $healthy = $false
    }
    
    # Check MongoDB
    try {
        docker exec smartstore-mongodb mongosh --eval "db.adminCommand('ping')" 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Success "MongoDB is healthy"
        }
        else {
            Write-Error "MongoDB health check failed"
            $healthy = $false
        }
    }
    catch {
        Write-Error "MongoDB health check failed: $_"
        $healthy = $false
    }
    
    # Check Redis
    try {
        docker exec smartstore-redis redis-cli ping 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Redis is healthy"
        }
        else {
            Write-Error "Redis health check failed"
            $healthy = $false
        }
    }
    catch {
        Write-Error "Redis health check failed: $_"
        $healthy = $false
    }
    
    return $healthy
}

# Rollback to microservices
function Restore-Microservices {
    Write-Status "Rolling back to microservices architecture..."
    
    # Stop monolithic
    try {
        docker-compose down
        Write-Success "Monolithic services stopped"
    }
    catch {
        Write-Warning "Error stopping monolithic services"
    }
    
    # Start microservices
    try {
        Write-Warning "Microservices files have been removed. Cannot rollback."
        return $false
        
        Write-Warning "Rollback not available - microservices files removed"
        return $false
    }
    catch {
        Write-Error "Error during rollback: $_"
        return $false
    }
}

# Display final information
function Show-FinalInfo {
    Write-Host ""
    Write-Host "🎉 SmartStore AI Monolithic Migration Complete!" -ForegroundColor $Green
    Write-Host ""
    Write-Host "📋 Service Information:" -ForegroundColor $White
    Write-Host "   • Main Application: http://localhost:3000" -ForegroundColor $White
    Write-Host "   • MongoDB: localhost:27017" -ForegroundColor $White
    Write-Host "   • Redis: localhost:6379" -ForegroundColor $White
    Write-Host "   • MongoDB Express: http://localhost:8081" -ForegroundColor $White
    Write-Host "   • MQTT Broker: localhost:1883" -ForegroundColor $White
    Write-Host ""
    Write-Host "🔧 Management Commands:" -ForegroundColor $White
    Write-Host "   • View logs: docker-compose logs -f" -ForegroundColor $White
    Write-Host "   • Stop services: docker-compose down" -ForegroundColor $White
    Write-Host "   • Restart services: docker-compose restart" -ForegroundColor $White
    Write-Host "   • View containers: docker ps" -ForegroundColor $White
    Write-Host ""
    Write-Host "📚 Next Steps:" -ForegroundColor $White
    Write-Host "   1. Open http://localhost:3000 in your browser" -ForegroundColor $White
    Write-Host "   2. Complete the initial setup wizard" -ForegroundColor $White
    Write-Host "   3. Configure your environment variables in .env.local" -ForegroundColor $White
    Write-Host "   • Set up your payment gateways and external services" -ForegroundColor $White
    Write-Host ""
    Write-Host "🚀 Your monolithic SmartStore AI is ready to use!" -ForegroundColor $Green
}

# Main execution
function Main {
    Write-Host "🏗️  SmartStore AI Monolithic Migration" -ForegroundColor $Blue
    Write-Host "======================================" -ForegroundColor $Blue
    Write-Host ""
    
    # Check prerequisites
    if (!(Test-Docker)) { exit 1 }
    if (!(Test-DockerCompose)) { exit 1 }
    
    # Handle rollback
    if ($Rollback) {
        if (Restore-Microservices) {
            Write-Success "Rollback completed successfully"
        }
        else {
            Write-Error "Rollback failed"
            exit 1
        }
        return
    }
    
    # Setup migration
    Stop-AllServices
    if (!(Initialize-Environment)) { exit 1 }
    New-Directories
    
    # Start monolithic
    if (Start-Monolithic) {
        Wait-ForServices
        
        if (Test-ServiceHealth) {
            Show-FinalInfo
        }
        else {
            Write-Warning "Some services may not be fully healthy. Check logs for details."
            Show-FinalInfo
        }
    }
    else {
        Write-Error "Migration failed"
        exit 1
    }
}

# Run main function
Main
