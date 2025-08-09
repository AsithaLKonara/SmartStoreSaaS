const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const redis = require('redis');
const winston = require('winston');
const compression = require('compression');
const morgan = require('morgan');
const promClient = require('prom-client');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Redis client
const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

// Initialize logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

// Initialize Prometheus metrics
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

const httpRequestsTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
});

const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route'],
  registers: [register]
});

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

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "ws:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}));

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
  optionsSuccessStatus: 200
}));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

// Metrics middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path;
    
    httpRequestsTotal.inc({
      method: req.method,
      route,
      status_code: res.statusCode
    });
    
    httpRequestDuration.observe({
      method: req.method,
      route
    }, duration);
  });
  
  next();
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks and metrics
    return req.path === '/health' || req.path === '/metrics';
  }
});

app.use(limiter);

// JWT Authentication middleware
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    // Check if token is blacklisted
    const isBlacklisted = await redisClient.get(`blacklist:${token}`);
    if (isBlacklisted) {
      return res.status(401).json({ error: 'Token has been revoked' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    logger.error('Token verification failed:', error);
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// Circuit breaker implementation
class CircuitBreaker {
  constructor(threshold = 5, timeout = 60000) {
    this.failureCount = 0;
    this.threshold = threshold;
    this.timeout = timeout;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.nextAttempt = Date.now();
  }

  async call(fn) {
    if (this.state === 'OPEN') {
      if (this.nextAttempt <= Date.now()) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  onFailure() {
    this.failureCount++;
    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeout;
    }
  }
}

const circuitBreakers = new Map();

// Get or create circuit breaker for service
const getCircuitBreaker = (serviceName) => {
  if (!circuitBreakers.has(serviceName)) {
    circuitBreakers.set(serviceName, new CircuitBreaker());
  }
  return circuitBreakers.get(serviceName);
};

// Service health check
const checkServiceHealth = async (serviceName, serviceUrl) => {
  try {
    const response = await fetch(`${serviceUrl}/health`, {
      method: 'GET',
      timeout: 5000
    });
    return response.ok;
  } catch (error) {
    logger.warn(`Service ${serviceName} health check failed:`, error.message);
    return false;
  }
};

// Load balancer for service instances
class LoadBalancer {
  constructor() {
    this.serviceInstances = new Map();
    this.currentIndex = new Map();
  }

  addInstance(serviceName, url) {
    if (!this.serviceInstances.has(serviceName)) {
      this.serviceInstances.set(serviceName, []);
      this.currentIndex.set(serviceName, 0);
    }
    this.serviceInstances.get(serviceName).push(url);
  }

  getNextInstance(serviceName) {
    const instances = this.serviceInstances.get(serviceName);
    if (!instances || instances.length === 0) {
      return null;
    }

    const index = this.currentIndex.get(serviceName);
    const instance = instances[index];
    this.currentIndex.set(serviceName, (index + 1) % instances.length);
    
    return instance;
  }
}

const loadBalancer = new LoadBalancer();

// Initialize service instances
Object.entries(services).forEach(([name, url]) => {
  loadBalancer.addInstance(name, url);
});

// Proxy configuration with circuit breaker
const createProxyOptions = (serviceName, pathRewrite = {}) => ({
  target: services[serviceName],
  changeOrigin: true,
  pathRewrite,
  timeout: 30000,
  proxyTimeout: 30000,
  onProxyReq: (proxyReq, req, res) => {
    // Add correlation ID for tracing
    const correlationId = req.headers['x-correlation-id'] || 
                         `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    proxyReq.setHeader('X-Correlation-ID', correlationId);
    
    // Forward user information
    if (req.user) {
      proxyReq.setHeader('X-User-ID', req.user.id);
      proxyReq.setHeader('X-User-Role', req.user.role);
      proxyReq.setHeader('X-Organization-ID', req.user.organizationId);
    }
    
    logger.info(`Proxying ${req.method} ${req.path} to ${serviceName}`, {
      correlationId,
      userId: req.user?.id,
      service: serviceName
    });
  },
  onError: (err, req, res) => {
    logger.error(`Proxy error for ${serviceName}:`, err);
    
    const circuitBreaker = getCircuitBreaker(serviceName);
    circuitBreaker.onFailure();
    
    if (!res.headersSent) {
      res.status(503).json({
        error: 'Service temporarily unavailable',
        service: serviceName,
        timestamp: new Date().toISOString()
      });
    }
  }
});

// Health check endpoint
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {}
  };

  // Check all services
  const healthChecks = Object.entries(services).map(async ([name, url]) => {
    const isHealthy = await checkServiceHealth(name, url);
    health.services[name] = {
      status: isHealthy ? 'healthy' : 'unhealthy',
      url
    };
  });

  await Promise.all(healthChecks);

  const unhealthyServices = Object.values(health.services)
    .filter(service => service.status === 'unhealthy');

  if (unhealthyServices.length > 0) {
    health.status = 'degraded';
    res.status(503);
  }

  res.json(health);
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(register.metrics());
});

// API Routes with authentication

// Public routes (no authentication required)
app.use('/api/auth', createProxyMiddleware(createProxyOptions('user', {
  '^/api/auth': ''
})));

app.use('/api/products', createProxyMiddleware(createProxyOptions('product', {
  '^/api/products': ''
})));

app.use('/api/search', createProxyMiddleware(createProxyOptions('search', {
  '^/api/search': ''
})));

// Protected routes (authentication required)
app.use('/api/users', authenticateToken, createProxyMiddleware(createProxyOptions('user', {
  '^/api/users': ''
})));

app.use('/api/orders', authenticateToken, createProxyMiddleware(createProxyOptions('order', {
  '^/api/orders': ''
})));

app.use('/api/payments', authenticateToken, createProxyMiddleware(createProxyOptions('payment', {
  '^/api/payments': ''
})));

app.use('/api/inventory', authenticateToken, createProxyMiddleware(createProxyOptions('inventory', {
  '^/api/inventory': ''
})));

app.use('/api/notifications', authenticateToken, createProxyMiddleware(createProxyOptions('notification', {
  '^/api/notifications': ''
})));

app.use('/api/analytics', authenticateToken, createProxyMiddleware(createProxyOptions('analytics', {
  '^/api/analytics': ''
})));

app.use('/api/ai', authenticateToken, createProxyMiddleware(createProxyOptions('ai', {
  '^/api/ai': ''
})));

app.use('/api/files', authenticateToken, createProxyMiddleware(createProxyOptions('file', {
  '^/api/files': ''
})));

app.use('/api/blockchain', authenticateToken, createProxyMiddleware(createProxyOptions('blockchain', {
  '^/api/blockchain': ''
})));

app.use('/api/iot', authenticateToken, createProxyMiddleware(createProxyOptions('iot', {
  '^/api/iot': ''
})));

// WebSocket proxy for real-time features
const { createProxyMiddleware: createWsProxy } = require('http-proxy-middleware');

const wsProxy = createWsProxy({
  target: 'ws://notification-service:3006',
  changeOrigin: true,
  ws: true,
  logLevel: 'info'
});

app.use('/ws', wsProxy);

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error('Unhandled error:', error);
  
  if (res.headersSent) {
    return next(error);
  }
  
  res.status(500).json({
    error: 'Internal server error',
    timestamp: new Date().toISOString(),
    correlationId: req.headers['x-correlation-id']
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  server.close(() => {
    logger.info('HTTP server closed');
    
    redisClient.quit(() => {
      logger.info('Redis connection closed');
      process.exit(0);
    });
  });
  
  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 30000);
};

// Start server
const server = app.listen(PORT, async () => {
  try {
    await redisClient.connect();
    logger.info('Connected to Redis');
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
  }
  
  logger.info(`API Gateway running on port ${PORT}`);
  logger.info('Service endpoints:', services);
});

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = app;
