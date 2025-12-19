'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface RouteTest {
  path: string;
  method: string;
  category: string;
  description: string;
  requiresAuth: boolean;
  requiresBody?: boolean;
  sampleBody?: Record<string, unknown>;
}

const API_ROUTES: RouteTest[] = [
  // Analytics
  { path: '/api/analytics', method: 'GET', category: 'Analytics', description: 'Get analytics data', requiresAuth: true },
  { path: '/api/analytics/dashboard-stats', method: 'GET', category: 'Analytics', description: 'Get dashboard statistics', requiresAuth: true },
  
  // Products
  { path: '/api/products', method: 'GET', category: 'Products', description: 'List products', requiresAuth: true },
  { path: '/api/products', method: 'POST', category: 'Products', description: 'Create product', requiresAuth: true, requiresBody: true, sampleBody: { name: 'Test Product', price: 99.99, sku: 'TEST-001' } },
  { path: '/api/products/bulk-delete', method: 'POST', category: 'Products', description: 'Bulk delete products', requiresAuth: true, requiresBody: true, sampleBody: { productIds: ['1', '2'] } },
  
  // Orders
  { path: '/api/orders', method: 'GET', category: 'Orders', description: 'List orders', requiresAuth: true },
  { path: '/api/orders', method: 'POST', category: 'Orders', description: 'Create order', requiresAuth: true, requiresBody: true, sampleBody: { customerId: '1', items: [{ productId: '1', quantity: 1 }] } },
  { path: '/api/orders/recent', method: 'GET', category: 'Orders', description: 'Get recent orders', requiresAuth: true },
  
  // Payments
  { path: '/api/payments', method: 'GET', category: 'Payments', description: 'List payments', requiresAuth: true },
  { path: '/api/payments/stripe', method: 'POST', category: 'Payments', description: 'Stripe payment', requiresAuth: true, requiresBody: true, sampleBody: { amount: 100, currency: 'usd' } },
  { path: '/api/payments/paypal', method: 'POST', category: 'Payments', description: 'PayPal payment', requiresAuth: true, requiresBody: true, sampleBody: { amount: 100, currency: 'usd' } },
  { path: '/api/payments/crypto', method: 'POST', category: 'Payments', description: 'Crypto payment', requiresAuth: true, requiresBody: true, sampleBody: { amount: 100, currency: 'BTC' } },
  { path: '/api/payments/bnpl', method: 'POST', category: 'Payments', description: 'BNPL payment', requiresAuth: true, requiresBody: true, sampleBody: { amount: 100 } },
  { path: '/api/payments/advanced', method: 'GET', category: 'Payments', description: 'Advanced payments', requiresAuth: true },
  
  // Customers
  { path: '/api/customers', method: 'GET', category: 'Customers', description: 'List customers', requiresAuth: true },
  { path: '/api/customers', method: 'POST', category: 'Customers', description: 'Create customer', requiresAuth: true, requiresBody: true, sampleBody: { name: 'Test Customer', email: 'test@example.com' } },
  
  // Warehouses
  { path: '/api/warehouses', method: 'GET', category: 'Warehouses', description: 'List warehouses', requiresAuth: true },
  { path: '/api/warehouses', method: 'POST', category: 'Warehouses', description: 'Create warehouse', requiresAuth: true, requiresBody: true, sampleBody: { name: 'Test Warehouse', address: '123 Test St' } },
  { path: '/api/warehouses/inventory', method: 'GET', category: 'Warehouses', description: 'Get inventory', requiresAuth: true },
  { path: '/api/warehouses/movements', method: 'GET', category: 'Warehouses', description: 'Get movements', requiresAuth: true },
  { path: '/api/warehouses/movements', method: 'POST', category: 'Warehouses', description: 'Create movement', requiresAuth: true, requiresBody: true, sampleBody: { productId: '1', quantity: 10, type: 'IN' } },
  
  // Categories
  { path: '/api/categories', method: 'GET', category: 'Categories', description: 'List categories', requiresAuth: true },
  { path: '/api/categories', method: 'POST', category: 'Categories', description: 'Create category', requiresAuth: true, requiresBody: true, sampleBody: { name: 'Test Category' } },
  
  // Couriers
  { path: '/api/couriers', method: 'GET', category: 'Couriers', description: 'List couriers', requiresAuth: true },
  { path: '/api/couriers', method: 'POST', category: 'Couriers', description: 'Create courier', requiresAuth: true, requiresBody: true, sampleBody: { name: 'Test Courier', code: 'TEST' } },
  { path: '/api/couriers/deliveries', method: 'GET', category: 'Couriers', description: 'List deliveries', requiresAuth: true },
  { path: '/api/courier/track', method: 'GET', category: 'Couriers', description: 'Track shipment', requiresAuth: true },
  
  // Campaigns
  { path: '/api/campaigns', method: 'GET', category: 'Campaigns', description: 'List campaigns', requiresAuth: true },
  { path: '/api/campaigns', method: 'POST', category: 'Campaigns', description: 'Create campaign', requiresAuth: true, requiresBody: true, sampleBody: { name: 'Test Campaign', type: 'EMAIL' } },
  { path: '/api/campaigns/templates', method: 'GET', category: 'Campaigns', description: 'List templates', requiresAuth: true },
  
  // Reports
  { path: '/api/reports', method: 'GET', category: 'Reports', description: 'List reports', requiresAuth: true },
  { path: '/api/reports', method: 'POST', category: 'Reports', description: 'Create report', requiresAuth: true, requiresBody: true, sampleBody: { templateId: '1', dateRange: { start: '2024-01-01', end: '2024-12-31' } } },
  { path: '/api/reports/templates', method: 'GET', category: 'Reports', description: 'List templates', requiresAuth: true },
  
  // Expenses
  { path: '/api/expenses', method: 'GET', category: 'Expenses', description: 'List expenses', requiresAuth: true },
  { path: '/api/expenses', method: 'POST', category: 'Expenses', description: 'Create expense', requiresAuth: true, requiresBody: true, sampleBody: { amount: 100, category: 'Office', description: 'Test expense' } },
  
  // Bulk Operations
  { path: '/api/bulk-operations', method: 'GET', category: 'Bulk Operations', description: 'List operations', requiresAuth: true },
  { path: '/api/bulk-operations', method: 'POST', category: 'Bulk Operations', description: 'Create operation', requiresAuth: true, requiresBody: true, sampleBody: { type: 'IMPORT', file: 'test.csv' } },
  { path: '/api/bulk-operations/templates', method: 'GET', category: 'Bulk Operations', description: 'List templates', requiresAuth: true },
  
  // Chat
  { path: '/api/chat/conversations', method: 'GET', category: 'Chat', description: 'List conversations', requiresAuth: true },
  { path: '/api/chat/recent', method: 'GET', category: 'Chat', description: 'Get recent chats', requiresAuth: true },
  
  // Security
  { path: '/api/security', method: 'GET', category: 'Security', description: 'Get security info', requiresAuth: true },
  { path: '/api/security/threats', method: 'POST', category: 'Security', description: 'Report threat', requiresAuth: true, requiresBody: true, sampleBody: { type: 'threat', check: { type: 'SUSPICIOUS_ACTIVITY', severity: 'HIGH' } } },
  
  // Theme
  { path: '/api/theme', method: 'GET', category: 'Theme', description: 'Get theme', requiresAuth: true },
  { path: '/api/theme', method: 'POST', category: 'Theme', description: 'Update theme', requiresAuth: true, requiresBody: true, sampleBody: { action: 'update-config', config: { primaryColor: '#000000' } } },
  
  // Region
  { path: '/api/region', method: 'GET', category: 'Region', description: 'Get region config', requiresAuth: true },
  
  // Sync
  { path: '/api/sync/status', method: 'GET', category: 'Sync', description: 'Get sync status', requiresAuth: true },
  
  // Currency
  { path: '/api/currency/convert', method: 'GET', category: 'Currency', description: 'Convert currency', requiresAuth: true },
  
  // Voice
  { path: '/api/voice/search', method: 'POST', category: 'Voice', description: 'Voice search', requiresAuth: true, requiresBody: true, sampleBody: { query: 'find products' } },
  { path: '/api/voice/command', method: 'POST', category: 'Voice', description: 'Voice command', requiresAuth: true, requiresBody: true, sampleBody: { command: 'search products' } },
  
  // IoT
  { path: '/api/iot/devices', method: 'GET', category: 'IoT', description: 'List devices', requiresAuth: true },
  { path: '/api/iot/devices', method: 'POST', category: 'IoT', description: 'Register device', requiresAuth: true, requiresBody: true, sampleBody: { action: 'register', deviceId: 'device-1', deviceType: 'TEMPERATURE', name: 'Test Device' } },
  { path: '/api/iot/sensors', method: 'GET', category: 'IoT', description: 'Get sensor data', requiresAuth: true },
  
  // Blockchain
  { path: '/api/blockchain', method: 'POST', category: 'Blockchain', description: 'Blockchain operation', requiresAuth: true, requiresBody: true, sampleBody: { type: 'payment', action: 'create', orderId: '1', amount: 100, currency: 'ETH' } },
  
  // PWA
  { path: '/api/pwa', method: 'GET', category: 'PWA', description: 'Get PWA data', requiresAuth: true },
  { path: '/api/pwa', method: 'POST', category: 'PWA', description: 'PWA action', requiresAuth: true, requiresBody: true, sampleBody: { action: 'register-sync' } },
  
  // Gamification
  { path: '/api/gamification', method: 'GET', category: 'Gamification', description: 'Get gamification data', requiresAuth: true },
  { path: '/api/gamification', method: 'POST', category: 'Gamification', description: 'Gamification action', requiresAuth: true, requiresBody: true, sampleBody: { action: 'check-achievements' } },
  
  // Health
  { path: '/api/health', method: 'GET', category: 'Health', description: 'Health check', requiresAuth: false },
];

interface TestResult {
  route: RouteTest;
  status: 'pending' | 'running' | 'passed' | 'failed';
  statusCode?: number;
  response?: unknown;
  error?: string;
  duration?: number;
}

export default function TestHarnessPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [runningTests, setRunningTests] = useState<Set<string>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  const categories = ['All', ...Array.from(new Set(API_ROUTES.map(r => r.category)))];

  const filteredRoutes = selectedCategory === 'All' 
    ? API_ROUTES 
    : API_ROUTES.filter(r => r.category === selectedCategory);

  const testRoute = async (route: RouteTest) => {
    const key = `${route.method}:${route.path}`;
    setRunningTests(prev => new Set(prev).add(key));
    setTestResults(prev => ({
      ...prev,
      [key]: { route, status: 'running' }
    }));

    const startTime = Date.now();
    try {
      const options: RequestInit = {
        method: route.method,
        headers: {
          'Content-Type': 'application/json',
        },
      };

      if (route.requiresBody && route.sampleBody) {
        options.body = JSON.stringify(route.sampleBody);
      }

      const response = await fetch(route.path, options);
      const duration = Date.now() - startTime;
      const data = await response.json().catch(() => ({}));

      setTestResults(prev => ({
        ...prev,
        [key]: {
          route,
          status: response.ok ? 'passed' : 'failed',
          statusCode: response.status,
          response: data,
          duration,
        }
      }));
    } catch (error) {
      const duration = Date.now() - startTime;
      setTestResults(prev => ({
        ...prev,
        [key]: {
          route,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          duration,
        }
      }));
    } finally {
      setRunningTests(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const testAllRoutes = async () => {
    for (const route of filteredRoutes) {
      await testRoute(route);
      // Small delay to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  };

  const getStatusColor = (status: TestResult['status']) => {
    switch (status) {
      case 'passed': return 'text-green-600 bg-green-50';
      case 'failed': return 'text-red-600 bg-red-50';
      case 'running': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  if (status === 'loading') {
    return <div className="p-8">Loading...</div>;
  }

  if (!session) {
    return <div className="p-8">Please sign in to access the test harness.</div>;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">API Test Harness</h1>
        <p className="text-gray-600 mb-4">
          Test all API routes. This page allows you to test endpoints individually or run all tests.
        </p>
        
        <div className="flex gap-4 mb-6">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2 border rounded"
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          
          <button
            onClick={testAllRoutes}
            disabled={runningTests.size > 0}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            Test All ({filteredRoutes.length} routes)
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {filteredRoutes.map((route) => {
          const key = `${route.method}:${route.path}`;
          const result = testResults[key];
          const isRunning = runningTests.has(key);

          return (
            <div key={key} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-4">
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    route.method === 'GET' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                  }`}>
                    {route.method}
                  </span>
                  <span className="font-mono text-sm">{route.path}</span>
                  <span className="text-gray-500 text-sm">{route.description}</span>
                  <span className="px-2 py-1 rounded text-xs bg-gray-100">{route.category}</span>
                </div>
                
                <div className="flex items-center gap-2">
                  {result && (
                    <span className={`px-2 py-1 rounded text-xs ${getStatusColor(result.status)}`}>
                      {result.status === 'passed' && result.statusCode && `${result.statusCode}`}
                      {result.status === 'failed' && (result.statusCode ? `${result.statusCode}` : 'Error')}
                      {result.status === 'running' && 'Running...'}
                      {result.duration && ` (${result.duration}ms)`}
                    </span>
                  )}
                  <button
                    onClick={() => testRoute(route)}
                    disabled={isRunning}
                    className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
                  >
                    {isRunning ? 'Testing...' : 'Test'}
                  </button>
                </div>
              </div>

              {result && result.response ? (
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm text-gray-600">View Response</summary>
                  <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto max-h-40">
                    {JSON.stringify(result.response as unknown as Record<string, unknown> | unknown[], null, 2)}
                  </pre>
                </details>
              ) : null}

              {result && result.error && (
                <div className="mt-2 text-sm text-red-600">
                  Error: {result.error}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-8 p-4 bg-gray-100 rounded">
        <h2 className="font-semibold mb-2">Test Summary</h2>
        <div className="grid grid-cols-4 gap-4 text-sm">
          <div>
            <span className="font-semibold">Total:</span> {Object.keys(testResults).length}
          </div>
          <div>
            <span className="font-semibold text-green-600">Passed:</span>{' '}
            {Object.values(testResults).filter(r => r.status === 'passed').length}
          </div>
          <div>
            <span className="font-semibold text-red-600">Failed:</span>{' '}
            {Object.values(testResults).filter(r => r.status === 'failed').length}
          </div>
          <div>
            <span className="font-semibold text-blue-600">Running:</span>{' '}
            {runningTests.size}
          </div>
        </div>
      </div>
    </div>
  );
}

