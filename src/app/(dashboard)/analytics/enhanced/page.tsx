'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  BarChart3,
  TrendingUp,
  Users,
  DollarSign,
  Package,
  ShoppingCart,
  Target,
  AlertTriangle,
  CheckCircle,
  Clock,
  Star,
  Brain,
  Zap,
  Lightbulb,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  PieChart,
  LineChart,
  Calendar,
  Filter,
  Download,
  RefreshCw,
  Eye,
  Settings
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatCurrency, formatDate, formatRelativeTime } from '@/lib/utils';
import toast from 'react-hot-toast';

interface AIInsight {
  id: string;
  type: 'opportunity' | 'risk' | 'trend' | 'recommendation';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  confidence: number;
  action?: string;
  value?: number;
  trend?: 'up' | 'down' | 'stable';
}

interface PredictiveMetric {
  metric: string;
  currentValue: number;
  predictedValue: number;
  confidence: number;
  trend: 'up' | 'down' | 'stable';
  factors: string[];
}

interface CustomerSegment {
  id: string;
  name: string;
  count: number;
  value: number;
  churnRisk: number;
  growthRate: number;
}

export default function EnhancedAnalyticsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30d');
  const [aiInsights, setAiInsights] = useState<AIInsight[]>([]);
  const [predictiveMetrics, setPredictiveMetrics] = useState<PredictiveMetric[]>([]);
  const [customerSegments, setCustomerSegments] = useState<CustomerSegment[]>([]);
  const [businessInsights, setBusinessInsights] = useState<any>({});

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/auth/signin');
      return;
    }
    fetchEnhancedAnalytics();
  }, [session, status, timeRange]);

  const fetchEnhancedAnalytics = async () => {
    try {
      setLoading(true);
      
      const [insightsRes, metricsRes, segmentsRes, insightsRes2] = await Promise.all([
        fetch(`/api/analytics/ai-insights?timeRange=${timeRange}`),
        fetch(`/api/analytics/predictive?timeRange=${timeRange}`),
        fetch(`/api/analytics/customer-segments?timeRange=${timeRange}`),
        fetch(`/api/analytics/business-insights?timeRange=${timeRange}`),
      ]);

      if (insightsRes.ok) {
        const insights = await insightsRes.json();
        setAiInsights(insights.insights);
      }

      if (metricsRes.ok) {
        const metrics = await metricsRes.json();
        setPredictiveMetrics(metrics.metrics);
      }

      if (segmentsRes.ok) {
        const segments = await segmentsRes.json();
        setCustomerSegments(segments.segments);
      }

      if (insightsRes2.ok) {
        const insights = await insightsRes2.json();
        setBusinessInsights(insights);
      }
    } catch (error) {
      console.error('Error fetching enhanced analytics:', error);
      toast.error('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'opportunity': return <Target className="w-5 h-5 text-green-600" />;
      case 'risk': return <AlertTriangle className="w-5 h-5 text-red-600" />;
      case 'trend': return <TrendingUp className="w-5 h-5 text-blue-600" />;
      case 'recommendation': return <Lightbulb className="w-5 h-5 text-yellow-600" />;
      default: return <Brain className="w-5 h-5 text-purple-600" />;
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'border-red-500 bg-red-50';
      case 'medium': return 'border-yellow-500 bg-yellow-50';
      case 'low': return 'border-green-500 bg-green-50';
      default: return 'border-gray-500 bg-gray-50';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <ArrowUpRight className="w-4 h-4 text-green-600" />;
      case 'down': return <ArrowDownRight className="w-4 h-4 text-red-600" />;
      default: return <Activity className="w-4 h-4 text-gray-600" />;
    }
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
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <Brain className="w-6 h-6 mr-2 text-purple-600" />
            AI-Powered Analytics
          </h1>
          <p className="text-gray-600">Advanced insights and predictive analytics powered by AI</p>
        </div>
        <div className="flex gap-2">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </select>
          <Button
            variant="outline"
            onClick={fetchEnhancedAnalytics}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button
            variant="outline"
            onClick={() => {/* Export functionality */}}
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* AI Insights Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Key Metrics */}
        <div className="lg:col-span-2 space-y-6">
          {/* Predictive Metrics */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Zap className="w-5 h-5 mr-2 text-yellow-600" />
              Predictive Analytics
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {predictiveMetrics.map((metric) => (
                <div key={metric.metric} className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-gray-900">{metric.metric}</h3>
                    {getTrendIcon(metric.trend)}
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-gray-900">
                      {formatCurrency(metric.currentValue)}
                    </span>
                    <span className="text-sm text-gray-500">
                      → {formatCurrency(metric.predictedValue)}
                    </span>
                  </div>
                  <div className="mt-2">
                    <div className="flex items-center gap-2">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${metric.confidence}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-gray-500">{metric.confidence}%</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      Confidence: {metric.confidence}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Customer Segments */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Users className="w-5 h-5 mr-2 text-blue-600" />
              Customer Segmentation
            </h2>
            <div className="space-y-4">
              {customerSegments.map((segment) => (
                <div key={segment.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{segment.name}</h3>
                    <p className="text-sm text-gray-600">
                      {segment.count} customers • {formatCurrency(segment.value)} value
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        {segment.growthRate > 0 ? '+' : ''}{segment.growthRate}%
                      </p>
                      <p className="text-xs text-gray-500">Growth</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        {segment.churnRisk}%
                      </p>
                      <p className="text-xs text-gray-500">Churn Risk</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* AI Insights Sidebar */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Brain className="w-5 h-5 mr-2 text-purple-600" />
              AI Insights
            </h2>
            <div className="space-y-4">
              {aiInsights.map((insight) => (
                <div
                  key={insight.id}
                  className={`p-4 border-l-4 rounded-r-lg ${getImpactColor(insight.impact)}`}
                >
                  <div className="flex items-start gap-3">
                    {getInsightIcon(insight.type)}
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{insight.title}</h3>
                      <p className="text-sm text-gray-600 mt-1">{insight.description}</p>
                      {insight.value && (
                        <p className="text-sm font-medium text-gray-900 mt-2">
                          Impact: {formatCurrency(insight.value)}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <div className="w-full bg-gray-200 rounded-full h-1">
                          <div
                            className="bg-blue-600 h-1 rounded-full"
                            style={{ width: `${insight.confidence}%` }}
                          ></div>
                        </div>
                        <span className="text-xs text-gray-500">{insight.confidence}%</span>
                      </div>
                      {insight.action && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          onClick={() => {/* Handle action */}}
                        >
                          {insight.action}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => router.push('/analytics/customer-insights')}
              >
                <Eye className="w-4 h-4 mr-2" />
                Customer Insights
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => router.push('/analytics/inventory-forecast')}
              >
                <Package className="w-4 h-4 mr-2" />
                Inventory Forecast
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => router.push('/analytics/revenue-prediction')}
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                Revenue Prediction
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => router.push('/analytics/ai-settings')}
              >
                <Settings className="w-4 h-4 mr-2" />
                AI Settings
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Business Intelligence */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Performance */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <BarChart3 className="w-5 h-5 mr-2 text-green-600" />
            Sales Performance
          </h2>
          {businessInsights.salesInsights && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(businessInsights.salesInsights.totalRevenue || 0)}
                  </p>
                  <p className="text-sm text-gray-600">Total Revenue</p>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">
                    {businessInsights.salesInsights.totalOrders || 0}
                  </p>
                  <p className="text-sm text-gray-600">Total Orders</p>
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-gray-900">Top Performing Products</h4>
                {(businessInsights.salesInsights.topProducts || []).slice(0, 3).map((product: any) => (
                  <div key={product.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span className="text-sm font-medium">{product.name}</span>
                    <span className="text-sm text-gray-600">{formatCurrency(product.revenue)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Customer Insights */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Users className="w-5 h-5 mr-2 text-blue-600" />
            Customer Insights
          </h2>
          {businessInsights.customerInsights && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <p className="text-2xl font-bold text-purple-600">
                    {businessInsights.customerInsights.totalCustomers || 0}
                  </p>
                  <p className="text-sm text-gray-600">Total Customers</p>
                </div>
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <p className="text-2xl font-bold text-yellow-600">
                    {formatCurrency(businessInsights.customerInsights.averageCLV || 0)}
                  </p>
                  <p className="text-sm text-gray-600">Avg. CLV</p>
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-gray-900">Customer Segments</h4>
                {(businessInsights.customerInsights.segments || []).slice(0, 3).map((segment: any) => (
                  <div key={segment.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span className="text-sm font-medium">{segment.name}</span>
                    <span className="text-sm text-gray-600">{segment.customerCount} customers</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Lightbulb className="w-5 h-5 mr-2 text-yellow-600" />
          AI Recommendations
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(businessInsights.recommendations || []).map((recommendation: string, index: number) => (
            <div key={index} className="p-4 border border-gray-200 rounded-lg">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                <p className="text-sm text-gray-700">{recommendation}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 