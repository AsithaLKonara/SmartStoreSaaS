'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Upload, Download, FileText, CheckCircle, XCircle, Clock, AlertTriangle,
  Users, Package, ShoppingCart, DollarSign, Settings, Plus, Eye, Trash2,
  BarChart3, Database, RefreshCw, Filter, Search, ArrowUpDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate, formatRelativeTime } from '@/lib/utils';
import toast from 'react-hot-toast';

interface BulkOperation {
  id: string;
  name: string;
  type: 'IMPORT' | 'EXPORT' | 'UPDATE' | 'DELETE';
  entity: 'PRODUCTS' | 'CUSTOMERS' | 'ORDERS' | 'INVENTORY' | 'EXPENSES';
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  progress: number;
  totalRecords: number;
  processedRecords: number;
  successCount: number;
  errorCount: number;
  fileUrl?: string;
  errorLog?: string[];
  createdAt: string;
  completedAt?: string;
}

interface OperationTemplate {
  id: string;
  name: string;
  description: string;
  type: string;
  entity: string;
  fields: string[];
  sampleFile: string;
}

export default function BulkOperationsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [operations, setOperations] = useState<BulkOperation[]>([]);
  const [templates, setTemplates] = useState<OperationTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'operations' | 'templates' | 'history'>('operations');
  const [selectedEntity, setSelectedEntity] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  useEffect(() => {
    if (!session?.user?.organizationId) {
      router.push('/signin');
      return;
    }
    fetchBulkOperationData();
  }, [session, router]);

  const fetchBulkOperationData = async () => {
    try {
      setLoading(true);
      const [operationsRes, templatesRes] = await Promise.all([
        fetch('/api/bulk-operations'),
        fetch('/api/bulk-operations/templates')
      ]);

      if (operationsRes.ok) {
        const operationsData = await operationsRes.json();
        setOperations(operationsData);
      }

      if (templatesRes.ok) {
        const templatesData = await templatesRes.json();
        setTemplates(templatesData);
      }
    } catch (error) {
      console.error('Error fetching bulk operation data:', error);
      toast.error('Failed to load bulk operation data');
    } finally {
      setLoading(false);
    }
  };

  const getEntityIcon = (entity: string) => {
    switch (entity) {
      case 'PRODUCTS': return <Package className="w-4 h-4" />;
      case 'CUSTOMERS': return <Users className="w-4 h-4" />;
      case 'ORDERS': return <ShoppingCart className="w-4 h-4" />;
      case 'INVENTORY': return <Database className="w-4 h-4" />;
      case 'EXPENSES': return <DollarSign className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const getEntityColor = (entity: string) => {
    switch (entity) {
      case 'PRODUCTS': return 'bg-blue-100 text-blue-800';
      case 'CUSTOMERS': return 'bg-purple-100 text-purple-800';
      case 'ORDERS': return 'bg-green-100 text-green-800';
      case 'INVENTORY': return 'bg-orange-100 text-orange-800';
      case 'EXPENSES': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'IMPORT': return <Upload className="w-4 h-4" />;
      case 'EXPORT': return <Download className="w-4 h-4" />;
      case 'UPDATE': return <RefreshCw className="w-4 h-4" />;
      case 'DELETE': return <Trash2 className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'text-yellow-600 bg-yellow-50';
      case 'PROCESSING': return 'text-blue-600 bg-blue-50';
      case 'COMPLETED': return 'text-green-600 bg-green-50';
      case 'FAILED': return 'text-red-600 bg-red-50';
      case 'CANCELLED': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING': return <Clock className="w-4 h-4" />;
      case 'PROCESSING': return <RefreshCw className="w-4 h-4" />;
      case 'COMPLETED': return <CheckCircle className="w-4 h-4" />;
      case 'FAILED': return <XCircle className="w-4 h-4" />;
      case 'CANCELLED': return <XCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const filteredOperations = operations.filter(operation => {
    const matchesEntity = selectedEntity === 'all' || operation.entity === selectedEntity;
    const matchesStatus = selectedStatus === 'all' || operation.status === selectedStatus;
    return matchesEntity && matchesStatus;
  });

  const getOperationStats = () => {
    const totalOperations = operations.length;
    const completedOperations = operations.filter(o => o.status === 'COMPLETED').length;
    const processingOperations = operations.filter(o => o.status === 'PROCESSING').length;
    const failedOperations = operations.filter(o => o.status === 'FAILED').length;

    return { totalOperations, completedOperations, processingOperations, failedOperations };
  };

  const stats = getOperationStats();

  const handleStartOperation = async (templateId: string, type: string) => {
    try {
      const response = await fetch('/api/bulk-operations/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          templateId,
          type,
        }),
      });

      if (response.ok) {
        toast.success('Bulk operation started');
        fetchBulkOperationData();
      } else {
        toast.error('Failed to start bulk operation');
      }
    } catch (error) {
      console.error('Error starting bulk operation:', error);
      toast.error('Failed to start bulk operation');
    }
  };

  const handleCancelOperation = async (operationId: string) => {
    try {
      const response = await fetch(`/api/bulk-operations/${operationId}/cancel`, {
        method: 'POST',
      });

      if (response.ok) {
        toast.success('Operation cancelled');
        fetchBulkOperationData();
      } else {
        toast.error('Failed to cancel operation');
      }
    } catch (error) {
      console.error('Error cancelling operation:', error);
      toast.error('Failed to cancel operation');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Database className="w-8 h-8 text-blue-600" />
            Bulk Operations
          </h1>
          <p className="text-gray-600 mt-2">Import, export, and manage data in bulk</p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => router.push('/bulk-operations/new')}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Operation
          </Button>
          <Button
            onClick={() => router.push('/bulk-operations/templates')}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <FileText className="w-4 h-4 mr-2" />
            Templates
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Operations</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalOperations}</p>
            </div>
            <Database className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-green-600">{stats.completedOperations}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Processing</p>
              <p className="text-2xl font-bold text-blue-600">{stats.processingOperations}</p>
            </div>
            <RefreshCw className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Failed</p>
              <p className="text-2xl font-bold text-red-600">{stats.failedOperations}</p>
            </div>
            <XCircle className="w-8 h-8 text-red-600" />
          </div>
        </div>
      </div>

      {/* Quick Operations */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h3 className="text-lg font-semibold mb-4">Quick Operations</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Button
            onClick={() => handleStartOperation('products-import', 'IMPORT')}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Upload className="w-4 h-4 mr-2" />
            Import Products
          </Button>
          <Button
            onClick={() => handleStartOperation('customers-export', 'EXPORT')}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Download className="w-4 h-4 mr-2" />
            Export Customers
          </Button>
          <Button
            onClick={() => handleStartOperation('inventory-update', 'UPDATE')}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Update Inventory
          </Button>
          <Button
            onClick={() => handleStartOperation('orders-export', 'EXPORT')}
            className="bg-orange-600 hover:bg-orange-700 text-white"
          >
            <Download className="w-4 h-4 mr-2" />
            Export Orders
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'operations', label: 'Active Operations', icon: RefreshCw },
              { id: 'templates', label: 'Templates', icon: FileText },
              { id: 'history', label: 'History', icon: BarChart3 }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'operations' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex gap-4">
                  <select
                    value={selectedEntity}
                    onChange={(e) => setSelectedEntity(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">All Entities</option>
                    <option value="PRODUCTS">Products</option>
                    <option value="CUSTOMERS">Customers</option>
                    <option value="ORDERS">Orders</option>
                    <option value="INVENTORY">Inventory</option>
                    <option value="EXPENSES">Expenses</option>
                  </select>
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">All Status</option>
                    <option value="PENDING">Pending</option>
                    <option value="PROCESSING">Processing</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="FAILED">Failed</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button className="bg-gray-600 hover:bg-gray-700 text-white">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </div>

              <div className="bg-white rounded-lg border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Operation
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Entity
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Progress
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Results
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Created
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredOperations.map((operation) => (
                        <tr key={operation.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{operation.name}</div>
                              <div className="text-sm text-gray-500">ID: {operation.id}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getEntityColor(operation.entity)}`}>
                              {getEntityIcon(operation.entity)}
                              <span className="ml-1">{operation.entity}</span>
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center text-sm text-gray-600">
                              {getTypeIcon(operation.type)}
                              <span className="ml-1">{operation.type}</span>
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(operation.status)}`}>
                              {getStatusIcon(operation.status)}
                              <span className="ml-1">{operation.status}</span>
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full"
                                style={{ width: `${operation.progress}%` }}
                              ></div>
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {operation.processedRecords} / {operation.totalRecords}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div className="flex gap-2">
                              <span className="text-green-600">✓ {operation.successCount}</span>
                              <span className="text-red-600">✗ {operation.errorCount}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatRelativeTime(operation.createdAt)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex gap-2">
                              <button
                                onClick={() => router.push(`/bulk-operations/${operation.id}`)}
                                className="text-blue-600 hover:text-blue-900"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              {operation.status === 'PROCESSING' && (
                                <button
                                  onClick={() => handleCancelOperation(operation.id)}
                                  className="text-red-600 hover:text-red-900"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                              )}
                              {operation.status === 'COMPLETED' && operation.fileUrl && (
                                <button className="text-green-600 hover:text-green-900">
                                  <Download className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'templates' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Operation Templates</h3>
                <Button
                  onClick={() => router.push('/bulk-operations/templates/new')}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  New Template
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {templates.map((template) => (
                  <div key={template.id} className="bg-white rounded-lg border p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-semibold text-gray-900">{template.name}</h4>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getEntityColor(template.entity)}`}>
                        {getEntityIcon(template.entity)}
                        <span className="ml-1">{template.entity}</span>
                      </span>
                    </div>
                    <div className="space-y-2 mb-4">
                      <p className="text-sm text-gray-600">{template.description}</p>
                      <div className="text-xs text-gray-500">
                        Type: {template.type}
                      </div>
                      <div className="text-xs text-gray-500">
                        Fields: {template.fields.join(', ')}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => router.push(`/bulk-operations/templates/${template.id}`)}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View
                      </Button>
                      <Button
                        onClick={() => handleStartOperation(template.id, 'IMPORT')}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        <Upload className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Operation History</h3>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                  <Download className="w-4 h-4 mr-2" />
                  Export History
                </Button>
              </div>

              <div className="bg-gray-50 rounded-lg p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-lg font-semibold mb-4">Recent Operations</h4>
                    <div className="space-y-3">
                      {operations.slice(0, 5).map((operation) => (
                        <div key={operation.id} className="flex items-center justify-between p-3 bg-white rounded border">
                          <div>
                            <p className="font-medium">{operation.name}</p>
                            <p className="text-sm text-gray-600">{operation.entity}</p>
                          </div>
                          <div className="text-right">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(operation.status)}`}>
                              {getStatusIcon(operation.status)}
                              <span className="ml-1">{operation.status}</span>
                            </span>
                            <p className="text-sm text-gray-600 mt-1">
                              {formatRelativeTime(operation.createdAt)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-lg font-semibold mb-4">Success Rate</h4>
                    <div className="space-y-3">
                      {['PRODUCTS', 'CUSTOMERS', 'ORDERS', 'INVENTORY', 'EXPENSES'].map((entity) => {
                        const entityOperations = operations.filter(o => o.entity === entity);
                        const completed = entityOperations.filter(o => o.status === 'COMPLETED').length;
                        const total = entityOperations.length;
                        const successRate = total > 0 ? (completed / total) * 100 : 0;

                        return (
                          <div key={entity} className="flex items-center justify-between p-3 bg-white rounded border">
                            <div className="flex items-center gap-2">
                              {getEntityIcon(entity)}
                              <span className="font-medium">{entity}</span>
                            </div>
                            <div className="text-right">
                              <p className="font-medium">{successRate.toFixed(1)}%</p>
                              <p className="text-sm text-gray-600">{completed}/{total}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 