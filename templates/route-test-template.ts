import { {{METHODS}} } from '../route';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
{{SERVICE_IMPORTS}}

// Mock NextRequest
class MockNextRequest {
  url: string;
  method: string;
  body: string;
  {{HEADERS_PROPERTY}}
  
  constructor(url: string, init?: { method?: string; body?: unknown{{HEADERS_PARAM}} }) {
    this.url = url;
    this.method = init?.method || 'GET';
    this.body = typeof init?.body === 'string' ? init.body : JSON.stringify(init?.body || {});
    {{HEADERS_INIT}}
  }
  
  async json() {
    return JSON.parse(this.body);
  }
  {{TEXT_METHOD}}
}

// Mock dependencies
jest.mock('@/lib/prisma', () => ({
  prisma: {
    {{PRISMA_MOCKS}}
  },
}));

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));

{{SERVICE_MOCKS}}

describe('{{ROUTE_PATH}}', () => {
  const mockSession = {
    user: {
      id: 'user-1',
      {{EMAIL_PROPERTY}}
      organizationId: 'org-1',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getServerSession as jest.Mock).mockResolvedValue(mockSession);
    {{SERVICE_CLEAR}}
  });

  {{GET_TESTS}}

  {{POST_TESTS}}

  {{PUT_TESTS}}

  {{DELETE_TESTS}}
});

