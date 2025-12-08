'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { 
  Settings2, 
  Building2, 
  Users, 
  Shield, 
  Bell, 
  Key, 
  Mail, 
  Smartphone,
  Globe,
  Palette,
  CreditCard,
  Save,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { toast } from 'react-hot-toast';

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('organization');

  // Organization settings
  const [orgSettings, setOrgSettings] = useState({
    name: '',
    domain: '',
    description: '',
    logo: '',
    primaryColor: '#6366f1',
    secondaryColor: '#8b5cf6',
  });

  // Notification preferences
  const [notifications, setNotifications] = useState({
    email: {
      orderUpdates: true,
      paymentNotifications: true,
      inventoryAlerts: false,
      marketingEmails: true,
    },
    sms: {
      orderUpdates: false,
      paymentNotifications: false,
      inventoryAlerts: false,
    },
    push: {
      orderUpdates: true,
      paymentNotifications: true,
      inventoryAlerts: true,
    },
  });

  // Security settings
  const [security, setSecurity] = useState({
    mfaEnabled: false,
    passwordMinLength: 12,
    sessionTimeout: 3600,
    ipRestrictions: false,
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/auth/signin');
      return;
    }

    if (status === 'authenticated' && session) {
      loadSettings();
    }
  }, [status, session, router]);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      // Load settings from API (placeholder - implement actual API call)
      // For now, use session data
      if (session?.user) {
        setOrgSettings(prev => ({
          ...prev,
          name: session.user?.name || '',
          domain: '',
          description: '',
        }));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      // TODO: Implement API call to save settings
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return null;
  }

  const tabs = [
    { id: 'organization', label: 'Organization', icon: Building2 },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'integrations', label: 'Integrations', icon: Settings2 },
  ];

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Manage your organization settings, security, and preferences
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Tabs */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <nav className="space-y-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                      activeTab === tab.id
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            {/* Organization Settings */}
            {activeTab === 'organization' && (
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                  Organization Settings
                </h2>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Organization Name
                    </label>
                    <input
                      type="text"
                      value={orgSettings.name}
                      onChange={(e) => setOrgSettings({ ...orgSettings, name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      placeholder="Enter organization name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Domain
                    </label>
                    <input
                      type="text"
                      value={orgSettings.domain}
                      onChange={(e) => setOrgSettings({ ...orgSettings, domain: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      placeholder="example.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Description
                    </label>
                    <textarea
                      value={orgSettings.description}
                      onChange={(e) => setOrgSettings({ ...orgSettings, description: e.target.value })}
                      rows={4}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      placeholder="Enter organization description"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Primary Color
                      </label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="color"
                          value={orgSettings.primaryColor}
                          onChange={(e) => setOrgSettings({ ...orgSettings, primaryColor: e.target.value })}
                          className="w-16 h-10 border border-gray-300 dark:border-gray-600 rounded cursor-pointer"
                        />
                        <input
                          type="text"
                          value={orgSettings.primaryColor}
                          onChange={(e) => setOrgSettings({ ...orgSettings, primaryColor: e.target.value })}
                          className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Secondary Color
                      </label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="color"
                          value={orgSettings.secondaryColor}
                          onChange={(e) => setOrgSettings({ ...orgSettings, secondaryColor: e.target.value })}
                          className="w-16 h-10 border border-gray-300 dark:border-gray-600 rounded cursor-pointer"
                        />
                        <input
                          type="text"
                          value={orgSettings.secondaryColor}
                          onChange={(e) => setOrgSettings({ ...orgSettings, secondaryColor: e.target.value })}
                          className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Users Settings */}
            {activeTab === 'users' && (
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                  User Management
                </h2>
                <div className="text-center py-12">
                  <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">
                    User management features coming soon
                  </p>
                </div>
              </div>
            )}

            {/* Security Settings */}
            {activeTab === 'security' && (
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                  Security Settings
                </h2>
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">Multi-Factor Authentication</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Require MFA for all users
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={security.mfaEnabled}
                        onChange={(e) => setSecurity({ ...security, mfaEnabled: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Minimum Password Length
                    </label>
                    <input
                      type="number"
                      value={security.passwordMinLength}
                      onChange={(e) => setSecurity({ ...security, passwordMinLength: parseInt(e.target.value) || 12 })}
                      min={8}
                      max={32}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Session Timeout (seconds)
                    </label>
                    <input
                      type="number"
                      value={security.sessionTimeout}
                      onChange={(e) => setSecurity({ ...security, sessionTimeout: parseInt(e.target.value) || 3600 })}
                      min={300}
                      max={86400}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">IP Restrictions</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Restrict access by IP address
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={security.ipRestrictions}
                        onChange={(e) => setSecurity({ ...security, ipRestrictions: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Notifications Settings */}
            {activeTab === 'notifications' && (
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                  Notification Preferences
                </h2>
                <div className="space-y-6">
                  {/* Email Notifications */}
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                      <Mail className="w-5 h-5 mr-2" />
                      Email Notifications
                    </h3>
                    <div className="space-y-3 pl-7">
                      {Object.entries(notifications.email).map(([key, value]) => (
                        <label key={key} className="flex items-center justify-between">
                          <span className="text-gray-700 dark:text-gray-300 capitalize">
                            {key.replace(/([A-Z])/g, ' $1').trim()}
                          </span>
                          <input
                            type="checkbox"
                            checked={value}
                            onChange={(e) => setNotifications({
                              ...notifications,
                              email: { ...notifications.email, [key]: e.target.checked }
                            })}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* SMS Notifications */}
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                      <Smartphone className="w-5 h-5 mr-2" />
                      SMS Notifications
                    </h3>
                    <div className="space-y-3 pl-7">
                      {Object.entries(notifications.sms).map(([key, value]) => (
                        <label key={key} className="flex items-center justify-between">
                          <span className="text-gray-700 dark:text-gray-300 capitalize">
                            {key.replace(/([A-Z])/g, ' $1').trim()}
                          </span>
                          <input
                            type="checkbox"
                            checked={value}
                            onChange={(e) => setNotifications({
                              ...notifications,
                              sms: { ...notifications.sms, [key]: e.target.checked }
                            })}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Push Notifications */}
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                      <Bell className="w-5 h-5 mr-2" />
                      Push Notifications
                    </h3>
                    <div className="space-y-3 pl-7">
                      {Object.entries(notifications.push).map(([key, value]) => (
                        <label key={key} className="flex items-center justify-between">
                          <span className="text-gray-700 dark:text-gray-300 capitalize">
                            {key.replace(/([A-Z])/g, ' $1').trim()}
                          </span>
                          <input
                            type="checkbox"
                            checked={value}
                            onChange={(e) => setNotifications({
                              ...notifications,
                              push: { ...notifications.push, [key]: e.target.checked }
                            })}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Integrations Settings */}
            {activeTab === 'integrations' && (
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                  Integration Settings
                </h2>
                <div className="text-center py-12">
                  <Settings2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Manage integrations from the Integrations page
                  </p>
                  <Button
                    onClick={() => router.push('/integrations')}
                    variant="outline"
                  >
                    Go to Integrations
                  </Button>
                </div>
              </div>
            )}

            {/* Save Button */}
            <div className="border-t border-gray-200 dark:border-gray-700 p-6">
              <div className="flex justify-end">
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center space-x-2"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Save Settings</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

