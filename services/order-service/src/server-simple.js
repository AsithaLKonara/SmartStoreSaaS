const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3003;

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Mock order data for development
const mockOrders = [
  {
    id: 1,
    userId: 1,
    products: [
      { productId: 1, quantity: 2, price: 999.99 }
    ],
    total: 1999.98,
    status: 'pending',
    createdAt: new Date().toISOString()
  },
  {
    id: 2,
    userId: 2,
    products: [
      { productId: 2, quantity: 1, price: 1999.99 }
    ],
    total: 1999.99,
    status: 'completed',
    createdAt: new Date().toISOString()
  }
];

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'order-service',
    timestamp: new Date().toISOString()
  });
});

// Get all orders
app.get('/api/orders', (req, res) => {
  res.json({
    orders: mockOrders,
    total: mockOrders.length,
    timestamp: new Date().toISOString()
  });
});

// Get order by ID
app.get('/api/orders/:id', (req, res) => {
  const order = mockOrders.find(o => o.id === parseInt(req.params.id));
  
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  
  res.json(order);
});

// Get orders by user ID
app.get('/api/orders/user/:userId', (req, res) => {
  const userOrders = mockOrders.filter(o => o.userId === parseInt(req.params.userId));
  
  res.json({
    orders: userOrders,
    total: userOrders.length,
    userId: parseInt(req.params.userId),
    timestamp: new Date().toISOString()
  });
});

// Create new order
app.post('/api/orders', (req, res) => {
  const { userId, products, total } = req.body;
  
  if (!userId || !products || !total) {
    return res.status(400).json({ error: 'UserId, products, and total are required' });
  }
  
  const newOrder = {
    id: mockOrders.length + 1,
    userId: parseInt(userId),
    products: products.map(p => ({
      productId: parseInt(p.productId),
      quantity: parseInt(p.quantity),
      price: parseFloat(p.price)
    })),
    total: parseFloat(total),
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  
  mockOrders.push(newOrder);
  
  res.status(201).json({
    message: 'Order created successfully',
    order: newOrder
  });
});

// Update order status
app.put('/api/orders/:id/status', (req, res) => {
  const { status } = req.body;
  const orderIndex = mockOrders.findIndex(o => o.id === parseInt(req.params.id));
  
  if (orderIndex === -1) {
    return res.status(404).json({ error: 'Order not found' });
  }
  
  if (!status) {
    return res.status(400).json({ error: 'Status is required' });
  }
  
  mockOrders[orderIndex].status = status;
  
  res.json({
    message: 'Order status updated successfully',
    order: mockOrders[orderIndex]
  });
});

// Cancel order
app.put('/api/orders/:id/cancel', (req, res) => {
  const orderIndex = mockOrders.findIndex(o => o.id === parseInt(req.params.id));
  
  if (orderIndex === -1) {
    return res.status(404).json({ error: 'Order not found' });
  }
  
  if (mockOrders[orderIndex].status === 'completed') {
    return res.status(400).json({ error: 'Cannot cancel completed order' });
  }
  
  mockOrders[orderIndex].status = 'cancelled';
  
  res.json({
    message: 'Order cancelled successfully',
    order: mockOrders[orderIndex]
  });
});

// Default route
app.get('/', (req, res) => {
  res.json({
    message: 'SmartStore AI Order Service',
    version: '1.0.0',
    endpoints: [
      '/health',
      '/api/orders',
      '/api/orders/:id',
      '/api/orders/user/:userId'
    ],
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Order Service Error:', err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Order Service running on port ${PORT}`);
});

module.exports = app; 