// Test file - jest types are not available in this context
import { GET } from '../route';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { realTimeSyncService } from '@/lib/sync/realTimeSyncService';

// Mock dependencies
jest.mock('@/lib/prisma', () => ({
  prisma: {
    $connect: jest.fn(),
    courier: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    whatsAppIntegration: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    wooCommerceIntegration: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
  },
}));

jest.mock('@/lib/sync/realTimeSyncService', () => ({
  realTimeSyncService: {
    redis: {
      ping: jest.fn(),
    },
    wss: {
      clients: new Set(),
    },
  },
}));

jest.mock('@/lib/courier/sriLankaCourierService', () => ({
  sriLankaCourierService: {
    testCourierConnection: jest.fn().mockResolvedValue(true),
  },
}));

describe('GET /api/health', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return healthy status when all services are up', async () => {
    (prisma.$connect as jest.Mock).mockResolvedValue(undefined);
    (realTimeSyncService.redis.ping as jest.Mock).mockResolvedValue('PONG');

    const request = new NextRequest(new URL('http://localhost:3000/api/health'));
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('healthy');
    expect(data.services.database).toBe('healthy');
    expect(data.services.redis).toBe('healthy');
    expect(data.services.websocket).toBe('healthy');
  });

  it('should return unhealthy status when database is down', async () => {
    (prisma.$connect as jest.Mock).mockRejectedValue(new Error('Database error'));
    (realTimeSyncService.redis.ping as jest.Mock).mockResolvedValue('PONG');

    const request = new NextRequest(new URL('http://localhost:3000/api/health'));
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.status).toBe('degraded');
    expect(data.services.database).toBe('unhealthy');
  });

  it('should return unhealthy status when redis is down', async () => {
    (prisma.$connect as jest.Mock).mockResolvedValue(undefined);
    (realTimeSyncService.redis.ping as jest.Mock).mockRejectedValue(new Error('Redis error'));

    const request = new NextRequest(new URL('http://localhost:3000/api/health'));
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.status).toBe('degraded');
    expect(data.services.redis).toBe('unhealthy');
  });

  it('should return unhealthy status when both services are down', async () => {
    (prisma.$connect as jest.Mock).mockRejectedValue(new Error('Database error'));
    (realTimeSyncService.redis.ping as jest.Mock).mockRejectedValue(new Error('Redis error'));

    const request = new NextRequest(new URL('http://localhost:3000/api/health'));
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.status).toBe('degraded');
    expect(data.services.database).toBe('unhealthy');
    expect(data.services.redis).toBe('unhealthy');
  });
});
