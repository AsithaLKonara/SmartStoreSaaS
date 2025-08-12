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
const hpp = require('hpp');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const slowDown = require('express-slow-down');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Enhanced logging configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'api-gateway' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// Redis client with enhanced security
const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  password: process.env.REDIS_PASSWORD,
  tls: process.env.REDIS_TLS_ENABLED === 'true' ? {} : undefined,
  retry_strategy: (options) => {
    if (options.total_retry_time > 1000 * 60 * 60) {
      return new Error('Retry time exhausted');
    }
    if (options.attempt > 10) {
      return undefined;
    }
    return Math.min(options.attempt * 100, 3000);
  }
});

redisClient.on('error', (err) => logger.error('Redis Client Error:', err));
redisClient.on('connect', () => logger.info('Redis Client Connected'));

// Prometheus metrics
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

// Enhanced security middleware
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
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
    },
  },
  hsts: {
    maxAge: parseInt(process.env.HSTS_MAX_AGE || '31536000'),
    includeSubDomains: process.env.HSTS_INCLUDE_SUBDOMAINS === 'true',
    preload: process.env.HSTS_PRELOAD === 'true',
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  frameguard: { action: 'deny' },
  noSniff: true,
  xssFilter: true,
}));

// Additional security middleware
app.use(hpp()); // Protect against HTTP Parameter Pollution
app.use(mongoSanitize()); // Prevent NoSQL injection
app.use(xss()); // Prevent XSS attacks

// Enhanced CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count', 'X-Rate-Limit-Remaining'],
  maxAge: 86400, // 24 hours
}));

// Enhanced rate limiting
const rateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.ceil(parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000') / 1000),
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: process.env.RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS === 'true',
  skipFailedRequests: process.env.RATE_LIMIT_SKIP_FAILED_REQUESTS === 'true',
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise IP address
    return req.user?.id || req.ip;
  },
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for ${req.ip}`, {
      ip: req.ip,
      userId: req.user?.id,
      userAgent: req.get('User-Agent'),
    });
    res.status(429).json({
      error: 'Too many requests',
      retryAfter: Math.ceil(parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000') / 1000),
    });
  },
});

// Speed limiting for suspicious requests
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // Allow 50 requests per 15 minutes, then...
  delayMs: 500, // Begin adding 500ms of delay per request above 50
  maxDelayMs: 20000, // Maximum delay of 20 seconds
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
});

// Apply rate limiting to all routes
app.use(rateLimiter);
app.use(speedLimiter);

// Request logging
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

// Compression
app.use(compression());

// Body parsing with size limits
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    try {
      JSON.parse(buf);
    } catch (e) {
      res.status(400).json({ error: 'Invalid JSON' });
      throw new Error('Invalid JSON');
    }
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request timeout middleware
app.use((req, res, next) => {
  const timeout = parseInt(process.env.API_REQUEST_TIMEOUT_MS || '30000');
  req.setTimeout(timeout, () => {
    res.status(408).json({ error: 'Request timeout' });
  });
  next();
});

// Security headers middleware
app.use((req, res, next) => {
  // Additional security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('X-Download-Options', 'noopen');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  
  // Remove server information
  res.removeHeader('X-Powered-By');
  
  next();
});

// Request ID middleware for tracing
app.use((req, res, next) => {
  req.id = require('crypto').randomBytes(16).toString('hex');
  res.setHeader('X-Request-ID', req.id);
  next();
});

// Metrics middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    httpRequestsTotal.inc({ 
      method: req.method, 
      route: req.route?.path || req.path, 
      status_code: res.statusCode 
    });
    httpRequestDuration.observe({ 
      method: req.method, 
      route: req.route?.path || req.path 
    }, duration / 1000);
  });
  
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end(err);
  }
});

// JWT Authentication middleware with enhanced security
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    logger.warn('Access attempt without token', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
    });
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    // Check if token is blacklisted
    const isBlacklisted = await redisClient.get(`blacklist:${token}`);
    if (isBlacklisted) {
      logger.warn('Blacklisted token used', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
      });
      return res.status(401).json({ error: 'Token has been revoked' });
    }

    // Verify token with proper error handling
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: process.env.JWT_ISSUER || 'smartstore',
      audience: process.env.JWT_AUDIENCE || 'smartstore-users',
    });

    // Check token expiration
    if (decoded.exp && Date.now() >= decoded.exp * 1000) {
      logger.warn('Expired token used', {
        ip: req.ip,
        userId: decoded.id,
        userAgent: req.get('User-Agent'),
        path: req.path,
      });
      return res.status(401).json({ error: 'Token has expired' });
    }

    // Add user info to request
    req.user = decoded;
    
    // Log successful authentication
    logger.info('User authenticated', {
      userId: decoded.id,
      ip: req.ip,
      path: req.path,
    });

    next();
  } catch (error) {
    logger.error('Token verification failed:', {
      error: error.message,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
    });
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token has expired' });
    } else if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({ error: 'Invalid token' });
    } else {
      return res.status(403).json({ error: 'Token verification failed' });
    }
  }
};

// Role-based access control middleware
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      logger.warn('Unauthorized access attempt', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: roles,
        ip: req.ip,
        path: req.path,
      });
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

// API key authentication middleware
const authenticateAPIKey = (req, res, next) => {
  const apiKey = req.headers[process.env.API_KEY_HEADER || 'X-API-Key'];
  
  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }

  // Validate API key (implement your validation logic here)
  if (apiKey !== process.env.API_KEY) {
    logger.warn('Invalid API key used', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
    });
    return res.status(403).json({ error: 'Invalid API key' });
  }

  next();
};

// Proxy options with enhanced security
const createProxyOptions = (serviceName, pathRewrite = {}) => ({
  target: services[serviceName],
  changeOrigin: true,
  pathRewrite,
  onProxyReq: (proxyReq, req, res) => {
    // Add security headers to proxied requests
    proxyReq.setHeader('X-Forwarded-For', req.ip);
    proxyReq.setHeader('X-Forwarded-Proto', req.protocol);
    proxyReq.setHeader('X-Request-ID', req.id);
    
    // Log proxy request
    logger.info(`Proxying to ${serviceName}`, {
      service: serviceName,
      method: req.method,
      path: req.path,
      userId: req.user?.id,
      ip: req.ip,
    });
  },
  onProxyRes: (proxyRes, req, res) => {
    // Log proxy response
    logger.info(`Response from ${serviceName}`, {
      service: serviceName,
      statusCode: proxyRes.statusCode,
      method: req.method,
      path: req.path,
      userId: req.user?.id,
    });
  },
  onError: (err, req, res) => {
    logger.error(`Proxy error to ${serviceName}:`, {
      error: err.message,
      service: serviceName,
      method: req.method,
      path: req.path,
      userId: req.user?.id,
    });
    
    res.status(502).json({ 
      error: 'Service temporarily unavailable',
      service: serviceName,
    });
  },
});

// API Routes with enhanced security

// Public routes (no authentication required)
app.use('/api/auth', createProxyMiddleware(createProxyOptions('user', {
  '^/api/auth': ''
})));

app.use('/api/health', createProxyMiddleware(createProxyOptions('user', {
  '^/api/health': ''
})));

// Protected routes (authentication required)
app.use('/api/users', authenticateToken, createProxyMiddleware(createProxyOptions('user', {
  '^/api/users': ''
})));

app.use('/api/products', authenticateToken, createProxyMiddleware(createProxyOptions('product', {
  '^/api/products': ''
})));

app.use('/api/orders', authenticateToken, createProxyMiddleware(createProxyOptions('order', {
  '^/api/orders': ''
})));

app.use('/api/payments', authenticateToken, createProxyMiddleware(createProxyOptions('payment', {
  '^/api/payments': ''
})));

// Admin routes (role-based access)
app.use('/api/admin', authenticateToken, requireRole(['ADMIN', 'SUPER_ADMIN']), createProxyMiddleware(createProxyOptions('user', {
  '^/api/admin': ''
})));

// API key protected routes
app.use('/api/webhooks', authenticateAPIKey, createProxyMiddleware(createProxyOptions('user', {
  '^/api/webhooks': ''
})));

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    method: req.method,
    path: req.path,
    userId: req.user?.id,
    ip: req.ip,
  });

  res.status(500).json({ 
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    requestId: req.id,
  });
});

// 404 handler
app.use('*', (req, res) => {
  logger.warn('Route not found', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });
  
  res.status(404).json({ 
    error: 'Route not found',
    requestId: req.id,
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  redisClient.quit();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  redisClient.quit();
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  logger.info(`API Gateway running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV}`);
  logger.info(`Health check: http://localhost:${PORT}/health`);
  logger.info(`Metrics: http://localhost:${PORT}/metrics`);
});

module.exports = app;
