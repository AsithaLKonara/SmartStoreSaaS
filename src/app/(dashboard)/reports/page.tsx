'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  BarChart3, Download, Calendar, TrendingUp, DollarSign,
  Users, Package, FileText, Activity, Clock, CheckCircle,
  XCircle, Plus, Eye, Settings
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatRelativeTime } from '@/lib/utils';
import toast from 'react-hot-toast';

interface Report {
  id: string;
  name: string;
  type: 'SALES' | 'INVENTORY' | 'CUSTOMER' | 'FINANCIAL' | 'OPERATIONAL' | 'CUSTOM';
  status: 'GENERATING' | 'READY' | 'FAILED';
  format: 'PDF' | 'EXCEL' | 'CSV' | 'JSON';
  createdAt: string;
  downloadUrl?: string;
  size?: string;
}

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  type: string;
  category: string;
  isCustomizable: boolean;
  parameters: string[];
}

export default function ReportsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [reports, setReports] = useState<Report[]>([]);
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'reports' | 'templates' | 'scheduled'>('reports');
  const [selectedReportType, setSelectedReportType] = useState<string>('all');
  const [dateRange] = useState<string>('30d');

  useEffect(() => {
    if (!session?.user?.organizationId) {
      router.push('/signin');
      return;
    }
    fetchReportData();
  }, [session, router]);

  const fetchReportData = async () => {
    try {
      setLoading(true);
      const [reportsRes, templatesRes] = await Promise.all([
        fetch('/api/reports'),
        fetch('/api/reports/templates')
      ]);

      if (reportsRes.ok) {
        const reportsData = await reportsRes.json();
        setReports(reportsData);
      }

      if (templatesRes.ok) {
        const templatesData = await templatesRes.json();
        setTemplates(templatesData);
      }
    } catch (error) {
      console.error('Error fetching report data:', error);
      toast.error('Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  const getReportTypeIcon = (type: string) => {
    switch (type) {
      case 'SALES': return <TrendingUp className="w-4 h-4" />;
      case 'INVENTORY': return <Package className="w-4 h-4" />;
      case 'CUSTOMER': return <Users className="w-4 h-4" />;
      case 'FINANCIAL': return <DollarSign className="w-4 h-4" />;
      case 'OPERATIONAL': return <Activity className="w-4 h-4" />;
      case 'CUSTOM': return <FileText className="w-4 h-4" />;
      default: return <BarChart3 className="w-4 h-4" />;
    }
  };

  const getReportTypeColor = (type: string) => {
    switch (type) {
      case 'SALES': return 'bg-green-100 text-green-800';
      case 'INVENTORY': return 'bg-blue-100 text-blue-800';
      case 'CUSTOMER': return 'bg-purple-100 text-purple-800';
      case 'FINANCIAL': return 'bg-yellow-100 text-yellow-800';
      case 'OPERATIONAL': return 'bg-orange-100 text-orange-800';
      case 'CUSTOM': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'GENERATING': return 'text-yellow-600 bg-yellow-50';
      case 'READY': return 'text-green-600 bg-green-50';
      case 'FAILED': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'GENERATING': return <Clock className="w-4 h-4" />;
      case 'READY': return <CheckCircle className="w-4 h-4" />;
      case 'FAILED': return <XCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const filteredReports = reports.filter(report => {
    const matchesType = selectedReportType === 'all' || report.type === selectedReportType;
    return matchesType;
  });

  const getReportStats = () => {
    const totalReports = reports.length;
    const readyReports = reports.filter(r => r.status === 'READY').length;
    const generatingReports = reports.filter(r => r.status === 'GENERATING').length;
    const failedReports = reports.filter(r => r.status === 'FAILED').length;

    return { totalReports, readyReports, generatingReports, failedReports };
  };

  const stats = getReportStats();

  const handleGenerateReport = async (templateId: string) => {
    try {
      const response = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          templateId,
          dateRange,
          format: 'PDF',
        }),
      });

      if (response.ok) {
        toast.success('Report generation started');
        fetchReportData();
      } else {
        toast.error('Failed to generate report');
      }
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error('Failed to generate report');
    }
  };

  const handleDownloadReport = async (reportId: string) => {
    try {
      const response = await fetch(`/api/reports/${reportId}/download`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `report-${reportId}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success('Report downloaded successfully');
      } else {
        toast.error('Failed to download report');
      }
    } catch (error) {
      console.error('Error downloading report:', error);
      toast.error('Failed to download report');
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
            <BarChart3 className="w-8 h-8 text-blue-600" />
            Advanced Reporting
          </h1>
          <p className="text-gray-600 mt-2">Generate comprehensive business reports and analytics</p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => router.push('/reports/new')}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Report
          </Button>
          <Button
            onClick={() => router.push('/reports/schedule')}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Calendar className="w-4 h-4 mr-2" />
            Schedule Report
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Reports</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalReports}</p>
            </div>
            <BarChart3 className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Ready Reports</p>
              <p className="text-2xl font-bold text-green-600">{stats.readyReports}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Generating</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.generatingReports}</p>
            </div>
            <Clock className="w-8 h-8 text-yellow-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Failed</p>
              <p className="text-2xl font-bold text-red-600">{stats.failedReports}</p>
            </div>
            <XCircle className="w-8 h-8 text-red-600" />
          </div>
        </div>
      </div>

      {/* Quick Report Generation */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h3 className="text-lg font-semibold mb-4">Quick Report Generation</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Button
            onClick={() => handleGenerateReport('sales-summary')}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <TrendingUp className="w-4 h-4 mr-2" />
            Sales Summary
          </Button>
          <Button
            onClick={() => handleGenerateReport('inventory-status')}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Package className="w-4 h-4 mr-2" />
            Inventory Status
          </Button>
          <Button
            onClick={() => handleGenerateReport('customer-analytics')}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            <Users className="w-4 h-4 mr-2" />
            Customer Analytics
          </Button>
          <Button
            onClick={() => handleGenerateReport('financial-overview')}
            className="bg-yellow-600 hover:bg-yellow-700 text-white"
          >
            <DollarSign className="w-4 h-4 mr-2" />
            Financial Overview
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'reports', label: 'Generated Reports', icon: FileText },
              { id: 'templates', label: 'Report Templates', icon: BarChart3 },
              { id: 'scheduled', label: 'Scheduled Reports', icon: Calendar }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as 'reports' | 'templates' | 'scheduled')}
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
          {activeTab === 'reports' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex gap-4">
                  <select
                    value={selectedReportType}
                    onChange={(e) => setSelectedReportType(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">All Types</option>
                    <option value="SALES">Sales</option>
                    <option value="INVENTORY">Inventory</option>
                    <option value="CUSTOMER">Customer</option>
                    <option value="FINANCIAL">Financial</option>
                    <option value="OPERATIONAL">Operational</option>
                    <option value="CUSTOM">Custom</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button className="bg-gray-600 hover:bg-gray-700 text-white">
                    <Download className="w-4 h-4 mr-2" />
                    Export All
                  </Button>
                </div>
              </div>

              <div className="bg-white rounded-lg border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Report
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Format
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
                      {filteredReports.map((report) => (
                        <tr key={report.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{report.name}</div>
                              {report.size && (
                                <div className="text-sm text-gray-500">Size: {report.size}</div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getReportTypeColor(report.type)}`}>
                              {getReportTypeIcon(report.type)}
                              <span className="ml-1">{report.type}</span>
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(report.status)}`}>
                              {getStatusIcon(report.status)}
                              <span className="ml-1">{report.status}</span>
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {report.format}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatRelativeTime(report.createdAt)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex gap-2">
                              {report.status === 'READY' && (
                                <button
                                  onClick={() => handleDownloadReport(report.id)}
                                  className="text-blue-600 hover:text-blue-900"
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => router.push(`/reports/${report.id}`)}
                                className="text-green-600 hover:text-green-900"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button className="text-red-600 hover:text-red-900">
                                <XCircle className="w-4 h-4" />
                              </button>
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
                <h3 className="text-lg font-semibold">Report Templates</h3>
                <Button
                  onClick={() => router.push('/reports/templates/new')}
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
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getReportTypeColor(template.type)}`}>
                        {getReportTypeIcon(template.type)}
                        <span className="ml-1">{template.type}</span>
                      </span>
                    </div>
                    <div className="space-y-2 mb-4">
                      <p className="text-sm text-gray-600">{template.description}</p>
                      <div className="text-xs text-gray-500">
                        Category: {template.category}
                      </div>
                      <div className="text-xs text-gray-500">
                        Parameters: {template.parameters.join(', ')}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleGenerateReport(template.id)}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <BarChart3 className="w-4 h-4 mr-2" />
                        Generate
                      </Button>
                      <Button className="bg-green-600 hover:bg-green-700 text-white">
                        <Settings className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'scheduled' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Scheduled Reports</h3>
                <Button
                  onClick={() => router.push('/reports/schedule')}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Schedule Report
                </Button>
              </div>

              <div className="bg-gray-50 rounded-lg p-6 text-center">
                <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h4 className="text-lg font-medium text-gray-900 mb-2">No Scheduled Reports</h4>
                <p className="text-gray-600 mb-4">
                  Schedule reports to be generated automatically at regular intervals.
                </p>
                <Button
                  onClick={() => router.push('/reports/schedule')}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  Schedule Your First Report
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 