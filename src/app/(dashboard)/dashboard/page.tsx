'use client';

import { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  ShoppingCart, 
  Users, 
  Package,
  MessageSquare,
  Truck
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';

// Mock data - replace with real API calls
const mockStats = {
  totalRevenue: 125000,
  totalOrders: 1247,
  totalCustomers: 892,
  totalProducts: 156,
  revenueChange: 12.5,
  ordersChange: 8.2,
  customersChange: 15.3,
  productsChange: -2.1,
};

const mockRecentOrders = [
  {
    id: '1',
    orderNumber: 'ORD-123456',
    customer: 'John Doe',
    amount: 299.99,
    status: 'confirmed',
    date: '2024-01-15T10:30:00Z',
  },
  {
    id: '2',
    orderNumber: 'ORD-123457',
    customer: 'Jane Smith',
    amount: 149.50,
    status: 'packed',
    date: '2024-01-15T09:15:00Z',
  },
  {
    id: '3',
    orderNumber: 'ORD-123458',
    customer: 'Mike Johnson',
    amount: 89.99,
    status: 'delivered',
    date: '2024-01-15T08:45:00Z',
  },
  {
    id: '4',
    orderNumber: 'ORD-123459',
    customer: 'Sarah Wilson',
    amount: 199.99,
    status: 'out_for_delivery',
    date: '2024-01-15T08:00:00Z',
  },
];

const mockRecentChats = [
  {
    id: '1',
    customer: 'Alice Brown',
    message: 'I need help with my order #ORD-123456',
    channel: 'whatsapp',
    time: '2 minutes ago',
    unread: true,
  },
  {
    id: '2',
    customer: 'Bob Davis',
    message: 'Do you have red mugs in stock?',
    channel: 'facebook',
    time: '5 minutes ago',
    unread: false,
  },
  {
    id: '3',
    customer: 'Carol Evans',
    message: 'When will my order be delivered?',
    channel: 'instagram',
    time: '10 minutes ago',
    unread: true,
  },
];

const getStatusColor = (status: string) => {
  const colors = {
    draft: 'bg-gray-100 text-gray-800',
    confirmed: 'bg-blue-100 text-blue-800',
    packed: 'bg-yellow-100 text-yellow-800',
    out_for_delivery: 'bg-orange-100 text-orange-800',
    delivered: 'bg-green-100 text-green-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
  };
  return colors[status as keyof typeof colors] || colors.draft;
};

const getChannelIcon = (channel: string) => {
  const icons = {
    whatsapp: '💬',
    facebook: '📘',
    instagram: '📷',
    website: '🌐',
  };
  return icons[channel as keyof typeof icons] || '💬';
};

export default function DashboardPage() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => setIsLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-spinner w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-gray-600">
          Welcome back! Here's what's happening with your business today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Revenue */}
        <div className="dashboard-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="dashboard-label">Total Revenue</p>
              <p className="dashboard-stat">{formatCurrency(mockStats.totalRevenue)}</p>
              <div className="flex items-center mt-2">
                {mockStats.revenueChange > 0 ? (
                  <TrendingUp className="w-4 h-4 text-success-600 mr-1" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-danger-600 mr-1" />
                )}
                <span className={`dashboard-change ${
                  mockStats.revenueChange > 0 ? 'dashboard-change-positive' : 'dashboard-change-negative'
                }`}>
                  {mockStats.revenueChange > 0 ? '+' : ''}{mockStats.revenueChange}%
                </span>
                <span className="text-gray-500 text-sm ml-1">vs last month</span>
              </div>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        {/* Orders */}
        <div className="dashboard-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="dashboard-label">Total Orders</p>
              <p className="dashboard-stat">{mockStats.totalOrders.toLocaleString()}</p>
              <div className="flex items-center mt-2">
                {mockStats.ordersChange > 0 ? (
                  <TrendingUp className="w-4 h-4 text-success-600 mr-1" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-danger-600 mr-1" />
                )}
                <span className={`dashboard-change ${
                  mockStats.ordersChange > 0 ? 'dashboard-change-positive' : 'dashboard-change-negative'
                }`}>
                  {mockStats.ordersChange > 0 ? '+' : ''}{mockStats.ordersChange}%
                </span>
                <span className="text-gray-500 text-sm ml-1">vs last month</span>
              </div>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <ShoppingCart className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Customers */}
        <div className="dashboard-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="dashboard-label">Total Customers</p>
              <p className="dashboard-stat">{mockStats.totalCustomers.toLocaleString()}</p>
              <div className="flex items-center mt-2">
                {mockStats.customersChange > 0 ? (
                  <TrendingUp className="w-4 h-4 text-success-600 mr-1" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-danger-600 mr-1" />
                )}
                <span className={`dashboard-change ${
                  mockStats.customersChange > 0 ? 'dashboard-change-positive' : 'dashboard-change-negative'
                }`}>
                  {mockStats.customersChange > 0 ? '+' : ''}{mockStats.customersChange}%
                </span>
                <span className="text-gray-500 text-sm ml-1">vs last month</span>
              </div>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        {/* Products */}
        <div className="dashboard-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="dashboard-label">Total Products</p>
              <p className="dashboard-stat">{mockStats.totalProducts}</p>
              <div className="flex items-center mt-2">
                {mockStats.productsChange > 0 ? (
                  <TrendingUp className="w-4 h-4 text-success-600 mr-1" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-danger-600 mr-1" />
                )}
                <span className={`dashboard-change ${
                  mockStats.productsChange > 0 ? 'dashboard-change-positive' : 'dashboard-change-negative'
                }`}>
                  {mockStats.productsChange > 0 ? '+' : ''}{mockStats.productsChange}%
                </span>
                <span className="text-gray-500 text-sm ml-1">vs last month</span>
              </div>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <Package className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Orders */}
        <div className="card">
          <div className="card-header">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Recent Orders</h3>
              <a href="/dashboard/orders" className="text-sm text-primary-600 hover:text-primary-500">
                View all
              </a>
            </div>
          </div>
          <div className="card-body">
            <div className="space-y-4">
              {mockRecentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                      <ShoppingCart className="w-5 h-5 text-primary-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{order.orderNumber}</p>
                      <p className="text-sm text-gray-500">{order.customer}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">{formatCurrency(order.amount)}</p>
                    <span className={`badge ${getStatusColor(order.status)}`}>
                      {order.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Chats */}
        <div className="card">
          <div className="card-header">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Recent Chats</h3>
              <a href="/dashboard/chat" className="text-sm text-primary-600 hover:text-primary-500">
                View all
              </a>
            </div>
          </div>
          <div className="card-body">
            <div className="space-y-4">
              {mockRecentChats.map((chat) => (
                <div key={chat.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <MessageSquare className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <p className="font-medium text-gray-900 truncate">{chat.customer}</p>
                        <span className="text-lg">{getChannelIcon(chat.channel)}</span>
                        {chat.unread && (
                          <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 truncate">{chat.message}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">{chat.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <a
              href="/dashboard/orders/new"
              className="flex flex-col items-center p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <ShoppingCart className="w-8 h-8 text-blue-600 mb-2" />
              <span className="text-sm font-medium text-gray-900">New Order</span>
            </a>
            <a
              href="/dashboard/products/new"
              className="flex flex-col items-center p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
            >
              <Package className="w-8 h-8 text-green-600 mb-2" />
              <span className="text-sm font-medium text-gray-900">Add Product</span>
            </a>
            <a
              href="/dashboard/chat"
              className="flex flex-col items-center p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
            >
              <MessageSquare className="w-8 h-8 text-purple-600 mb-2" />
              <span className="text-sm font-medium text-gray-900">View Chats</span>
            </a>
            <a
              href="/dashboard/couriers"
              className="flex flex-col items-center p-4 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors"
            >
              <Truck className="w-8 h-8 text-orange-600 mb-2" />
              <span className="text-sm font-medium text-gray-900">Track Delivery</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
} 