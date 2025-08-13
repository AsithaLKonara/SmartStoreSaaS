const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Mock user data for development
const mockUsers = [
  {
    id: 1,
    email: 'admin@smartstore.ai',
    name: 'Admin User',
    role: 'ADMIN',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 2,
    email: 'user@smartstore.ai',
    name: 'Test User',
    role: 'USER',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

// Get user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = mockUsers.find(u => u.id === req.user.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user profile
router.put('/profile', 
  authenticateToken,
  [
    body('name').optional().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
    body('email').optional().isEmail().withMessage('Valid email is required')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { name, email } = req.body;
      const userIndex = mockUsers.findIndex(u => u.id === req.user.id);
      
      if (userIndex === -1) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (name) mockUsers[userIndex].name = name;
      if (email) mockUsers[userIndex].email = email;
      mockUsers[userIndex].updatedAt = new Date().toISOString();

      res.json(mockUsers[userIndex]);
    } catch (error) {
      console.error('Error updating user profile:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Get all users (admin only)
router.get('/', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const users = mockUsers.map(user => ({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt
    }));

    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Middleware to authenticate JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'smartstore-jwt-secret-2024', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

module.exports = router;
