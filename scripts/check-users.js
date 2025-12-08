// Quick script to check users in database
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkUsers() {
  try {
    console.log('Checking users in database...\n');
    
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        organizationId: true,
        isActive: true,
      },
      take: 10,
    });

    if (users.length === 0) {
      console.log('❌ No users found in database');
      console.log('\nMock users from auth.ts:');
      console.log('  - admin@smartstore.ai / admin123 (ADMIN)');
      console.log('  - user@smartstore.ai / user123 (USER)');
      return;
    }

    console.log(`✅ Found ${users.length} user(s):\n`);
    users.forEach((user, index) => {
      console.log(`${index + 1}. Email: ${user.email}`);
      console.log(`   Name: ${user.name || 'N/A'}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Organization ID: ${user.organizationId || 'N/A'}`);
      console.log(`   Active: ${user.isActive}`);
      console.log('');
    });
  } catch (error) {
    console.error('Error checking users:', error.message);
    console.log('\nNote: Make sure MongoDB is running and DATABASE_URL is set correctly');
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();

