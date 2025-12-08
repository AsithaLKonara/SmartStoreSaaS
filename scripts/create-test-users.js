// Script to create test users with different roles for RBAC testing
require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createTestUsers() {
  try {
    console.log('🌱 Creating test users for RBAC testing...\n');

    // Find or create test organization
    let organization = await prisma.organization.findFirst({
      where: { slug: 'test-org' },
    });

    if (!organization) {
      organization = await prisma.organization.create({
        data: {
          name: 'Test Organization',
          slug: 'test-org',
          plan: 'PRO',
          settings: {
            currency: 'USD',
            timezone: 'UTC',
            language: 'en',
          },
        },
      });
      console.log('✅ Created test organization:', organization.name);
    } else {
      console.log('✅ Using existing organization:', organization.name);
    }

    const testUsers = [
      {
        email: 'admin@smartstore.ai',
        password: 'admin123',
        name: 'Admin User',
        role: 'ADMIN',
      },
      {
        email: 'manager@smartstore.ai',
        password: 'manager123',
        name: 'Manager User',
        role: 'MANAGER',
      },
      {
        email: 'staff@smartstore.ai',
        password: 'staff123',
        name: 'Staff User',
        role: 'STAFF',
      },
      {
        email: 'packing@smartstore.ai',
        password: 'packing123',
        name: 'Packing User',
        role: 'PACKING',
      },
    ];

    for (const userData of testUsers) {
      const hashedPassword = await bcrypt.hash(userData.password, 12);

      const user = await prisma.user.upsert({
        where: { email: userData.email },
        update: {
          password: hashedPassword,
          name: userData.name,
          role: userData.role,
          organizationId: organization.id,
          isActive: true,
          deletedAt: null,
        },
        create: {
          email: userData.email,
          password: hashedPassword,
          name: userData.name,
          role: userData.role,
          organizationId: organization.id,
          isActive: true,
        },
      });

      console.log(`✅ Created/updated user: ${user.email} (${user.role})`);
    }

    console.log('\n✅ All test users created successfully!');
    console.log('\nTest users:');
    testUsers.forEach((u) => {
      console.log(`  - ${u.email} / ${u.password} (${u.role})`);
    });

  } catch (error) {
    console.error('❌ Error creating test users:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUsers();

