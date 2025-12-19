'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useRealTimeSync } from '@/hooks/useRealTimeSync';
import { SyncEvent, SyncConflict } from '@/lib/sync/realTimeSyncService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { 
  AlertTriangle,
  RefreshCw,
  Clock,
  Wifi,
  WifiOff
} from 'lucide-react';

interface SyncStatus {
  lastSync: Date | null;
  pendingEvents: number;
  activeConnections: number;
  isOnline: boolean;
}

export default function SyncPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [events] = useState<SyncEvent[]>([]);
  const [conflicts] = useState<SyncConflict[]>([]);
  const [loading, setLoading] = useState(true);
  const organizationId = (session?.user as { organizationId?: string } | null)?.organizationId || '';

  const {
    isConnected,
    connect,
    disconnect
  } = useRealTimeSync({
    organizationId,
    autoConnect: !!organizationId,
    onEvent: (event: SyncEvent) => {
      console.log('Sync event received:', event);
    },
    onStatusChange: (status: SyncStatus) => {
      setSyncStatus(status);
    }
  });

  useEffect(() => {
    const orgId = (session?.user as { organizationId?: string } | null)?.organizationId;
    if (!orgId) {
      router.push('/auth/signin');
      return;
    }
  }, [session, router]);

  useEffect(() => {
    if (!organizationId) {
      return;
    }
    loadSyncStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, session]);

  const loadSyncStatus = async () => {
    if (!organizationId) return;
    try {
      setLoading(true);
      const response = await fetch(`/api/sync/status?organizationId=${organizationId}`);
      if (response.ok) {
        const status = await response.json();
        setSyncStatus(status);
      }
    } catch (error) {
      console.error('Error loading sync status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleForceSync = async () => {
    try {
      const response = await fetch('/api/sync/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'force_sync',
          organizationId
        })
      });

      if (response.ok) {
        await loadSyncStatus();
      }
    } catch (error) {
      console.error('Error forcing sync:', error);
    }
  };

  const handleResolveConflict = async (conflictId: string, resolution: string) => {
    try {
      const response = await fetch('/api/sync/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'resolve_conflict',
          conflictId,
          resolution: { resolution },
          organizationId
        })
      });

      if (response.ok) {
        await loadSyncStatus();
      }
    } catch (error) {
      console.error('Error resolving conflict:', error);
    }
  };

  const getStatusIcon = (isOnline: boolean) => {
    return isOnline ? (
      <Wifi className="h-5 w-5 text-green-500" />
    ) : (
      <WifiOff className="h-5 w-5 text-red-500" />
    );
  };

  const getStatusBadge = (isOnline: boolean) => {
    return isOnline ? (
      <Badge variant="default" className="bg-green-100 text-green-800">
        Online
      </Badge>
    ) : (
      <Badge variant="destructive">Offline</Badge>
    );
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Real-Time Sync</h1>
        <p className="text-gray-600 mt-2">
          Monitor and manage real-time synchronization across all platforms
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Connection Status */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Connection Status</CardTitle>
            {getStatusIcon(syncStatus?.isOnline || false)}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {getStatusBadge(syncStatus?.isOnline || false)}
            </div>
            <p className="text-xs text-muted-foreground">
              {isConnected ? 'WebSocket Connected' : 'WebSocket Disconnected'}
            </p>
          </CardContent>
        </Card>

        {/* Last Sync */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Sync</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {syncStatus?.lastSync ? 
                syncStatus.lastSync.toLocaleTimeString() : 
                'Never'
              }
            </div>
            <p className="text-xs text-muted-foreground">
              {syncStatus?.lastSync ? 
                syncStatus.lastSync.toLocaleDateString() : 
                'No sync activity'
              }
            </p>
          </CardContent>
        </Card>

        {/* Pending Events */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Events</CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {syncStatus?.pendingEvents || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Events in queue
            </p>
          </CardContent>
        </Card>

        {/* Active Connections */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Connections</CardTitle>
            <Wifi className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {syncStatus?.activeConnections || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Connected clients
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex gap-4 mb-8">
        <Button 
          onClick={connect} 
          disabled={isConnected}
          variant="outline"
        >
          Connect
        </Button>
        <Button 
          onClick={disconnect} 
          disabled={!isConnected}
          variant="outline"
        >
          Disconnect
        </Button>
        <Button 
          onClick={handleForceSync}
          disabled={!syncStatus?.isOnline}
        >
          Force Sync
        </Button>
        <Button 
          onClick={loadSyncStatus}
          variant="outline"
        >
          Refresh Status
        </Button>
      </div>

      {/* Conflicts */}
      {conflicts.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Sync Conflicts ({conflicts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {conflicts.map((conflict: SyncConflict) => (
                <div key={conflict.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">
                      {conflict.entityType} - {conflict.entityId}
                    </h4>
                    <Badge variant="outline">Unresolved</Badge>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">
                    Created: {new Date(conflict.createdAt).toLocaleString()}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleResolveConflict(conflict.id, 'local')}
                    >
                      Use Local
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleResolveConflict(conflict.id, 'remote')}
                    >
                      Use Remote
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleResolveConflict(conflict.id, 'merge')}
                    >
                      Merge
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Events */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Sync Events</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {events.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No recent events</p>
            ) : (
              events.slice(0, 10).map((event: SyncEvent) => (
                <div key={event.id} className="flex items-center justify-between p-2 border rounded">
                  <div>
                    <span className="font-medium">{event.type}</span>
                    <span className="text-gray-500 ml-2">({event.action})</span>
                    <span className="text-gray-400 ml-2">from {event.source}</span>
                  </div>
                  <div className="text-sm text-gray-500">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 