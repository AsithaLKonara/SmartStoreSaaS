'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Truck, Clock, User, Plus, Search,
  Download, CheckCircle, XCircle,
  BarChart3, Edit, Eye, Navigation, Route, Package,
  DollarSign, Star, Wifi, WifiOff
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatCurrency, formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

interface Courier {
  id: string;
  name: string;
  email: string;
  phone: string;
  vehicleType: 'MOTORCYCLE' | 'CAR' | 'VAN' | 'TRUCK';
  vehicleNumber: string;
  status: 'ACTIVE' | 'INACTIVE' | 'BUSY' | 'OFFLINE';
  currentLocation?: {
    latitude: number;
    longitude: number;
    address: string;
  };
  rating: number;
  totalDeliveries: number;
  totalEarnings: number;
  isOnline: boolean;
  lastSeen: string;
  createdAt: string;
  updatedAt: string;
}

interface Delivery {
  id: string;
  orderNumber: string;
  customerName: string;
  pickupAddress: string;
  deliveryAddress: string;
  status: 'ASSIGNED' | 'PICKED_UP' | 'IN_TRANSIT' | 'DELIVERED' | 'FAILED';
  assignedCourierId?: string;
  assignedCourierName?: string;
  estimatedDeliveryTime: string;
  actualDeliveryTime?: string;
  distance: number;
  earnings: number;
  createdAt: string;
}

export default function CouriersPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'couriers' | 'deliveries' | 'analytics'>('couriers');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    const organizationId = (session?.user as { organizationId?: string } | null)?.organizationId;
    if (!organizationId) {
      router.push('/auth/signin');
      return;
    }
    fetchCourierData();
  }, [session, router]);

  const fetchCourierData = async () => {
    try {
      setLoading(true);
      const [couriersRes, deliveriesRes] = await Promise.all([
        fetch('/api/couriers'),
        fetch('/api/couriers/deliveries')
      ]);

      if (couriersRes.ok) {
        const couriersData = await couriersRes.json();
        setCouriers(couriersData);
      }

      if (deliveriesRes.ok) {
        const deliveriesData = await deliveriesRes.json();
        setDeliveries(deliveriesData);
      }
    } catch (error) {
      console.error('Error fetching courier data:', error);
      toast.error('Failed to load courier data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'text-green-600 bg-green-50';
      case 'BUSY': return 'text-yellow-600 bg-yellow-50';
      case 'INACTIVE': return 'text-gray-600 bg-gray-50';
      case 'OFFLINE': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ACTIVE': return <CheckCircle className="w-4 h-4" />;
      case 'BUSY': return <Clock className="w-4 h-4" />;
      case 'INACTIVE': return <XCircle className="w-4 h-4" />;
      case 'OFFLINE': return <WifiOff className="w-4 h-4" />;
      default: return <User className="w-4 h-4" />;
    }
  };

  const getDeliveryStatusColor = (status: string) => {
    switch (status) {
      case 'ASSIGNED': return 'text-blue-600 bg-blue-50';
      case 'PICKED_UP': return 'text-yellow-600 bg-yellow-50';
      case 'IN_TRANSIT': return 'text-purple-600 bg-purple-50';
      case 'DELIVERED': return 'text-green-600 bg-green-50';
      case 'FAILED': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const filteredCouriers = couriers.filter(courier => {
    const matchesSearch = courier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         courier.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || courier.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const getCourierStats = () => {
    const totalCouriers = couriers.length;
    const activeCouriers = couriers.filter(c => c.status === 'ACTIVE').length;
    const onlineCouriers = couriers.filter(c => c.isOnline).length;
    const totalEarnings = couriers.reduce((sum, c) => sum + c.totalEarnings, 0);

    return { totalCouriers, activeCouriers, onlineCouriers, totalEarnings };
  };

  const stats = getCourierStats();

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
            <Truck className="w-8 h-8 text-blue-600" />
            Courier Management
          </h1>
          <p className="text-gray-600 mt-2">Manage delivery partners, track deliveries, and optimize routes</p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => router.push('/couriers/new')}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Courier
          </Button>
          <Button
            onClick={() => router.push('/couriers/routes/optimize')}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Route className="w-4 h-4 mr-2" />
            Optimize Routes
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Couriers</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalCouriers}</p>
            </div>
            <Truck className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Couriers</p>
              <p className="text-2xl font-bold text-green-600">{stats.activeCouriers}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Online Now</p>
              <p className="text-2xl font-bold text-blue-600">{stats.onlineCouriers}</p>
            </div>
            <Wifi className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Earnings</p>
              <p className="text-2xl font-bold text-purple-600">{formatCurrency(stats.totalEarnings)}</p>
            </div>
            <DollarSign className="w-8 h-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'couriers', label: 'Couriers', icon: User },
              { id: 'deliveries', label: 'Deliveries', icon: Package },
              { id: 'analytics', label: 'Analytics', icon: BarChart3 }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as 'couriers' | 'deliveries' | 'analytics')}
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
          {activeTab === 'couriers' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Search couriers..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">All Status</option>
                    <option value="ACTIVE">Active</option>
                    <option value="BUSY">Busy</option>
                    <option value="INACTIVE">Inactive</option>
                    <option value="OFFLINE">Offline</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button className="bg-gray-600 hover:bg-gray-700 text-white">
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCouriers.map((courier) => (
                  <div key={courier.id} className="bg-white rounded-lg border p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                          <User className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                          <h4 className="text-lg font-semibold text-gray-900">{courier.name}</h4>
                          <p className="text-sm text-gray-600">{courier.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${courier.isOnline ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <span className="text-sm">{courier.isOnline ? 'Online' : 'Offline'}</span>
                      </div>
                    </div>

                    <div className="space-y-3 mb-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Phone:</span>
                        <span className="font-medium">{courier.phone}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Vehicle:</span>
                        <span className="font-medium">{courier.vehicleType} - {courier.vehicleNumber}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Status:</span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(courier.status)}`}>
                          {getStatusIcon(courier.status)}
                          <span className="ml-1">{courier.status}</span>
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Rating:</span>
                        <span className="font-medium flex items-center gap-1">
                          <Star className="w-4 h-4 text-yellow-500 fill-current" />
                          {courier.rating.toFixed(1)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Deliveries:</span>
                        <span className="font-medium">{courier.totalDeliveries}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Earnings:</span>
                        <span className="font-medium">{formatCurrency(courier.totalEarnings)}</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={() => router.push(`/couriers/${courier.id}`)}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View
                      </Button>
                      <Button
                        onClick={() => router.push(`/couriers/${courier.id}/edit`)}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        onClick={() => router.push(`/couriers/${courier.id}/track`)}
                        className="bg-purple-600 hover:bg-purple-700 text-white"
                      >
                        <Navigation className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'deliveries' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Active Deliveries</h3>
                <Button
                  onClick={() => router.push('/couriers/deliveries/assign')}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Assign Delivery
                </Button>
              </div>

              <div className="bg-white rounded-lg border overflow-hidden">
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
                          Courier
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Distance
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Earnings
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          ETA
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {deliveries.map((delivery) => (
                        <tr key={delivery.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{delivery.orderNumber}</div>
                            <div className="text-sm text-gray-500">{formatDate(delivery.createdAt)}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {delivery.customerName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {delivery.assignedCourierName || 'Unassigned'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getDeliveryStatusColor(delivery.status)}`}>
                              {delivery.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {delivery.distance.toFixed(1)} km
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatCurrency(delivery.earnings)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(delivery.estimatedDeliveryTime)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex gap-2">
                              <button className="text-blue-600 hover:text-blue-900">
                                <Eye className="w-4 h-4" />
                              </button>
                              <button className="text-green-600 hover:text-green-900">
                                <Navigation className="w-4 h-4" />
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

          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">Courier Analytics</h3>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-gray-50 rounded-lg p-6">
                  <h4 className="text-lg font-semibold mb-4">Top Performing Couriers</h4>
                  <div className="space-y-4">
                    {couriers
                      .sort((a, b) => b.totalDeliveries - a.totalDeliveries)
                      .slice(0, 5)
                      .map((courier) => (
                        <div key={courier.id} className="flex items-center justify-between p-3 bg-white rounded border">
                          <div>
                            <p className="font-medium">{courier.name}</p>
                            <p className="text-sm text-gray-600">{courier.vehicleType}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{courier.totalDeliveries} deliveries</p>
                            <p className="text-sm text-gray-600">{formatCurrency(courier.totalEarnings)}</p>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-6">
                  <h4 className="text-lg font-semibold mb-4">Delivery Performance</h4>
                  <div className="space-y-4">
                    {['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'FAILED'].map((status) => {
                      const count = deliveries.filter(d => d.status === status).length;
                      const percentage = deliveries.length > 0 ? (count / deliveries.length) * 100 : 0;

                      return (
                        <div key={status} className="flex items-center justify-between p-3 bg-white rounded border">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getDeliveryStatusColor(status)}`}>
                              {status.replace('_', ' ')}
                            </span>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{count}</p>
                            <p className="text-sm text-gray-600">{percentage.toFixed(1)}%</p>
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