'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  MessageCircle,
  ShoppingCart,
  Truck
} from 'lucide-react';

interface IntegrationStatus {
  whatsapp: {
    configured: boolean;
    status: string;
  };
  woocommerce: {
    configured: boolean;
    status: string;
  };
  couriers: {
    configured: boolean;
    count: number;
    active: number;
  };
}

interface IntegrationManagerProps {
  organizationId: string;
}

export function IntegrationManager({ organizationId }: IntegrationManagerProps) {
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupLoading, setSetupLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('whatsapp');

  // WhatsApp form state
  const [whatsappConfig, setWhatsappConfig] = useState({
    phoneNumberId: '',
    accessToken: '',
    webhookSecret: ''
  });

  // WooCommerce form state
  const [woocommerceConfig, setWooCommerceConfig] = useState({
    siteUrl: '',
    consumerKey: '',
    consumerSecret: '',
    apiVersion: 'wc/v3'
  });

  // Courier form state
  const [courierConfig, setCourierConfig] = useState({
    name: '',
    code: '',
    apiKey: '',
    apiSecret: ''
  });

  useEffect(() => {
    loadIntegrationStatus();
  }, [organizationId]);

  const loadIntegrationStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/integrations/setup?organizationId=${organizationId}`);
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (error) {
      console.error('Error loading integration status:', error);
    } finally {
      setLoading(false);
    }
  };

  const setupIntegration = async (type: string, config: any) => {
    try {
      setSetupLoading(true);
      const response = await fetch('/api/integrations/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          config,
          organizationId
        })
      });

      if (response.ok) {
        await loadIntegrationStatus();
        return { success: true };
      } else {
        const error = await response.json();
        return { success: false, error: error.error };
      }
    } catch (error) {
      return { success: false, error: 'Setup failed' };
    } finally {
      setSetupLoading(false);
    }
  };

  const handleWhatsAppSetup = async () => {
    const result = await setupIntegration('whatsapp', whatsappConfig);
    if (result.success) {
      setWhatsappConfig({ phoneNumberId: '', accessToken: '', webhookSecret: '' });
    } else {
      alert(`WhatsApp setup failed: ${result.error}`);
    }
  };

  const handleWooCommerceSetup = async () => {
    const result = await setupIntegration('woocommerce', woocommerceConfig);
    if (result.success) {
      setWooCommerceConfig({ siteUrl: '', consumerKey: '', consumerSecret: '', apiVersion: 'wc/v3' });
    } else {
      alert(`WooCommerce setup failed: ${result.error}`);
    }
  };

  const handleCourierSetup = async () => {
    const result = await setupIntegration('courier', courierConfig);
    if (result.success) {
      setCourierConfig({ name: '', code: '', apiKey: '', apiSecret: '' });
    } else {
      alert(`Courier setup failed: ${result.error}`);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'unhealthy':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
      case 'healthy':
        return <Badge variant="default" className="bg-green-100 text-green-800">Active</Badge>;
      case 'unhealthy':
        return <Badge variant="destructive">Unhealthy</Badge>;
      case 'not_configured':
        return <Badge variant="secondary">Not Configured</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Integrations</h2>
        <Button onClick={loadIntegrationStatus} variant="outline">
          Refresh Status
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="whatsapp" className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </TabsTrigger>
          <TabsTrigger value="woocommerce" className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            WooCommerce
          </TabsTrigger>
          <TabsTrigger value="couriers" className="flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Couriers
          </TabsTrigger>
        </TabsList>

        <TabsContent value="whatsapp" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                WhatsApp Business API
                {status?.whatsapp && getStatusIcon(status.whatsapp.status)}
                {status?.whatsapp && getStatusBadge(status.whatsapp.status)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {status?.whatsapp.configured ? (
                <div className="text-sm text-gray-600">
                  WhatsApp integration is configured and active.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="phoneNumberId">Phone Number ID</Label>
                      <Input
                        id="phoneNumberId"
                        value={whatsappConfig.phoneNumberId}
                        onChange={(e) => setWhatsappConfig(prev => ({
                          ...prev,
                          phoneNumberId: e.target.value
                        }))}
                        placeholder="Enter WhatsApp Phone Number ID"
                      />
                    </div>
                    <div>
                      <Label htmlFor="accessToken">Access Token</Label>
                      <Input
                        id="accessToken"
                        type="password"
                        value={whatsappConfig.accessToken}
                        onChange={(e) => setWhatsappConfig(prev => ({
                          ...prev,
                          accessToken: e.target.value
                        }))}
                        placeholder="Enter WhatsApp Access Token"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="webhookSecret">Webhook Secret (Optional)</Label>
                    <Input
                      id="webhookSecret"
                      type="password"
                      value={whatsappConfig.webhookSecret}
                      onChange={(e) => setWhatsappConfig(prev => ({
                        ...prev,
                        webhookSecret: e.target.value
                      }))}
                      placeholder="Enter Webhook Secret"
                    />
                  </div>
                  <Button 
                    onClick={handleWhatsAppSetup} 
                    disabled={setupLoading || !whatsappConfig.phoneNumberId || !whatsappConfig.accessToken}
                  >
                    {setupLoading ? 'Setting up...' : 'Setup WhatsApp Integration'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="woocommerce" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                WooCommerce Integration
                {status?.woocommerce && getStatusIcon(status.woocommerce.status)}
                {status?.woocommerce && getStatusBadge(status.woocommerce.status)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {status?.woocommerce.configured ? (
                <div className="text-sm text-gray-600">
                  WooCommerce integration is configured and active.
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="siteUrl">Site URL</Label>
                    <Input
                      id="siteUrl"
                      value={woocommerceConfig.siteUrl}
                      onChange={(e) => setWooCommerceConfig(prev => ({
                        ...prev,
                        siteUrl: e.target.value
                      }))}
                      placeholder="https://your-store.com"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="consumerKey">Consumer Key</Label>
                      <Input
                        id="consumerKey"
                        value={woocommerceConfig.consumerKey}
                        onChange={(e) => setWooCommerceConfig(prev => ({
                          ...prev,
                          consumerKey: e.target.value
                        }))}
                        placeholder="Enter Consumer Key"
                      />
                    </div>
                    <div>
                      <Label htmlFor="consumerSecret">Consumer Secret</Label>
                      <Input
                        id="consumerSecret"
                        type="password"
                        value={woocommerceConfig.consumerSecret}
                        onChange={(e) => setWooCommerceConfig(prev => ({
                          ...prev,
                          consumerSecret: e.target.value
                        }))}
                        placeholder="Enter Consumer Secret"
                      />
                    </div>
                  </div>
                  <Button 
                    onClick={handleWooCommerceSetup} 
                    disabled={setupLoading || !woocommerceConfig.siteUrl || !woocommerceConfig.consumerKey || !woocommerceConfig.consumerSecret}
                  >
                    {setupLoading ? 'Setting up...' : 'Setup WooCommerce Integration'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="couriers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Courier Services
                {status?.couriers && (
                  <Badge variant="outline">
                    {status.couriers.active} Active
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="courierName">Courier Name</Label>
                  <Input
                    id="courierName"
                    value={courierConfig.name}
                    onChange={(e) => setCourierConfig(prev => ({
                      ...prev,
                      name: e.target.value
                    }))}
                    placeholder="e.g., Aramex, DHL"
                  />
                </div>
                <div>
                  <Label htmlFor="courierCode">Courier Code</Label>
                  <Input
                    id="courierCode"
                    value={courierConfig.code}
                    onChange={(e) => setCourierConfig(prev => ({
                      ...prev,
                      code: e.target.value
                    }))}
                    placeholder="e.g., aramex, dhl"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="courierApiKey">API Key</Label>
                  <Input
                    id="courierApiKey"
                    type="password"
                    value={courierConfig.apiKey}
                    onChange={(e) => setCourierConfig(prev => ({
                      ...prev,
                      apiKey: e.target.value
                    }))}
                    placeholder="Enter API Key"
                  />
                </div>
                <div>
                  <Label htmlFor="courierApiSecret">API Secret (Optional)</Label>
                  <Input
                    id="courierApiSecret"
                    type="password"
                    value={courierConfig.apiSecret}
                    onChange={(e) => setCourierConfig(prev => ({
                      ...prev,
                      apiSecret: e.target.value
                    }))}
                    placeholder="Enter API Secret"
                  />
                </div>
              </div>
              <Button 
                onClick={handleCourierSetup} 
                disabled={setupLoading || !courierConfig.name || !courierConfig.code || !courierConfig.apiKey}
              >
                {setupLoading ? 'Setting up...' : 'Add Courier Service'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 