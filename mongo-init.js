// MongoDB initialization script
// This script runs when the MongoDB container starts for the first time

// Switch to the smartstore database
db = db.getSiblingDB('smartstore');

// Create a user for the application
db.createUser({
  user: 'smartstore_user',
  pwd: 'smartstore_password',
  roles: [
    {
      role: 'readWrite',
      db: 'smartstore'
    }
  ]
});

// Create collections with proper indexes
db.createCollection('users');
db.createCollection('organizations');
db.createCollection('customers');
db.createCollection('products');
db.createCollection('orders');
db.createCollection('payments');
db.createCollection('couriers');
db.createCollection('warehouses');
db.createCollection('campaigns');
db.createCollection('expenses');
db.createCollection('chat_messages');

// Create indexes for better performance
db.users.createIndex({ "email": 1 }, { unique: true });
db.users.createIndex({ "organizationId": 1 });

db.organizations.createIndex({ "slug": 1 }, { unique: true });

db.customers.createIndex({ "organizationId": 1, "email": 1 }, { unique: true, sparse: true });
db.customers.createIndex({ "organizationId": 1, "phone": 1 }, { unique: true, sparse: true });

db.products.createIndex({ "organizationId": 1, "slug": 1 }, { unique: true });
db.products.createIndex({ "organizationId": 1, "sku": 1 }, { unique: true, sparse: true });
db.products.createIndex({ "categoryId": 1 });

db.orders.createIndex({ "orderNumber": 1 }, { unique: true });
db.orders.createIndex({ "organizationId": 1 });
db.orders.createIndex({ "customerId": 1 });
db.orders.createIndex({ "status": 1 });

db.payments.createIndex({ "organizationId": 1 });
db.payments.createIndex({ "orderId": 1 });

db.couriers.createIndex({ "organizationId": 1, "code": 1 }, { unique: true });

db.warehouses.createIndex({ "organizationId": 1 });

db.campaigns.createIndex({ "organizationId": 1 });

db.expenses.createIndex({ "organizationId": 1 });

db.chat_messages.createIndex({ "organizationId": 1 });
db.chat_messages.createIndex({ "customerId": 1 });

// Insert a default organization for testing
db.organizations.insertOne({
  _id: ObjectId(),
  name: "SmartStore Demo",
  slug: "smartstore-demo",
  domain: "demo.smartstore.ai",
  logo: null,
  settings: {
    currency: "USD",
    timezone: "UTC",
    language: "en"
  },
  isActive: true,
  plan: "PRO",
  createdAt: new Date(),
  updatedAt: new Date()
});

print('MongoDB initialization completed successfully!'); 