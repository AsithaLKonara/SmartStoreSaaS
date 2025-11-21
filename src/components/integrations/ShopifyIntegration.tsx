'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';

interface ShopifyIntegrationProps {
  organizationId: string;
}

interface ShopifyIntegrationData {
  id?: string;
  shopDomain?: string;
  isActive?: boolean;
  lastSync?: string;
  syncProducts?: boolean;
  syncOrders?: boolean;
  syncInventory?: boolean;
}

export function ShopifyIntegration({ organizationId }: ShopifyIntegrationProps) {
  const [integration, setIntegration] = useState<ShopifyIntegrationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupLoading, setSetupLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);

  const [config, setConfig] = useState({
    shopDomain: '',
    accessToken: '',
    apiKey: '',
    apiSecret: '',
    webhookSecret: '',
  });

  useEffect(() => {
    loadIntegration();
  }, [organizationId]);

  const loadIntegration = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/integrations/shopify');
      if (response.ok) {
        const data = await response.json();
        setIntegration(data);
      } else if (response.status !== 404) {
        console.error('Error loading integration');
      }
    } catch (error) {
      console.error('Error loading Shopify integration:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSetup = async () => {
    try {
      setSetupLoading(true);
      const response = await fetch('/api/integrations/shopify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (response.ok) {
        await loadIntegration();
        setConfig({
          shopDomain: '',
          accessToken: '',
          apiKey: '',
          apiSecret: '',
          webhookSecret: '',
        });
        alert('Shopify integration configured successfully!');
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
      const response = await fetch('/api/integrations/shopify/sync', {
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

  const handleUpdate = async (updates: Partial<ShopifyIntegrationData>) => {
    try {
      const response = await fetch('/api/integrations/shopify', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        await loadIntegration();
      }
    } catch (error) {
      console.error('Error updating integration:', error);
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
          Shopify Integration
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
              <p><strong>Shop Domain:</strong> {integration.shopDomain}</p>
              {integration.lastSync && (
                <p><strong>Last Sync:</strong> {new Date(integration.lastSync).toLocaleString()}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="syncProducts">Sync Products</Label>
                <Switch
                  id="syncProducts"
                  checked={integration.syncProducts}
                  onCheckedChange={(checked: boolean) =>
                    handleUpdate({ syncProducts: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="syncOrders">Sync Orders</Label>
                <Switch
                  id="syncOrders"
                  checked={integration.syncOrders}
                  onCheckedChange={(checked: boolean) =>
                    handleUpdate({ syncOrders: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="syncInventory">Sync Inventory</Label>
                <Switch
                  id="syncInventory"
                  checked={integration.syncInventory}
                  onCheckedChange={(checked: boolean) =>
                    handleUpdate({ syncInventory: checked })
                  }
                />
              </div>
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
                onClick={() => handleSync('inventory')}
                disabled={syncLoading}
                variant="outline"
                size="sm"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Sync Inventory
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
              <Label htmlFor="shopDomain">Shop Domain</Label>
              <Input
                id="shopDomain"
                value={config.shopDomain}
                onChange={(e) => setConfig(prev => ({ ...prev, shopDomain: e.target.value }))}
                placeholder="your-store (without .myshopify.com)"
              />
            </div>
            <div>
              <Label htmlFor="accessToken">Access Token</Label>
              <Input
                id="accessToken"
                type="password"
                value={config.accessToken}
                onChange={(e) => setConfig(prev => ({ ...prev, accessToken: e.target.value }))}
                placeholder="Shopify Admin API Access Token"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="apiKey">API Key</Label>
                <Input
                  id="apiKey"
                  value={config.apiKey}
                  onChange={(e) => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                  placeholder="API Key"
                />
              </div>
              <div>
                <Label htmlFor="apiSecret">API Secret</Label>
                <Input
                  id="apiSecret"
                  type="password"
                  value={config.apiSecret}
                  onChange={(e) => setConfig(prev => ({ ...prev, apiSecret: e.target.value }))}
                  placeholder="API Secret"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="webhookSecret">Webhook Secret (Optional)</Label>
              <Input
                id="webhookSecret"
                type="password"
                value={config.webhookSecret}
                onChange={(e) => setConfig(prev => ({ ...prev, webhookSecret: e.target.value }))}
                placeholder="Webhook Secret"
              />
            </div>
            <Button
              onClick={handleSetup}
              disabled={setupLoading || !config.shopDomain || !config.accessToken || !config.apiKey || !config.apiSecret}
            >
              {setupLoading ? 'Setting up...' : 'Setup Shopify Integration'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

