'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';

interface MagentoIntegrationProps {
  organizationId: string;
}

interface MagentoIntegrationData {
  id?: string;
  baseUrl?: string;
  isActive?: boolean;
  lastSync?: string;
}

export function MagentoIntegration({ organizationId }: MagentoIntegrationProps) {
  const [integration, setIntegration] = useState<MagentoIntegrationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupLoading, setSetupLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);

  const [config, setConfig] = useState({
    baseUrl: '',
    accessToken: '',
  });

  useEffect(() => {
    loadIntegration();
  }, [organizationId]);

  const loadIntegration = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/integrations/magento');
      if (response.ok) {
        const data = await response.json();
        setIntegration(data);
      } else if (response.status !== 404) {
        console.error('Error loading integration');
      }
    } catch (error) {
      console.error('Error loading Magento integration:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSetup = async () => {
    try {
      setSetupLoading(true);
      const response = await fetch('/api/integrations/magento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (response.ok) {
        await loadIntegration();
        setConfig({ baseUrl: '', accessToken: '' });
        alert('Magento integration configured successfully!');
      } else {
        const error = await response.json();
        alert(`Setup failed: ${error.message}`);
      }
    } catch (error) {
      alert('Setup failed. Please try again.');
    } finally {
      setSetupLoading(false);
    }
  };

  const handleSync = async (type: string) => {
    try {
      setSyncLoading(true);
      const response = await fetch('/api/integrations/magento/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Sync completed: ${JSON.stringify(result.results)}`);
        await loadIntegration();
      } else {
        const error = await response.json();
        alert(`Sync failed: ${error.message}`);
      }
    } catch (error) {
      alert('Sync failed. Please try again.');
    } finally {
      setSyncLoading(false);
    }
  };

  const getStatusIcon = () => {
    if (!integration) return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    return integration.isActive ? (
      <CheckCircle className="h-5 w-5 text-green-500" />
    ) : (
      <XCircle className="h-5 w-5 text-red-500" />
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Magento Integration
          {integration && getStatusIcon()}
          {integration && (
            <Badge variant={integration.isActive ? 'default' : 'secondary'}>
              {integration.isActive ? 'Active' : 'Inactive'}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {integration?.id ? (
          <div className="space-y-4">
            <div className="text-sm text-gray-600">
              <p><strong>Base URL:</strong> {integration.baseUrl}</p>
              {integration.lastSync && (
                <p><strong>Last Sync:</strong> {new Date(integration.lastSync).toLocaleString()}</p>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => handleSync('products')}
                disabled={syncLoading}
                variant="outline"
                size="sm"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Sync Products
              </Button>
              <Button
                onClick={() => handleSync('orders')}
                disabled={syncLoading}
                variant="outline"
                size="sm"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Sync Orders
              </Button>
              <Button
                onClick={() => handleSync('all')}
                disabled={syncLoading}
                variant="default"
                size="sm"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Sync All
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label htmlFor="baseUrl">Magento Base URL</Label>
              <Input
                id="baseUrl"
                value={config.baseUrl}
                onChange={(e) => setConfig(prev => ({ ...prev, baseUrl: e.target.value }))}
                placeholder="https://your-store.com"
              />
            </div>
            <div>
              <Label htmlFor="accessToken">Access Token</Label>
              <Input
                id="accessToken"
                type="password"
                value={config.accessToken}
                onChange={(e) => setConfig(prev => ({ ...prev, accessToken: e.target.value }))}
                placeholder="Magento REST API Access Token"
              />
            </div>
            <Button
              onClick={handleSetup}
              disabled={setupLoading || !config.baseUrl || !config.accessToken}
            >
              {setupLoading ? 'Setting up...' : 'Setup Magento Integration'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

