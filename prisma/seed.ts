import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create demo organization
  const organization = await prisma.organization.upsert({
    where: { slug: 'demo-store' },
    update: {},
    create: {
      name: 'Demo Store',
      slug: 'demo-store',
      plan: 'PRO',
      settings: {
        currency: 'USD',
        timezone: 'UTC',
        language: 'en',
      },
    },
  });

  console.log('✅ Created organization:', organization.name);

  // Create admin user
  const hashedPassword = await bcrypt.hash('password123', 12);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@smartstore.ai' },
    update: {},
    create: {
      email: 'admin@smartstore.ai',
      name: 'Admin User',
      password: hashedPassword,
      role: 'ADMIN',
      organizationId: organization.id,
    },
  });

  console.log('✅ Created admin user:', adminUser.email);

  // Create demo categories
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { 
        organizationId_slug: { 
          organizationId: organization.id, 
          slug: 'electronics' 
        } 
      },
      update: {},
      create: {
        name: 'Electronics',
        slug: 'electronics',
        description: 'Electronic devices and accessories',
        organizationId: organization.id,
      },
    }),
    prisma.category.upsert({
      where: { 
        organizationId_slug: { 
          organizationId: organization.id, 
          slug: 'clothing' 
        } 
      },
      update: {},
      create: {
        name: 'Clothing',
        slug: 'clothing',
        description: 'Fashion and apparel',
        organizationId: organization.id,
      },
    }),
    prisma.category.upsert({
      where: { 
        organizationId_slug: { 
          organizationId: organization.id, 
          slug: 'home-garden' 
        } 
      },
      update: {},
      create: {
        name: 'Home & Garden',
        slug: 'home-garden',
        description: 'Home improvement and garden supplies',
        organizationId: organization.id,
      },
    }),
  ]);

  console.log('✅ Created categories:', categories.map((c: any) => c.name));

  // Create demo products
  const products = await Promise.all([
    prisma.product.upsert({
      where: { 
        organizationId_sku: { 
          organizationId: organization.id, 
          sku: 'LAPTOP-001' 
        } 
      },
      update: {},
      create: {
        name: 'Premium Laptop',
        slug: 'premium-laptop',
        description: 'High-performance laptop for professionals',
        sku: 'LAPTOP-001',
        price: 1299.99,
        comparePrice: 1499.99,
        costPrice: 800.00,
        stockQuantity: 25,
        lowStockThreshold: 5,
        weight: 2.5,
        dimensions: { length: 35, width: 24, height: 2 },
        images: ['https://images.unsplash.com/photo-1496181133206-80ce9b88a853'],
        isActive: true,
        isFeatured: true,
        organizationId: organization.id,
        categoryId: categories[0].id, // Electronics
        createdById: adminUser.id,
      },
    }),
    prisma.product.upsert({
      where: { 
        organizationId_sku: { 
          organizationId: organization.id, 
          sku: 'TSHIRT-001' 
        } 
      },
      update: {},
      create: {
        name: 'Cotton T-Shirt',
        slug: 'cotton-tshirt',
        description: 'Comfortable cotton t-shirt in various colors',
        sku: 'TSHIRT-001',
        price: 29.99,
        comparePrice: 39.99,
        costPrice: 15.00,
        stockQuantity: 100,
        lowStockThreshold: 20,
        weight: 0.2,
        dimensions: { length: 30, width: 25, height: 1 },
        images: ['https://images.unsplash.com/photo-1521572163474-6864f9cf17ab'],
        isActive: true,
        isFeatured: false,
        organizationId: organization.id,
        categoryId: categories[1].id, // Clothing
        createdById: adminUser.id,
      },
    }),
    prisma.product.upsert({
      where: { 
        organizationId_sku: { 
          organizationId: organization.id, 
          sku: 'GARDEN-001' 
        } 
      },
      update: {},
      create: {
        name: 'Garden Tool Set',
        slug: 'garden-tool-set',
        description: 'Complete set of essential garden tools',
        sku: 'GARDEN-001',
        price: 89.99,
        comparePrice: 119.99,
        costPrice: 45.00,
        stockQuantity: 15,
        lowStockThreshold: 5,
        weight: 3.5,
        dimensions: { length: 40, width: 30, height: 10 },
        images: ['https://images.unsplash.com/photo-1416879595882-3373a0480b5b'],
        isActive: true,
        isFeatured: true,
        organizationId: organization.id,
        categoryId: categories[2].id, // Home & Garden
        createdById: adminUser.id,
      },
    }),
  ]);

  console.log('✅ Created products:', products.map((p: any) => p.name));

  // Create demo customers
  const customers = await Promise.all([
    prisma.customer.upsert({
      where: { 
        organizationId_phone: { 
          organizationId: organization.id, 
          phone: '+1234567890' 
        } 
      },
      update: {},
      create: {
        name: 'John Doe',
        email: 'john.doe@example.com',
        phone: '+1234567890',
        tags: ['VIP', 'returning'],
        source: 'website',
        totalSpent: 1250.00,
        points: 125,
        organizationId: organization.id,
      },
    }),
    prisma.customer.upsert({
      where: { 
        organizationId_phone: { 
          organizationId: organization.id, 
          phone: '+1987654321' 
        } 
      },
      update: {},
      create: {
        name: 'Jane Smith',
        email: 'jane.smith@example.com',
        phone: '+1987654321',
        tags: ['new'],
        source: 'whatsapp',
        totalSpent: 450.00,
        points: 45,
        organizationId: organization.id,
      },
    }),
    prisma.customer.upsert({
      where: { 
        organizationId_phone: { 
          organizationId: organization.id, 
          phone: '+1555123456' 
        } 
      },
      update: {},
      create: {
        name: 'Mike Johnson',
        email: 'mike.johnson@example.com',
        phone: '+1555123456',
        tags: ['facebook'],
        source: 'facebook',
        totalSpent: 890.00,
        points: 89,
        organizationId: organization.id,
      },
    }),
  ]);

  console.log('✅ Created customers:', customers.map((c: any) => c.name));

  // Create demo orders
  const orders = await Promise.all([
    prisma.order.upsert({
      where: { orderNumber: 'ORD-123456' },
      update: {},
      create: {
        orderNumber: 'ORD-123456',
        status: 'CONFIRMED',
        totalAmount: 1329.98,
        subtotal: 1299.99,
        tax: 29.99,
        shipping: 0,
        discount: 0,
        currency: 'USD',
        notes: 'Customer requested express shipping',
        organizationId: organization.id,
        customerId: customers[0].id, // John Doe
        createdById: adminUser.id,
      },
    }),
    prisma.order.upsert({
      where: { orderNumber: 'ORD-123457' },
      update: {},
      create: {
        orderNumber: 'ORD-123457',
        status: 'DELIVERED',
        totalAmount: 119.98,
        subtotal: 89.99,
        tax: 9.99,
        shipping: 20.00,
        discount: 0,
        currency: 'USD',
        organizationId: organization.id,
        customerId: customers[1].id, // Jane Smith
        createdById: adminUser.id,
      },
    }),
  ]);

  console.log('✅ Created orders:', orders.map((o: any) => o.orderNumber));

  // Create order items
  const existingItems = await prisma.orderItem.findMany({
    where: {
      OR: [
        { orderId: orders[0].id, productId: products[0].id },
        { orderId: orders[1].id, productId: products[2].id }
      ]
    }
  });

  await Promise.all([
<<<<<<< HEAD
    existingItems.find(item => item.orderId === orders[0].id && item.productId === products[0].id)
      ? prisma.orderItem.update({
          where: { id: existingItems.find(item => item.orderId === orders[0].id && item.productId === products[0].id)!.id },
          data: {
            quantity: 1,
            price: 1299.99,
            total: 1299.99,
          },
        })
      : prisma.orderItem.create({
          data: {
            quantity: 1,
            price: 1299.99,
            total: 1299.99,
            orderId: orders[0].id,
            productId: products[0].id,
          },
        }),
    existingItems.find(item => item.orderId === orders[1].id && item.productId === products[2].id)
      ? prisma.orderItem.update({
          where: { id: existingItems.find(item => item.orderId === orders[1].id && item.productId === products[2].id)!.id },
          data: {
            quantity: 1,
            price: 89.99,
            total: 89.99,
          },
        })
      : prisma.orderItem.create({
          data: {
            quantity: 1,
            price: 89.99,
            total: 89.99,
            orderId: orders[1].id,
            productId: products[2].id,
          },
        }),
=======
    prisma.orderItem.upsert({
      where: { 
        id: 'order-item-1' 
      },
      update: {},
      create: {
        quantity: 1,
        price: 1299.99,
        total: 1299.99,
        orderId: orders[0].id,
        productId: products[0].id,
      },
    }),
    prisma.orderItem.upsert({
      where: { 
        id: 'order-item-2' 
      },
      update: {},
      create: {
        quantity: 1,
        price: 89.99,
        total: 89.99,
        orderId: orders[1].id,
        productId: products[2].id,
      },
    }),
>>>>>>> 08d9e1855dc7fd2c99e5d62def516239ff37a9a7
  ]);

  console.log('✅ Created order items');

  // Create demo couriers
  const couriers = await Promise.all([
    prisma.courier.upsert({
      where: { 
        organizationId_code: { 
          organizationId: organization.id, 
          code: 'pickme' 
        } 
      },
      update: {},
      create: {
        name: 'PickMe',
        code: 'pickme',
        isActive: true,
        settings: {
          apiUrl: 'https://api.pickme.lk',
          zones: ['Colombo', 'Galle', 'Kandy'],
        },
        organizationId: organization.id,
      },
    }),
    prisma.courier.upsert({
      where: { 
        organizationId_code: { 
          organizationId: organization.id, 
          code: 'aramex' 
        } 
      },
      update: {},
      create: {
        name: 'Aramex',
        code: 'aramex',
        isActive: true,
        settings: {
          apiUrl: 'https://api.aramex.com',
          international: true,
        },
        organizationId: organization.id,
      },
    }),
  ]);

  console.log('✅ Created couriers:', couriers.map((c: any) => c.name));

  // Create demo chat messages
  const chatMessages = await Promise.all([
    prisma.chatMessage.create({
      data: {
        content: 'Hi, I need help with my order #ORD-123456',
        type: 'TEXT',
        direction: 'INBOUND',
        status: 'READ',
        organizationId: organization.id,
        customerId: customers[0].id,
        assignedToId: adminUser.id,
      },
    }),
    prisma.chatMessage.create({
      data: {
        content: 'Hello! I can help you with that. What specific issue are you having?',
        type: 'TEXT',
        direction: 'OUTBOUND',
        status: 'SENT',
        organizationId: organization.id,
        customerId: customers[0].id,
        assignedToId: adminUser.id,
      },
    }),
    prisma.chatMessage.create({
      data: {
        content: 'Do you have red mugs in stock?',
        type: 'TEXT',
        direction: 'INBOUND',
        status: 'READ',
        organizationId: organization.id,
        customerId: customers[1].id,
      },
    }),
  ]);

  console.log('✅ Created chat messages');

  console.log('🎉 Database seeding completed successfully!');
  console.log('');
  console.log('📋 Demo Data Summary:');
  console.log(`   Organization: ${organization.name} (${organization.slug})`);
  console.log(`   Admin User: ${adminUser.email} (password: password123)`);
  console.log(`   Categories: ${categories.length}`);
  console.log(`   Products: ${products.length}`);
  console.log(`   Customers: ${customers.length}`);
  console.log(`   Orders: ${orders.length}`);
  console.log(`   Couriers: ${couriers.length}`);
  console.log(`   Chat Messages: ${chatMessages.length}`);
  console.log('');
  console.log('🚀 You can now start the application and sign in with:');
  console.log('   Email: admin@smartstore.ai');
  console.log('   Password: password123');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 