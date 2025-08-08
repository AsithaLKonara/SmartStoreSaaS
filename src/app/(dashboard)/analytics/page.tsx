'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { 
  Download, 
  Calendar,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Package,
  ShoppingCart,
  BarChart3,
  PieChart,
  Activity,
  Target,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

interface AnalyticsData {
  revenue: {
    total: number;
    change: number;
    trend: 'up' | 'down';
  };
  orders: {
    total: number;
    change: number;
    trend: 'up' | 'down';
  };
  customers: {
    total: number;
    change: number;
    trend: 'up' | 'down';
  };
  products: {
    total: number;
    change: number;
    trend: 'up' | 'down';
  };
  salesByDay: Array<{
    date: string;
    revenue: number;
    orders: number;
  }>;
  topProducts: Array<{
    name: string;
    revenue: number;
    orders: number;
  }>;
  topCustomers: Array<{
    name: string;
    revenue: number;
    orders: number;
  }>;
  paymentMethods: Array<{
    method: string;
    amount: number;
    percentage: number;
  }>;
}

export default function AnalyticsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30');

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/auth/signin');
      return;
    }
    fetchAnalytics();
  }, [session, status, dateRange]);

  const fetchAnalytics = async () => {
    try {
      const response = await fetch(`/api/analytics?range=${dateRange}`);
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const handleExportReport = (type: string) => {
    toast.success(`${type} report exported successfully`);
    // In a real app, this would generate and download a PDF/Excel file
  };

  const getTrendIcon = (trend: 'up' | 'down') => {
    return trend === 'up' ? (
      <ArrowUpRight className="w-4 h-4 text-green-600" />
    ) : (
      <ArrowDownRight className="w-4 h-4 text-red-600" />
    );
  };

  const getTrendColor = (trend: 'up' | 'down') => {
    return trend === 'up' ? 'text-green-600' : 'text-red-600';
  };

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="loading-spinner w-8 h-8"></div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No analytics data available</h3>
          <p className="text-gray-600">Start creating orders and customers to see analytics</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-600">Business insights and performance metrics</p>
        </div>
        <div className="flex gap-2">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last year</option>
          </select>
          <Button
            variant="outline"
            onClick={() => handleExportReport('Sales')}
          >
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(analytics.revenue.total)}
              </p>
            </div>
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <div className="flex items-center mt-4">
            {getTrendIcon(analytics.revenue.trend)}
            <span className={`text-sm font-medium ml-1 ${getTrendColor(analytics.revenue.trend)}`}>
              {analytics.revenue.change}%
            </span>
            <span className="text-sm text-gray-500 ml-1">vs last period</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Orders</p>
              <p className="text-2xl font-bold text-gray-900">
                {analytics.orders.total}
              </p>
            </div>
            <div className="p-2 bg-blue-100 rounded-lg">
              <ShoppingCart className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <div className="flex items-center mt-4">
            {getTrendIcon(analytics.orders.trend)}
            <span className={`text-sm font-medium ml-1 ${getTrendColor(analytics.orders.trend)}`}>
              {analytics.orders.change}%
            </span>
            <span className="text-sm text-gray-500 ml-1">vs last period</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Customers</p>
              <p className="text-2xl font-bold text-gray-900">
                {analytics.customers.total}
              </p>
            </div>
            <div className="p-2 bg-purple-100 rounded-lg">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <div className="flex items-center mt-4">
            {getTrendIcon(analytics.customers.trend)}
            <span className={`text-sm font-medium ml-1 ${getTrendColor(analytics.customers.trend)}`}>
              {analytics.customers.change}%
            </span>
            <span className="text-sm text-gray-500 ml-1">vs last period</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Products</p>
              <p className="text-2xl font-bold text-gray-900">
                {analytics.products.total}
              </p>
            </div>
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Package className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
          <div className="flex items-center mt-4">
            {getTrendIcon(analytics.products.trend)}
            <span className={`text-sm font-medium ml-1 ${getTrendColor(analytics.products.trend)}`}>
              {analytics.products.change}%
            </span>
            <span className="text-sm text-gray-500 ml-1">vs last period</span>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Trend */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Sales Trend</h3>
            <Button variant="outline" size="sm">
              <TrendingUp className="w-4 h-4 mr-2" />
              View Details
            </Button>
          </div>
          <div className="h-64 flex items-end justify-between space-x-2">
            {analytics.salesByDay.map((day, index) => {
              const maxRevenue = Math.max(...analytics.salesByDay.map(d => d.revenue));
              const height = maxRevenue > 0 ? (day.revenue / maxRevenue) * 100 : 0;
              return (
                <div key={index} className="flex-1 flex flex-col items-center">
                  <div className="text-xs text-gray-500 mb-1">
                    {formatCurrency(day.revenue)}
                  </div>
                  <div 
                    className="w-full bg-primary rounded-t"
                    style={{ height: `${height}%` }}
                  ></div>
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Payment Methods */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Payment Methods</h3>
            <Button variant="outline" size="sm">
              <PieChart className="w-4 h-4 mr-2" />
              View Details
            </Button>
          </div>
          <div className="space-y-3">
            {analytics.paymentMethods.map((method, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center">
                  <div 
                    className="w-3 h-3 rounded-full mr-3"
                    style={{ backgroundColor: `hsl(${index * 60}, 70%, 50%)` }}
                  ></div>
                  <span className="text-sm font-medium text-gray-900">
                    {method.method}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900">
                    {formatCurrency(method.amount)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {method.percentage.toFixed(1)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Performers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Top Products</h3>
            <Button variant="outline" size="sm">
              <Target className="w-4 h-4 mr-2" />
              View All
            </Button>
          </div>
          <div className="space-y-4">
            {analytics.topProducts.map((product, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-medium text-gray-600 mr-3">
                    {index + 1}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {product.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {product.orders} orders
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900">
                    {formatCurrency(product.revenue)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Customers */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Top Customers</h3>
            <Button variant="outline" size="sm">
              <Users className="w-4 h-4 mr-2" />
              View All
            </Button>
          </div>
          <div className="space-y-4">
            {analytics.topCustomers.map((customer, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-medium text-gray-600 mr-3">
                    {index + 1}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {customer.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {customer.orders} orders
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900">
                    {formatCurrency(customer.revenue)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button
            variant="outline"
            onClick={() => handleExportReport('Sales')}
            className="h-20 flex flex-col items-center justify-center"
          >
            <BarChart3 className="w-6 h-6 mb-2" />
            <span>Sales Report</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => handleExportReport('Customer')}
            className="h-20 flex flex-col items-center justify-center"
          >
            <Users className="w-6 h-6 mb-2" />
            <span>Customer Report</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => handleExportReport('Inventory')}
            className="h-20 flex flex-col items-center justify-center"
          >
            <Package className="w-6 h-6 mb-2" />
            <span>Inventory Report</span>
          </Button>
        </div>
      </div>
    </div>
  );
} 