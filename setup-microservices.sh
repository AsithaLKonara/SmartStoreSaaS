#!/bin/bash

echo "🚀 Setting up SmartStore AI Microservices..."

# Create basic package.json for remaining services
create_service() {
    local service_name=$1
    local port=$2
    
    echo "📦 Setting up $service_name..."
    
    # Create package.json
    cat > "services/$service_name/package.json" << EOF
{
  "name": "smartstore-$service_name",
  "version": "1.0.0",
  "description": "$service_name for SmartStore AI",
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "test": "jest",
    "build": "echo 'No build step required'"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.0.0",
    "compression": "^1.7.4",
    "morgan": "^1.10.0",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "nodemon": "^3.0.1",
    "jest": "^29.6.1"
  },
  "keywords": ["$service_name", "microservices", "smartstore"],
  "author": "SmartStore AI Team",
  "license": "MIT"
}
EOF

    # Create basic server.js
    mkdir -p "services/$service_name/src"
    cat > "services/$service_name/src/server.js" << EOF
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || $port;

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(morgan('combined'));
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: '$service_name',
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.json({
    message: '$service_name service is running',
    port: PORT
  });
});

app.listen(PORT, () => {
  console.log(\`🚀 $service_name running on port \${PORT}\`);
});

module.exports = app;
EOF

    # Create Dockerfile
    cat > "services/$service_name/Dockerfile" << EOF
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
RUN chown -R nextjs:nodejs /app
USER nextjs
EXPOSE $port
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD curl -f http://localhost:$port/health || exit 1
CMD ["npm", "start"]
EOF

    # Install dependencies
    cd "services/$service_name"
    npm install --silent
    cd ../..
    
    echo "✅ $service_name setup complete!"
}

# Set up remaining services
create_service "notification-service" 3006
create_service "analytics-service" 3007
create_service "ai-ml-service" 3008
create_service "search-service" 3009
create_service "file-service" 3010
create_service "blockchain-service" 3011
create_service "iot-service" 3012

echo "🎉 All microservices setup complete!"
echo "📋 Next steps:"
echo "   1. Build Docker images: docker-compose -f docker-compose.microservices.yml build"
echo "   2. Start services: docker-compose -f docker-compose.microservices.yml up -d" 