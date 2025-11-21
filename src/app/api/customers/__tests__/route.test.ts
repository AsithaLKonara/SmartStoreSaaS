// @ts-nocheck
import { GET, POST, PUT, DELETE } from '../route';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';

// Mock NextRequest
class MockNextRequest {
  url: string;
  method: string;
  body: string;
  
  constructor(url: string, init?: any) {
    this.url = url;
    this.method = init?.method || 'GET';
    this.body = init?.body || '{}';
  }
  
  async json() {
    return JSON.parse(this.body);
  }
}

// Mock dependencies
jest.mock('@/lib/prisma', () => ({
  prisma: {
    customer: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));

describe('/api/customers', () => {
  const mockSession = {
    user: {
      id: 'user-1',
      organizationId: 'org-1',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getServerSession as jest.Mock).mockResolvedValue(mockSession);
  });

  describe('GET', () => {
    it('should return 401 for unauthorized requests', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: {} });

      const request = new MockNextRequest('http://localhost:3000/api/customers');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.message).toBe('Unauthorized');
    });

    it('should return customers list', async () => {
      const mockCustomers = [
        {
          id: 'customer-1',
          name: 'Test Customer',
          email: 'test@example.com',
          phone: '1234567890',
          orders: [],
        },
      ];
      (prisma.customer.findMany as jest.Mock).mockResolvedValue(mockCustomers);

      const request = new MockNextRequest('http://localhost:3000/api/customers');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.customers).toBeDefined();
      expect(data.customers[0].name).toBe('Test Customer');
    });

    it('should search customers', async () => {
      (prisma.customer.findMany as jest.Mock).mockResolvedValue([]);

      const request = new MockNextRequest('http://localhost:3000/api/customers?search=test');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(prisma.customer.findMany).toHaveBeenCalled();
    });

    it('should filter customers by tag', async () => {
      (prisma.customer.findMany as jest.Mock).mockResolvedValue([]);

      const request = new MockNextRequest('http://localhost:3000/api/customers?tag=VIP');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(prisma.customer.findMany).toHaveBeenCalled();
    });

    it('should calculate customer stats', async () => {
      const mockCustomers = [
        {
          id: 'customer-1',
          name: 'Test Customer',
          orders: [
            { totalAmount: 100, createdAt: new Date() },
            { totalAmount: 50, createdAt: new Date() },
          ],
        },
      ];
      (prisma.customer.findMany as jest.Mock).mockResolvedValue(mockCustomers);

      const request = new MockNextRequest('http://localhost:3000/api/customers');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.customers[0].totalSpent).toBe(150);
      expect(data.customers[0].orderCount).toBe(2);
    });
  });

  describe('POST', () => {
    it('should return 401 for unauthorized requests', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: {} });

      const request = new MockNextRequest('http://localhost:3000/api/customers', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test', email: 'test@example.com', phone: '123' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.message).toBe('Unauthorized');
    });

    it('should return 400 for missing required fields', async () => {
      const request = new MockNextRequest('http://localhost:3000/api/customers', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test' }), // Missing email and phone
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toBe('Name, email, and phone are required');
    });

    it('should return 409 for duplicate customer', async () => {
      (prisma.customer.findFirst as jest.Mock).mockResolvedValue({ id: 'existing-customer' });

      const request = new MockNextRequest('http://localhost:3000/api/customers', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Customer',
          email: 'test@example.com',
          phone: '1234567890',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.message).toBe('Customer with this email or phone already exists');
    });

    it('should create customer successfully', async () => {
      const mockCustomer = {
        id: 'customer-1',
        name: 'Test Customer',
        email: 'test@example.com',
        phone: '1234567890',
        organizationId: 'org-1',
      };

      (prisma.customer.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.customer.create as jest.Mock).mockResolvedValue(mockCustomer);

      const request = new MockNextRequest('http://localhost:3000/api/customers', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Customer',
          email: 'test@example.com',
          phone: '1234567890',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.customer).toBeDefined();
      expect(data.customer.name).toBe('Test Customer');
    });

    it('should ensure organization data isolation', async () => {
      (prisma.customer.findMany as jest.Mock).mockResolvedValue([]);

      const request = new MockNextRequest('http://localhost:3000/api/customers');
      await GET(request);

      expect(prisma.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: 'org-1',
          }),
        })
      );
    });
  });

  describe('PUT', () => {
    it('should return 401 for unauthorized requests', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: {} });

      const request = new MockNextRequest('http://localhost:3000/api/customers/customer-1', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Updated' }),
      });
      const response = await PUT(request, { params: { id: 'customer-1' } });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.message).toBe('Unauthorized');
    });

    it('should return 404 for non-existent customer', async () => {
      (prisma.customer.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new MockNextRequest('http://localhost:3000/api/customers/non-existent', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Updated' }),
      });
      const response = await PUT(request, { params: { id: 'non-existent' } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.message).toBe('Customer not found');
    });

    it('should update customer successfully', async () => {
      const mockCustomer = {
        id: 'customer-1',
        name: 'Updated Customer',
        organizationId: 'org-1',
      };

      (prisma.customer.findUnique as jest.Mock).mockResolvedValue(mockCustomer);
      (prisma.customer.update as jest.Mock).mockResolvedValue(mockCustomer);

      const request = new MockNextRequest('http://localhost:3000/api/customers/customer-1', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Updated Customer' }),
      });
      const response = await PUT(request, { params: { id: 'customer-1' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.customer.name).toBe('Updated Customer');
    });
  });

  describe('DELETE', () => {
    it('should return 401 for unauthorized requests', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: {} });

      const request = new MockNextRequest('http://localhost:3000/api/customers/customer-1', {
        method: 'DELETE',
      });
      const response = await DELETE(request, { params: { id: 'customer-1' } });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.message).toBe('Unauthorized');
    });

    it('should return 404 for non-existent customer', async () => {
      (prisma.customer.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new MockNextRequest('http://localhost:3000/api/customers/non-existent', {
        method: 'DELETE',
      });
      const response = await DELETE(request, { params: { id: 'non-existent' } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.message).toBe('Customer not found');
    });

    it('should delete customer successfully', async () => {
      const mockCustomer = {
        id: 'customer-1',
        organizationId: 'org-1',
      };

      (prisma.customer.findUnique as jest.Mock).mockResolvedValue(mockCustomer);
      (prisma.customer.delete as jest.Mock).mockResolvedValue(mockCustomer);

      const request = new MockNextRequest('http://localhost:3000/api/customers/customer-1', {
        method: 'DELETE',
      });
      const response = await DELETE(request, { params: { id: 'customer-1' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Customer deleted successfully');
    });
  });
});

