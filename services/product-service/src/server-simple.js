const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Mock product data for development
const mockProducts = [
  {
    id: 1,
    name: 'SmartPhone Pro',
    description: 'Latest smartphone with AI capabilities',
    price: 999.99,
    category: 'Electronics',
    stock: 50,
    createdAt: new Date().toISOString()
  },
  {
    id: 2,
    name: 'AI Laptop',
    description: 'High-performance laptop for AI development',
    price: 1999.99,
    category: 'Computers',
    stock: 25,
    createdAt: new Date().toISOString()
  }
];

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'product-service',
    timestamp: new Date().toISOString()
  });
});

// Get all products
app.get('/api/products', (req, res) => {
  res.json({
    products: mockProducts,
    total: mockProducts.length,
    timestamp: new Date().toISOString()
  });
});

// Get product by ID
app.get('/api/products/:id', (req, res) => {
  const product = mockProducts.find(p => p.id === parseInt(req.params.id));
  
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }
  
  res.json(product);
});

// Create new product
app.post('/api/products', (req, res) => {
  const { name, description, price, category, stock } = req.body;
  
  if (!name || !price) {
    return res.status(400).json({ error: 'Name and price are required' });
  }
  
  const newProduct = {
    id: mockProducts.length + 1,
    name,
    description: description || '',
    price: parseFloat(price),
    category: category || 'General',
    stock: parseInt(stock) || 0,
    createdAt: new Date().toISOString()
  };
  
  mockProducts.push(newProduct);
  
  res.status(201).json({
    message: 'Product created successfully',
    product: newProduct
  });
});

// Update product
app.put('/api/products/:id', (req, res) => {
  const productIndex = mockProducts.findIndex(p => p.id === parseInt(req.params.id));
  
  if (productIndex === -1) {
    return res.status(404).json({ error: 'Product not found' });
  }
  
  const { name, description, price, category, stock } = req.body;
  
  if (name) mockProducts[productIndex].name = name;
  if (description) mockProducts[productIndex].description = description;
  if (price) mockProducts[productIndex].price = parseFloat(price);
  if (category) mockProducts[productIndex].category = category;
  if (stock !== undefined) mockProducts[productIndex].stock = parseInt(stock);
  
  res.json({
    message: 'Product updated successfully',
    product: mockProducts[productIndex]
  });
});

// Delete product
app.delete('/api/products/:id', (req, res) => {
  const productIndex = mockProducts.findIndex(p => p.id === parseInt(req.params.id));
  
  if (productIndex === -1) {
    return res.status(404).json({ error: 'Product not found' });
  }
  
  const deletedProduct = mockProducts.splice(productIndex, 1)[0];
  
  res.json({
    message: 'Product deleted successfully',
    product: deletedProduct
  });
});

// Search products
app.get('/api/products/search/:query', (req, res) => {
  const query = req.params.query.toLowerCase();
  const results = mockProducts.filter(product => 
    product.name.toLowerCase().includes(query) ||
    product.description.toLowerCase().includes(query) ||
    product.category.toLowerCase().includes(query)
  );
  
  res.json({
    results,
    total: results.length,
    query,
    timestamp: new Date().toISOString()
  });
});

// Default route
app.get('/', (req, res) => {
  res.json({
    message: 'SmartStore AI Product Service',
    version: '1.0.0',
    endpoints: [
      '/health',
      '/api/products',
      '/api/products/:id',
      '/api/products/search/:query'
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
  console.error('Product Service Error:', err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Product Service running on port ${PORT}`);
});

module.exports = app; 