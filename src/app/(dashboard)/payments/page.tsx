'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { 
  Plus, 
  Search, 
  Filter, 
  Download, 
  Eye,
  DollarSign,
  CreditCard,
  CheckCircle,
  Clock,
  XCircle,
  TrendingUp,
  Users,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatCurrency, formatDate, formatPhoneNumber } from '@/lib/utils';
import toast from 'react-hot-toast';

interface Payment {
  id: string;
  orderId: string;
  orderNumber: string;
  customer: {
    name: string;
    phone: string;
    email: string;
  };
  amount: number;
  method: 'COD' | 'ONLINE' | 'BANK_TRANSFER' | 'STRIPE' | 'PAYPAL' | 'PAYHERE';
  status: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'CANCELLED';
  transactionId: string;
  gateway: string;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
}

const statusColors = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  PAID: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
  REFUNDED: 'bg-gray-100 text-gray-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

const statusIcons = {
  PENDING: Clock,
  PAID: CheckCircle,
  FAILED: XCircle,
  REFUNDED: RefreshCw,
  CANCELLED: XCircle,
};

const methodIcons = {
  COD: DollarSign,
  ONLINE: CreditCard,
  BANK_TRANSFER: CreditCard,
  STRIPE: CreditCard,
  PAYPAL: CreditCard,
  PAYHERE: CreditCard,
};

export default function PaymentsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/auth/signin');
      return;
    }
    fetchPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, status, router]);

  const fetchPayments = async () => {
    try {
      const { fetchJSON } = await import('@/lib/api-client');
      const data = await fetchJSON<{ payments: Payment[] }>('/api/payments');
        setPayments(data.payments);
    } catch (error) {
      console.error('Error fetching payments:', error);
      toast.error('Failed to load payments');
    } finally {
      setLoading(false);
    }
  };

  const filteredPayments = payments.filter(payment => {
    const matchesSearch = 
      payment.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.customer.phone.includes(searchTerm) ||
      payment.transactionId.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = !statusFilter || payment.status === statusFilter;
    const matchesMethod = !methodFilter || payment.method === methodFilter;
    
    let matchesDate = true;
    if (dateFilter) {
      const paymentDate = new Date(payment.createdAt).toDateString();
      const today = new Date().toDateString();
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString();
      const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      
      switch (dateFilter) {
        case 'today':
          matchesDate = paymentDate === today;
          break;
        case 'yesterday':
          matchesDate = paymentDate === yesterday;
          break;
        case 'last7days':
          matchesDate = new Date(payment.createdAt) >= lastWeek;
          break;
        case 'last30days':
          matchesDate = new Date(payment.createdAt) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          break;
      }
    }
    
    return matchesSearch && matchesStatus && matchesMethod && matchesDate;
  });

  const handleExportCSV = () => {
    const headers = ['Order #', 'Customer', 'Amount', 'Method', 'Status', 'Transaction ID', 'Date'];
    const csvData = filteredPayments.map(payment => [
      payment.orderNumber,
      payment.customer.name,
      payment.amount,
      payment.method,
      payment.status,
      payment.transactionId,
      formatDate(payment.createdAt)
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payments-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getStats = () => {
    const total = payments.length;
    const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
    const paidAmount = payments.filter(p => p.status === 'PAID').reduce((sum, p) => sum + p.amount, 0);
    const pendingAmount = payments.filter(p => p.status === 'PENDING').reduce((sum, p) => sum + p.amount, 0);
    const successRate = total > 0 ? (payments.filter(p => p.status === 'PAID').length / total) * 100 : 0;

    return { total, totalAmount, paidAmount, pendingAmount, successRate };
  };

  const stats = getStats();

  const getStatusIcon = (status: string) => {
    const IconComponent = statusIcons[status as keyof typeof statusIcons];
    return IconComponent ? <IconComponent className="w-4 h-4" /> : null;
  };

  const getMethodIcon = (method: string) => {
    const IconComponent = methodIcons[method as keyof typeof methodIcons];
    return IconComponent ? <IconComponent className="w-4 h-4" /> : null;
  };

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="loading-spinner w-8 h-8"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
          <p className="text-gray-600">Track and manage payment transactions</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleExportCSV}
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button
            onClick={() => router.push('/payments/new')}
          >
            <Plus className="w-4 h-4 mr-2" />
            Record Payment
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Payments</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Collected</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.paidAmount)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.pendingAmount)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Success Rate</p>
              <p className="text-2xl font-bold text-gray-900">{stats.successRate.toFixed(1)}%</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Users className="w-6 h-6 text-indigo-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Amount</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalAmount)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search payments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="PAID">Paid</option>
            <option value="FAILED">Failed</option>
            <option value="REFUNDED">Refunded</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            <option value="">All Methods</option>
            <option value="COD">Cash on Delivery</option>
            <option value="ONLINE">Online Payment</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
            <option value="STRIPE">Stripe</option>
            <option value="PAYPAL">PayPal</option>
            <option value="PAYHERE">PayHere</option>
          </select>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            <option value="">All Dates</option>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="last7days">Last 7 Days</option>
            <option value="last30days">Last 30 Days</option>
          </select>
          <Button
            variant="outline"
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('');
              setMethodFilter('');
              setDateFilter('');
            }}
          >
            <Filter className="w-4 h-4 mr-2" />
            Clear Filters
          </Button>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Order
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Method
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Transaction ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredPayments.map((payment) => (
                <tr key={payment.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      #{payment.orderNumber}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {payment.customer.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {formatPhoneNumber(payment.customer.phone)}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {formatCurrency(payment.amount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {getMethodIcon(payment.method)}
                      <span className="ml-2 text-sm text-gray-900">
                        {payment.method.replace('_', ' ')}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[payment.status]}`}>
                      {getStatusIcon(payment.status)}
                      <span className="ml-1">{payment.status}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                    {payment.transactionId}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(payment.createdAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/payments/${payment.id}`)}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredPayments.length === 0 && !loading && (
        <div className="text-center py-12">
          <DollarSign className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No payments found</h3>
          <p className="text-gray-600 mb-4">
            {searchTerm || statusFilter || methodFilter || dateFilter 
              ? 'Try adjusting your filters or search terms'
              : 'Get started by recording your first payment'
            }
          </p>
          {!searchTerm && !statusFilter && !methodFilter && !dateFilter && (
            <Button onClick={() => router.push('/payments/new')}>
              <Plus className="w-4 h-4 mr-2" />
              Record Your First Payment
            </Button>
          )}
        </div>
      )}
    </div>
  );
} 