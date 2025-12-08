import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

// Fallback mock users for development when database is not available
// Using valid MongoDB ObjectID format (24 hex characters)
// For consistent testing, using a fixed ObjectID: 507f1f77bcf86cd799439011
const MOCK_ORG_ID = '507f1f77bcf86cd799439011'; // Valid MongoDB ObjectID format

const mockUsers = [
  {
    id: '507f191e810c19729de860ea', // Valid MongoDB ObjectID
    email: 'admin@smartstore.ai',
    password: 'admin123', // Plain text for testing
    name: 'Admin User',
    role: 'ADMIN',
    organizationId: MOCK_ORG_ID,
  },
  {
    id: '507f191e810c19729de860eb', // Valid MongoDB ObjectID
    email: 'user@smartstore.ai',
    password: 'user123', // Plain text for testing
    name: 'Test User',
    role: 'STAFF',
    organizationId: MOCK_ORG_ID,
  },
];

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || 'mock-google-client-id',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'mock-google-client-secret',
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email;
        const hasPassword = !!credentials?.password;
        console.log('🔐 Auth attempt:', { email, hasPassword, timestamp: new Date().toISOString() });
        
        if (!email || !credentials?.password) {
          console.log('❌ Missing credentials');
          return null;
        }

        try {
          // Try to find user in database first
          console.log(`🔍 [${email}] Checking database for user...`);
          const dbUser = await prisma.user.findUnique({
            where: { 
              email: credentials.email,
            },
            include: {
              organization: true,
            },
          });

          if (dbUser) {
            console.log(`👤 [${email}] User found in database. Role: ${dbUser.role}, Active: ${dbUser.isActive}`);
            
            // Check if user is active
            if (!dbUser.isActive || dbUser.deletedAt) {
              console.log(`❌ [${email}] User is inactive or deleted`);
              return null;
            }

            // If user has no password (OAuth only), deny credentials login
            if (!dbUser.password) {
              console.log(`❌ [${email}] User does not have a password set (OAuth only)`);
              return null;
            }

            // Verify password using bcrypt
            const isPasswordValid = await bcrypt.compare(credentials.password, dbUser.password);
            console.log(`🔑 [${email}] Password valid: ${isPasswordValid}`);

            if (!isPasswordValid) {
              console.log(`❌ [${email}] Invalid password`);
              return null;
            }

            const authResult = {
              id: dbUser.id,
              email: dbUser.email,
              name: dbUser.name || undefined,
              role: dbUser.role,
              organizationId: dbUser.organizationId || undefined,
            };
            console.log(`✅ [${email}] Authentication successful (DB). Role: ${dbUser.role}, OrgId: ${dbUser.organizationId}`);
            return authResult;
          } else {
            console.log(`👤 [${email}] User not found in database, checking mock users...`);
          }
        } catch (error) {
          console.error(`❌ [${email}] Database error during authentication:`, error);
          // Fall through to mock users if database is unavailable
        }

        // Fallback to mock users if database is not available or user not found
        const user = mockUsers.find(u => u.email === credentials.email);
        console.log(`👤 [${email}] User found in mock data: ${!!user}, Role: ${user?.role || 'N/A'}`);

        if (!user) {
          console.log(`❌ [${email}] User not found in mock data`);
          return null;
        }

        // Simple password comparison for mock users (plain text)
        const isPasswordValid = credentials.password === user.password;
        console.log(`🔑 [${email}] Password valid (mock): ${isPasswordValid}`);

        if (!isPasswordValid) {
          console.log(`❌ [${email}] Invalid password (mock)`);
          return null;
        }

        const authResult = {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          organizationId: user.organizationId,
        };
        console.log(`✅ [${email}] Authentication successful (mock). Role: ${user.role}, OrgId: ${user.organizationId}`);
        return authResult;
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const userRole = (user as { role?: string }).role;
        const userOrgId = (user as { organizationId?: string }).organizationId;
        token.role = userRole;
        token.organizationId = userOrgId;
        console.log(`🔐 [JWT] Token updated. Email: ${token.email}, Role: ${userRole}, OrgId: ${userOrgId}`);
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        const userId = token.sub!;
        const userRole = token.role as string;
        const userOrgId = token.organizationId as string;
        (session.user as { id?: string; role?: string; organizationId?: string }).id = userId;
        (session.user as { id?: string; role?: string; organizationId?: string }).role = userRole;
        (session.user as { id?: string; role?: string; organizationId?: string }).organizationId = userOrgId;
        console.log(`🔐 [Session] Session created. Email: ${session.user?.email}, Role: ${userRole}, OrgId: ${userOrgId}`);
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  secret: process.env.NEXTAUTH_SECRET || 'smartstore-nextauth-secret-key-2024',
  debug: true, // Enable debugging
}; 