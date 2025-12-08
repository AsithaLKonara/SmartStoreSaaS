import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Bot,
  RefreshCw
} from 'lucide-react';

export default function StatusPage() {
  // In a real app, this would fetch from your status API
  const services = [
    { name: 'API', status: 'operational', uptime: '99.9%' },
    { name: 'Database', status: 'operational', uptime: '99.8%' },
    { name: 'Authentication', status: 'operational', uptime: '100%' },
    { name: 'Payment Processing', status: 'operational', uptime: '99.7%' },
    { name: 'Messaging', status: 'operational', uptime: '99.6%' },
    { name: 'Webhooks', status: 'operational', uptime: '99.5%' },
    { name: 'Redis Cache', status: 'degraded', uptime: '95.2%' },
    { name: 'WebSocket', status: 'degraded', uptime: '94.8%' }
  ];

  const incidents = [
    {
      title: 'Scheduled Maintenance',
      status: 'resolved',
      date: '2024-12-20',
      description: 'Database optimization completed successfully'
    },
    {
      title: 'API Performance Improvement',
      status: 'resolved',
      date: '2024-12-18',
      description: 'Response times improved by 30%'
    }
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'operational':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'degraded':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case 'down':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'operational':
        return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200';
      case 'degraded':
        return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200';
      case 'down':
        return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200';
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200';
    }
  };

  const overallStatus = services.every(s => s.status === 'operational') 
    ? 'operational' 
    : services.some(s => s.status === 'down')
    ? 'down'
    : 'degraded';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900 dark:text-white">SmartStore AI</span>
            </Link>
            <div className="flex items-center space-x-4">
              <Link href="/auth/signin">
                <Button variant="outline" size="sm">Sign In</Button>
              </Link>
              <Link href="/auth/signup">
                <Button size="sm">Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        {/* Status Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full mb-4">
            {getStatusIcon(overallStatus)}
          </div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            System Status
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            Real-time status of all SmartStore AI services
          </p>
        </div>

        {/* Overall Status */}
        <div className={`rounded-lg p-6 mb-8 ${getStatusColor(overallStatus)}`}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2">All Systems {overallStatus === 'operational' ? 'Operational' : overallStatus === 'degraded' ? 'Degraded' : 'Down'}</h2>
              <p className="opacity-90">
                {overallStatus === 'operational' 
                  ? 'All services are running normally'
                  : overallStatus === 'degraded'
                  ? 'Some services are experiencing issues'
                  : 'Some services are currently down'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm opacity-75">Last updated</p>
              <p className="font-semibold">{new Date().toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Services Status */}
        <div className="mb-12">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
            Service Status
          </h2>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {services.map((service, index) => (
                <div key={index} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      {getStatusIcon(service.status)}
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white">
                          {service.name}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Uptime: {service.uptime}
                        </p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(service.status)}`}>
                      {service.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Incidents */}
        <div className="mb-12">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
            Recent Incidents
          </h2>
          <div className="space-y-4">
            {incidents.map((incident, index) => (
              <div
                key={index}
                className="p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center space-x-2 mb-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(incident.status)}`}>
                        {incident.status}
                      </span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {incident.date}
                      </span>
                    </div>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                      {incident.title}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {incident.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Status API */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-8 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2">Status API</h2>
              <p className="text-blue-100">
                Subscribe to status updates via our API
              </p>
            </div>
            <Link href="/docs">
              <Button variant="secondary" size="lg">
                View API Docs
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

