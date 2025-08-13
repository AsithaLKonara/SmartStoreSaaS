const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const compression = require('compression');
const morgan = require('morgan');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Service Registry
const services = {
  user: process.env.USER_SERVICE_URL || 'http://user-service:3001',
  product: process.env.PRODUCT_SERVICE_URL || 'http://product-service:3002',
  order: process.env.ORDER_SERVICE_URL || 'http://order-service:3003',
  payment: process.env.PAYMENT_SERVICE_URL || 'http://payment-service:3004',
  inventory: process.env.INVENTORY_SERVICE_URL || 'http://inventory-service:3005',
  notification: process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:3006',
  analytics: process.env.ANALYTICS_SERVICE_URL || 'http://analytics-service:3007',
  ai: process.env.AI_SERVICE_URL || 'http://ai-ml-service:3008',
  search: process.env.SEARCH_SERVICE_URL || 'http://search-service:3009',
  file: process.env.FILE_SERVICE_URL || 'http://file-service:3010',
  blockchain: process.env.BLOCKCHAIN_SERVICE_URL || 'http://blockchain-service:3011',
  iot: process.env.IOT_SERVICE_URL || 'http://iot-service:3012'
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
    services: Object.keys(services)
  });
});

// Service discovery endpoint
app.get('/services', (req, res) => {
  res.json({
    services: services,
    timestamp: new Date().toISOString()
  });
});

// Proxy middleware for each service
Object.entries(services).forEach(([serviceName, serviceUrl]) => {
  app.use(`/api/${serviceName}`, createProxyMiddleware({
    target: serviceUrl,
    changeOrigin: true,
    pathRewrite: {
      [`^/api/${serviceName}`]: ''
    },
    onError: (err, req, res) => {
      console.error(`Proxy error for ${serviceName}:`, err.message);
      res.status(502).json({
        error: `Service ${serviceName} unavailable`,
        message: err.message
      });
    }
  }));
});

// Default route
app.get('/', (req, res) => {
  res.json({
    message: 'SmartStore AI API Gateway',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: [
      '/health',
      '/services',
      '/api/user/*',
      '/api/product/*',
      '/api/order/*',
      '/api/payment/*',
      '/api/inventory/*',
      '/api/notification/*',
      '/api/analytics/*',
      '/api/ai/*',
      '/api/search/*',
      '/api/file/*',
      '/api/blockchain/*',
      '/api/iot/*'
    ]
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('API Gateway Error:', err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
  console.log('Available services:', Object.keys(services));
});

module.exports = app; 