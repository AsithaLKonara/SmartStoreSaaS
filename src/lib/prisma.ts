import { PrismaClient, Prisma } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma; 

/**
 * Check if Prisma client is connected
 */
export async function checkPrismaConnection(): Promise<boolean> {
  try {
    await prisma.$connect();
    return true;
  } catch (error) {
    console.error('[Prisma] Connection check failed:', error);
    return false;
  }
}

/**
 * Execute Prisma query with connection check and error handling
 */
export async function executePrismaQuery<T>(
  query: () => Promise<T>,
  retries = 2
): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Check connection before query
      if (attempt > 0) {
        const isConnected = await checkPrismaConnection();
        if (!isConnected) {
          throw new Error('Prisma client is not connected');
        }
      }
      
      return await query();
    } catch (error) {
      // If it's the last attempt, throw the error
      if (attempt === retries) {
        throw error;
      }
      
      // If it's a connection error, try to reconnect
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P1001' || error.code === 'P1002' || error.code === 'P1008') {
          console.log(`[Prisma] Connection error (${error.code}), retrying... (attempt ${attempt + 1}/${retries})`);
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
          continue;
        }
      }
      
      // For other errors, throw immediately
      throw error;
    }
  }
  
  // This should never be reached, but TypeScript needs it
  throw new Error('Query execution failed after retries');
}

/**
 * Validate organizationId before query
 */
export function validateOrganizationId(organizationId: string | null | undefined): string {
  if (!organizationId) {
    throw new Error('organizationId is required but was not provided');
  }
  return organizationId;
} 