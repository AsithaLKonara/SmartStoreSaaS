import '@testing-library/jest-dom'

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter() {
    return {
      route: '/',
      pathname: '/',
      query: {},
      asPath: '/',
      push: jest.fn(),
      pop: jest.fn(),
      reload: jest.fn(),
      back: jest.fn(),
      prefetch: jest.fn(),
      beforePopState: jest.fn(),
      events: {
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
      },
      isFallback: false,
    }
  },
}))

// Mock Next.js Image component
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...props} />
  },
}))

// Mock environment variables
process.env.NEXTAUTH_SECRET = 'test-secret'
process.env.NEXTAUTH_URL = 'http://localhost:3000'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
process.env.REDIS_URL = 'redis://localhost:6379'

// Global test utilities
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

global.matchMedia = jest.fn().mockImplementation((query) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: jest.fn(),
  removeListener: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
}))

// Mock fetch globally
global.fetch = jest.fn()

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock Next.js Request/Response for API route tests
// Next.js should provide Request, but if not, use a simple polyfill
if (typeof global.Request === 'undefined') {
  // Simple Request polyfill for tests
  global.Request = class Request {
    constructor(input, init = {}) {
      const url = typeof input === 'string' ? input : input?.url || '';
      Object.defineProperty(this, 'url', {
        value: url,
        writable: false,
        configurable: true,
        enumerable: true,
      });
      this.method = init.method || 'GET';
      this.headers = new Headers(init.headers || {});
      this.body = init.body;
    }
  };
}

if (typeof global.Response === 'undefined') {
  global.Response = class Response {
    constructor(body, init) {
      this.body = body;
      this.status = init?.status || 200;
      this.statusText = init?.statusText || 'OK';
      this.headers = new Headers(init?.headers);
      this.ok = this.status >= 200 && this.status < 300;
    }
    json() {
      return Promise.resolve(JSON.parse(this.body));
    }
    text() {
      return Promise.resolve(this.body);
    }
    static json(data, init) {
      return new Response(JSON.stringify(data), {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...init?.headers,
        },
      });
    }
  };
}

// Mock WebSocket
global.WebSocket = jest.fn().mockImplementation(() => ({
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  send: jest.fn(),
  close: jest.fn(),
  readyState: 1,
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
}))

// Mock next-auth and next-auth/next before any imports
jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
  default: jest.fn(),
}))

jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn(),
}))

jest.mock('next-auth/react', () => ({
  signIn: jest.fn(),
  signOut: jest.fn(),
  useSession: jest.fn(() => ({ data: null, status: 'unauthenticated' })),
  SessionProvider: ({ children }) => children,
}))

// Mock Twilio
jest.mock('twilio', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    messages: {
      create: jest.fn(),
    },
  })),
}))

// Mock courier service before Prisma to prevent initialization issues
jest.mock('@/lib/courier/sriLankaCourierService', () => ({
  sriLankaCourierService: {
    track: jest.fn(),
    getCouriers: jest.fn().mockResolvedValue([]),
  },
}));

// Mock real-time sync service
jest.mock('@/lib/sync/realTimeSyncService', () => ({
  realTimeSyncService: {
    connect: jest.fn(),
    disconnect: jest.fn(),
    isConnected: jest.fn().mockReturnValue(false),
    getStatus: jest.fn().mockResolvedValue({
      isOnline: false,
      pendingEvents: 0,
      activeConnections: 0,
    }),
  },
}));

// Mock Prisma client browser check
jest.mock('@/lib/prisma', () => {
  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    organization: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    product: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    order: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    customer: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    payment: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    warehouse: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    inventory: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    courier: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
    },
    userPreference: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    securityEvent: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    subscription: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    searchHistory: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    report: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
  };
  return { prisma: mockPrisma };
})

