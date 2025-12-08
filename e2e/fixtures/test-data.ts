export const testUsers = {
  admin: {
    email: 'admin@smartstore.ai',
    password: 'admin123',
    name: 'Admin User',
    role: 'ADMIN',
  },
  user: {
    email: 'user@smartstore.ai',
    password: 'user123',
    name: 'Test User',
    role: 'USER',
  },
};

export const testProducts = {
  sample: {
    name: 'Test Product',
    sku: 'TEST-001',
    price: 99.99,
    description: 'Test product description',
    stockQuantity: 100,
  },
};

export const testCustomers = {
  sample: {
    name: 'Test Customer',
    email: 'testcustomer@example.com',
    phone: '+1234567890',
  },
};

export const testOrders = {
  sample: {
    customerId: '1',
    items: [
      {
        productId: '1',
        quantity: 2,
        price: 99.99,
      },
    ],
  },
};

export const testWarehouses = {
  sample: {
    name: 'Test Warehouse',
    address: '123 Test Street',
    city: 'Test City',
    country: 'Test Country',
  },
};

