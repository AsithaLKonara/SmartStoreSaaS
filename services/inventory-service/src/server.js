const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 3005;

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'inventory-service',
    timestamp: new Date().toISOString()
  });
});

// Basic inventory endpoints
app.get('/api/inventory', (req, res) => {
  res.json({
    message: 'Inventory service is running',
    endpoints: [
      '/health',
      '/api/inventory',
      '/api/inventory/stock',
      '/api/inventory/movements'
    ]
  });
});

app.get('/api/inventory/stock', (req, res) => {
  res.json({
    message: 'Stock levels endpoint',
    data: []
  });
});

app.get('/api/inventory/movements', (req, res) => {
  res.json({
    message: 'Stock movements endpoint',
    data: []
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Inventory Service running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});

module.exports = app; 