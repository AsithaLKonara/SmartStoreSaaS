const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3004;

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Mock payment data for development
const mockPayments = [
  {
    id: 1,
    orderId: 1,
    userId: 1,
    amount: 1999.98,
    method: 'credit_card',
    status: 'completed',
    transactionId: 'txn_123456789',
    createdAt: new Date().toISOString()
  },
  {
    id: 2,
    orderId: 2,
    userId: 2,
    amount: 1999.99,
    method: 'paypal',
    status: 'completed',
    transactionId: 'txn_987654321',
    createdAt: new Date().toISOString()
  }
];

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'payment-service',
    timestamp: new Date().toISOString()
  });
});

// Get all payments
app.get('/api/payments', (req, res) => {
  res.json({
    payments: mockPayments,
    total: mockPayments.length,
    timestamp: new Date().toISOString()
  });
});

// Get payment by ID
app.get('/api/payments/:id', (req, res) => {
  const payment = mockPayments.find(p => p.id === parseInt(req.params.id));
  
  if (!payment) {
    return res.status(404).json({ error: 'Payment not found' });
  }
  
  res.json(payment);
});

// Get payments by user ID
app.get('/api/payments/user/:userId', (req, res) => {
  const userPayments = mockPayments.filter(p => p.userId === parseInt(req.params.userId));
  
  res.json({
    payments: userPayments,
    total: userPayments.length,
    userId: parseInt(req.params.userId),
    timestamp: new Date().toISOString()
  });
});

// Process payment
app.post('/api/payments/process', (req, res) => {
  const { orderId, userId, amount, method } = req.body;
  
  if (!orderId || !userId || !amount || !method) {
    return res.status(400).json({ error: 'OrderId, userId, amount, and method are required' });
  }
  
  // Simulate payment processing
  const isSuccessful = Math.random() > 0.1; // 90% success rate
  
  if (!isSuccessful) {
    return res.status(400).json({ error: 'Payment failed' });
  }
  
  const newPayment = {
    id: mockPayments.length + 1,
    orderId: parseInt(orderId),
    userId: parseInt(userId),
    amount: parseFloat(amount),
    method,
    status: 'completed',
    transactionId: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString()
  };
  
  mockPayments.push(newPayment);
  
  res.status(201).json({
    message: 'Payment processed successfully',
    payment: newPayment
  });
});

// Refund payment
app.post('/api/payments/:id/refund', (req, res) => {
  const paymentIndex = mockPayments.findIndex(p => p.id === parseInt(req.params.id));
  
  if (paymentIndex === -1) {
    return res.status(404).json({ error: 'Payment not found' });
  }
  
  if (mockPayments[paymentIndex].status !== 'completed') {
    return res.status(400).json({ error: 'Only completed payments can be refunded' });
  }
  
  mockPayments[paymentIndex].status = 'refunded';
  
  res.json({
    message: 'Payment refunded successfully',
    payment: mockPayments[paymentIndex]
  });
});

// Get payment methods
app.get('/api/payments/methods', (req, res) => {
  res.json({
    methods: [
      { id: 'credit_card', name: 'Credit Card', enabled: true },
      { id: 'paypal', name: 'PayPal', enabled: true },
      { id: 'stripe', name: 'Stripe', enabled: true },
      { id: 'crypto', name: 'Cryptocurrency', enabled: false }
    ],
    timestamp: new Date().toISOString()
  });
});

// Default route
app.get('/', (req, res) => {
  res.json({
    message: 'SmartStore AI Payment Service',
    version: '1.0.0',
    endpoints: [
      '/health',
      '/api/payments',
      '/api/payments/:id',
      '/api/payments/user/:userId',
      '/api/payments/process',
      '/api/payments/methods'
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
  console.error('Payment Service Error:', err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Payment Service running on port ${PORT}`);
});

module.exports = app; 