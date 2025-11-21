'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Mail,
  MessageSquare,
  Smartphone,
  Bell,
  Plus,
  Search,
  Pause,
  Edit,
  Trash2,
  Eye,
  BarChart3,
  Users,
  Send,
  Clock,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  Settings,
  Copy,
  Download
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

interface Campaign {
  id: string;
  name: string;
  type: 'EMAIL' | 'SMS' | 'WHATSAPP' | 'PUSH_NOTIFICATION';
  status: 'DRAFT' | 'SCHEDULED' | 'SENDING' | 'SENT' | 'CANCELLED';
  content: string;
  settings: any;
  sentAt?: string;
  createdAt: string;
  updatedAt: string;
  stats?: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
  };
}

interface CampaignTemplate {
  id: string;
  name: string;
  type: 'EMAIL' | 'SMS' | 'WHATSAPP' | 'PUSH_NOTIFICATION';
  content: string;
  variables: string[];
  createdAt: string;
}

export default function CampaignsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<CampaignTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'campaigns' | 'templates' | 'analytics'>('campaigns');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    if (!session?.user?.organizationId) {
      router.push('/signin');
      return;
    }
    fetchCampaignData();
  }, [session, router]);

  const fetchCampaignData = async () => {
    try {
      setLoading(true);
      const [campaignsRes, templatesRes] = await Promise.all([
        fetch('/api/campaigns'),
        fetch('/api/campaigns/templates')
      ]);

      if (campaignsRes.ok) {
        const campaignsData = await campaignsRes.json();
        setCampaigns(campaignsData);
      }

      if (templatesRes.ok) {
        const templatesData = await templatesRes.json();
        setTemplates(templatesData);
      }
    } catch (error) {
      console.error('Error fetching campaign data:', error);
      toast.error('Failed to load campaign data');
    } finally {
      setLoading(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'EMAIL': return <Mail className="w-4 h-4" />;
      case 'SMS': return <Smartphone className="w-4 h-4" />;
      case 'WHATSAPP': return <MessageSquare className="w-4 h-4" />;
      case 'PUSH_NOTIFICATION': return <Bell className="w-4 h-4" />;
      default: return <Mail className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'EMAIL': return 'bg-blue-100 text-blue-800';
      case 'SMS': return 'bg-green-100 text-green-800';
      case 'WHATSAPP': return 'bg-green-100 text-green-800';
      case 'PUSH_NOTIFICATION': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'bg-gray-100 text-gray-800';
      case 'SCHEDULED': return 'bg-yellow-100 text-yellow-800';
      case 'SENDING': return 'bg-blue-100 text-blue-800';
      case 'SENT': return 'bg-green-100 text-green-800';
      case 'CANCELLED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'DRAFT': return <Edit className="w-4 h-4" />;
      case 'SCHEDULED': return <Clock className="w-4 h-4" />;
      case 'SENDING': return <Send className="w-4 h-4" />;
      case 'SENT': return <CheckCircle className="w-4 h-4" />;
      case 'CANCELLED': return <AlertTriangle className="w-4 h-4" />;
      default: return <Edit className="w-4 h-4" />;
    }
  };

  const filteredCampaigns = campaigns.filter(campaign => {
    const matchesSearch = campaign.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || campaign.type === filterType;
    const matchesStatus = filterStatus === 'all' || campaign.status === filterStatus;
    return matchesSearch && matchesType && matchesStatus;
  });

  const getCampaignStats = () => {
    const totalCampaigns = campaigns.length;
    const activeCampaigns = campaigns.filter(c => c.status === 'SENDING').length;
    const sentCampaigns = campaigns.filter(c => c.status === 'SENT').length;
    const totalSent = campaigns.reduce((sum, c) => sum + (c.stats?.sent || 0), 0);

    return { totalCampaigns, activeCampaigns, sentCampaigns, totalSent };
  };

  const stats = getCampaignStats();

  const handleCampaignAction = async (campaignId: string, action: string) => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/${action}`, {
        method: 'POST',
      });

      if (response.ok) {
        toast.success(`Campaign ${action} successful`);
        fetchCampaignData();
      } else {
        toast.error(`Failed to ${action} campaign`);
      }
    } catch (error) {
      console.error(`Error ${action}ing campaign:`, error);
      toast.error(`Failed to ${action} campaign`);
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
            Campaign Management
          </h1>
          <p className="text-gray-600 mt-2">Create and manage marketing campaigns across multiple channels</p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => router.push('/campaigns/new')}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Campaign
          </Button>
          <Button
            onClick={() => router.push('/campaigns/templates/new')}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Copy className="w-4 h-4 mr-2" />
            New Template
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Campaigns</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalCampaigns}</p>
            </div>
            <BarChart3 className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Campaigns</p>
              <p className="text-2xl font-bold text-blue-600">{stats.activeCampaigns}</p>
            </div>
            <Send className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Sent Campaigns</p>
              <p className="text-2xl font-bold text-green-600">{stats.sentCampaigns}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Sent</p>
              <p className="text-2xl font-bold text-purple-600">{stats.totalSent.toLocaleString()}</p>
            </div>
            <Users className="w-8 h-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'campaigns', label: 'Campaigns', icon: BarChart3 },
              { id: 'templates', label: 'Templates', icon: Copy },
              { id: 'analytics', label: 'Analytics', icon: TrendingUp }
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
          {activeTab === 'campaigns' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Search campaigns..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">All Types</option>
                    <option value="EMAIL">Email</option>
                    <option value="SMS">SMS</option>
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="PUSH_NOTIFICATION">Push Notification</option>
                  </select>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">All Status</option>
                    <option value="DRAFT">Draft</option>
                    <option value="SCHEDULED">Scheduled</option>
                    <option value="SENDING">Sending</option>
                    <option value="SENT">Sent</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button className="bg-gray-600 hover:bg-gray-700 text-white">
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </Button>
                </div>
              </div>

              <div className="bg-white rounded-lg border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Campaign
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Stats
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
                      {filteredCampaigns.map((campaign) => (
                        <tr key={campaign.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{campaign.name}</div>
                              <div className="text-sm text-gray-500">{campaign.content.substring(0, 50)}...</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeColor(campaign.type)}`}>
                              {getTypeIcon(campaign.type)}
                              <span className="ml-1">{campaign.type.replace('_', ' ')}</span>
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(campaign.status)}`}>
                              {getStatusIcon(campaign.status)}
                              <span className="ml-1">{campaign.status}</span>
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {campaign.stats ? (
                              <div>
                                <div>Sent: {campaign.stats.sent}</div>
                                <div>Opened: {campaign.stats.opened}</div>
                              </div>
                            ) : (
                              <span className="text-gray-500">No stats</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(campaign.createdAt)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex gap-2">
                              <button 
                                onClick={() => router.push(`/campaigns/${campaign.id}`)}
                                className="text-blue-600 hover:text-blue-900"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => router.push(`/campaigns/${campaign.id}/edit`)}
                                className="text-green-600 hover:text-green-900"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              {campaign.status === 'DRAFT' && (
                                <button 
                                  onClick={() => handleCampaignAction(campaign.id, 'send')}
                                  className="text-blue-600 hover:text-blue-900"
                                >
                                  <Send className="w-4 h-4" />
                                </button>
                              )}
                              {campaign.status === 'SCHEDULED' && (
                                <button 
                                  onClick={() => handleCampaignAction(campaign.id, 'pause')}
                                  className="text-yellow-600 hover:text-yellow-900"
                                >
                                  <Pause className="w-4 h-4" />
                                </button>
                              )}
                              <button className="text-red-600 hover:text-red-900">
                                <Trash2 className="w-4 h-4" />
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
                <h3 className="text-lg font-semibold">Campaign Templates</h3>
                <Button
                  onClick={() => router.push('/campaigns/templates/new')}
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
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeColor(template.type)}`}>
                        {getTypeIcon(template.type)}
                        <span className="ml-1">{template.type.replace('_', ' ')}</span>
                      </span>
                    </div>
                    <div className="space-y-2 mb-4">
                      <p className="text-sm text-gray-600 line-clamp-3">{template.content}</p>
                      <div className="text-xs text-gray-500">
                        Variables: {template.variables.join(', ')}
                      </div>
                      <div className="text-xs text-gray-500">
                        Created: {formatDate(template.createdAt)}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">
                        <Eye className="w-4 h-4 mr-2" />
                        View
                      </Button>
                      <Button className="bg-green-600 hover:bg-green-700 text-white">
                        <Copy className="w-4 h-4 mr-2" />
                        Use
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">Campaign Analytics</h3>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-gray-50 rounded-lg p-6">
                  <h4 className="text-lg font-semibold mb-4">Campaign Performance</h4>
                  <div className="space-y-4">
                    {campaigns.slice(0, 5).map((campaign) => (
                      <div key={campaign.id} className="flex items-center justify-between p-3 bg-white rounded border">
                        <div>
                          <p className="font-medium">{campaign.name}</p>
                          <p className="text-sm text-gray-600">{campaign.type}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{campaign.stats?.sent || 0} sent</p>
                          <p className="text-sm text-gray-600">
                            {campaign.stats?.opened ? Math.round((campaign.stats.opened / campaign.stats.sent) * 100) : 0}% open rate
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-6">
                  <h4 className="text-lg font-semibold mb-4">Channel Performance</h4>
                  <div className="space-y-4">
                    {['EMAIL', 'SMS', 'WHATSAPP', 'PUSH_NOTIFICATION'].map((type) => {
                      const typeCampaigns = campaigns.filter(c => c.type === type);
                      const totalSent = typeCampaigns.reduce((sum, c) => sum + (c.stats?.sent || 0), 0);
                      const totalOpened = typeCampaigns.reduce((sum, c) => sum + (c.stats?.opened || 0), 0);
                      
                      return (
                        <div key={type} className="flex items-center justify-between p-3 bg-white rounded border">
                          <div className="flex items-center gap-2">
                            {getTypeIcon(type)}
                            <span className="font-medium">{type.replace('_', ' ')}</span>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{totalSent.toLocaleString()}</p>
                            <p className="text-sm text-gray-600">
                              {totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0}% engagement
                            </p>
                          </div>
                        </div>
                      );
                    })}
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