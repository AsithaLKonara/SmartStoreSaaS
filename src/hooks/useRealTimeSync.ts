'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { SyncEvent } from '@/lib/sync/realTimeSyncService';

interface SyncStatus {
  lastSync: Date | null;
  pendingEvents: number;
  activeConnections: number;
  isOnline: boolean;
}

interface UseRealTimeSyncOptions {
  organizationId: string;
  autoConnect?: boolean;
  onEvent?: (event: SyncEvent) => void;
  onStatusChange?: (status: SyncStatus) => void;
  onError?: (error: Error) => void;
}

export function useRealTimeSync({
  organizationId,
  autoConnect = true,
  onEvent,
  onStatusChange,
  onError
}: UseRealTimeSyncOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    lastSync: null,
    pendingEvents: 0,
    activeConnections: 0,
    isOnline: false
  });
  const [events, setEvents] = useState<SyncEvent[]>([]);
  const [conflicts, setConflicts] = useState<any[]>([]);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const ws = new WebSocket(`ws://localhost:3001?organizationId=${organizationId}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
        console.log('Real-time sync connected');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'initial_state') {
            setSyncStatus(prev => ({
              ...prev,
              lastSync: data.lastSync ? new Date(data.lastSync) : null,
              pendingEvents: data.pendingEvents,
              isOnline: true
            }));
          } else if (data.type === 'sync_event') {
            const syncEvent = data.event as SyncEvent;
            setEvents(prev => [syncEvent, ...prev.slice(0, 99)]); // Keep last 100 events
            onEvent?.(syncEvent);
          } else if (data.type === 'conflict') {
            setConflicts(prev => [data.conflict, ...prev.slice(0, 49)]); // Keep last 50 conflicts
          }
        } catch (error) {
          console.error('Error parsing sync message:', error);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        setSyncStatus(prev => ({ ...prev, isOnline: false }));
        console.log('Real-time sync disconnected');
        
        // Attempt to reconnect
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            connect();
          }, Math.pow(2, reconnectAttemptsRef.current) * 1000); // Exponential backoff
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        onError?.(new Error('WebSocket connection failed'));
      };

    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      onError?.(error as Error);
    }
  }, [organizationId, onEvent, onError]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setIsConnected(false);
    setSyncStatus(prev => ({ ...prev, isOnline: false }));
  }, []);

  const sendEvent = useCallback((event: Omit<SyncEvent, 'id' | 'timestamp'>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const syncEvent: SyncEvent = {
        ...event,
        // id removed - not in SyncEvent interface
        timestamp: new Date()
      };
      
      wsRef.current.send(JSON.stringify(syncEvent));
      return true;
    }
    return false;
  }, []);

  const getSyncStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/sync/status?organizationId=${organizationId}`);
      if (response.ok) {
        const status = await response.json();
        setSyncStatus(status);
        onStatusChange?.(status);
      }
    } catch (error) {
      console.error('Error fetching sync status:', error);
    }
  }, [organizationId, onStatusChange]);

  const forceSync = useCallback(async () => {
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
        await getSyncStatus();
        return true;
      }
    } catch (error) {
      console.error('Error forcing sync:', error);
    }
    return false;
  }, [organizationId, getSyncStatus]);

  const resolveConflict = useCallback(async (conflictId: string, resolution: any) => {
    try {
      const response = await fetch('/api/sync/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'resolve_conflict',
          conflictId,
          resolution,
          organizationId
        })
      });
      
      if (response.ok) {
        setConflicts(prev => prev.filter(c => c.id !== conflictId));
        return true;
      }
    } catch (error) {
      console.error('Error resolving conflict:', error);
    }
    return false;
  }, [organizationId]);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect && organizationId) {
      connect();
      getSyncStatus();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, organizationId, connect, disconnect, getSyncStatus]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    // State
    isConnected,
    syncStatus,
    events,
    conflicts,
    
    // Actions
    connect,
    disconnect,
    sendEvent,
    getSyncStatus,
    forceSync,
    resolveConflict,
    
    // Utilities
    reconnectAttempts: reconnectAttemptsRef.current
  };
} 