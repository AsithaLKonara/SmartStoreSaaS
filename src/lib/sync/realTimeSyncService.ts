import { prisma } from '../prisma';
import { WebSocket, WebSocketServer } from 'ws';
import { EventEmitter } from 'events';
import { Redis } from 'ioredis';

export interface SyncEvent {
  id: string;
  type: 'product' | 'order' | 'customer' | 'inventory' | 'message' | 'conflict' | 'voice_command_processed' | 'whatsapp_message_sent' | 'whatsapp_template_sent' | 'whatsapp_media_sent' | 'whatsapp_interactive_sent' | 'whatsapp_message_received' | 'whatsapp_message_status';
  action: 'create' | 'update' | 'delete' | 'sync' | 'conflict';
  entityId: string;
  organizationId: string;
  data?: any;
  timestamp: Date;
  source: string;
}

export interface SyncConflict {
  id: string;
  entityType: string;
  entityId: string;
  conflicts: {
    field: string;
    localValue: any;
    remoteValue: any;
    resolution: 'local' | 'remote' | 'manual' | 'merge';
  }[];
  resolved: boolean;
  createdAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
}

export class RealTimeSyncService extends EventEmitter {
  private redis: Redis | null = null;
  private wss: WebSocketServer | null = null;
  private connections: Map<string, WebSocket> = new Map();
  private syncQueue: SyncEvent[] = [];
  private isProcessing = false;
  private isInitialized = false;

  constructor() {
    super();
    // Don't initialize WebSocket immediately - defer until needed
    // Don't initialize Redis immediately - defer until needed
    this.startSyncProcessor();
  }

  private getRedis(): Redis {
    if (!this.redis) {
      this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    }
    return this.redis;
  }

  private async initializeWebSocket(): Promise<void> {
    if (this.wss || this.isInitialized) return;
    
    try {
      this.wss = new WebSocketServer({ port: 3001 });
      this.isInitialized = true;

      this.wss.on('connection', (ws: WebSocket, request) => {
        const url = new URL(request.url || '', `http://localhost`);
        const organizationId = url.searchParams.get('organizationId');
        
        if (!organizationId) {
          ws.close(1008, 'Organization ID required');
          return;
        }

        const connectionId = `${organizationId}-${Date.now()}`;
        this.connections.set(connectionId, ws);

        console.log(`WebSocket connected: ${connectionId}`);

        // Send initial state
        this.sendInitialState(organizationId, ws);

        ws.on('close', () => {
          this.connections.delete(connectionId);
          console.log(`WebSocket disconnected: ${connectionId}`);
        });

        ws.on('error', (error) => {
          console.error(`WebSocket error: ${connectionId}`, error);
          this.connections.delete(connectionId);
        });
      });

      console.log('WebSocket server initialized on port 3001');
    } catch (error) {
      console.error('Failed to initialize WebSocket server:', error);
      this.isInitialized = false;
    }
  }

  private async ensureWebSocketInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initializeWebSocket();
    }
  }

  private extractOrganizationId(request: any): string | null {
    const url = new URL(request.url, 'http://localhost');
    return url.searchParams.get('organizationId');
  }

  private async sendInitialState(organizationId: string, ws: WebSocket): Promise<void> {
    try {
      const lastSync = await this.getRedis().get(`last_sync:${organizationId}`);
      const pendingEvents = await this.getPendingEvents(organizationId);
      
      ws.send(JSON.stringify({
        type: 'initial_state',
        lastSync: lastSync ? new Date(lastSync) : null,
        pendingEvents: pendingEvents.length
      }));
    } catch (error) {
      console.error('Error sending initial state:', error);
    }
  }

  private async handleIncomingEvent(event: SyncEvent): Promise<void> {
    try {
      // Validate event
      if (!this.validateEvent(event)) {
        throw new Error('Invalid sync event');
      }

      // Check for conflicts
      const conflicts = await this.detectConflicts(event);
      if (conflicts.length > 0) {
        await this.handleConflicts(event, conflicts);
        return;
      }

      // Process event
      await this.processEvent(event);

      // Broadcast to other connections
      await this.broadcastEvent(event);

      // Update last sync timestamp
      await this.getRedis().set(`last_sync:${event.organizationId}`, new Date().toISOString());

      this.emit('event_processed', event);
    } catch (error) {
      console.error('Error handling sync event:', error);
      this.emit('event_error', { event, error });
    }
  }

  private validateEvent(event: SyncEvent): boolean {
    return !!(
      event.type &&
      event.action &&
      event.entityId &&
      event.organizationId
    );
  }

  private async detectConflicts(event: SyncEvent): Promise<any[]> {
    const conflicts: any[] = [];
    
    try {
      const lastModified = await this.getLastModified(event);
      if (lastModified && lastModified > event.timestamp) {
        // Potential conflict - data was modified after this event
        const currentData = await this.getCurrentData(event);
        const differences = this.compareData(event.data, currentData);
        
        if (differences.length > 0) {
          conflicts.push({
            field: differences,
            localValue: currentData,
            remoteValue: event.data,
            timestamp: lastModified
          });
        }
      }
    } catch (error) {
      console.error('Error detecting conflicts:', error);
    }

    return conflicts;
  }

  private async handleConflicts(event: SyncEvent, conflicts: any[]): Promise<void> {
    const conflictRecord: SyncConflict = {
      id: `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      entityType: event.type,
      entityId: event.entityId,
      conflicts: conflicts.map(c => ({
        field: c.field,
        localValue: c.localValue,
        remoteValue: c.remoteValue,
        resolution: 'manual' as const
      })),
      resolved: false,
      createdAt: new Date()
    };

    await prisma.syncConflict.create({
      data: {
        id: conflictRecord.id,
        entityType: conflictRecord.entityType,
        entityId: conflictRecord.entityId,
        conflicts: conflictRecord.conflicts,
        resolved: conflictRecord.resolved,
        organizationId: event.organizationId,
        createdAt: conflictRecord.createdAt
      }
    });

    // Notify about conflict
    this.emit('conflict_detected', conflictRecord);
    await this.broadcastEvent({
      ...event,
      type: 'conflict',
      data: conflictRecord
    });
  }

  private async processEvent(event: SyncEvent): Promise<void> {
    switch (event.type) {
      case 'product':
        await this.processProductEvent(event);
        break;
      case 'order':
        await this.processOrderEvent(event);
        break;
      case 'customer':
        await this.processCustomerEvent(event);
        break;
      case 'inventory':
        await this.processInventoryEvent(event);
        break;
      case 'message':
        await this.processMessageEvent(event);
        break;
      default:
        throw new Error(`Unknown event type: ${event.type}`);
    }
  }

  private async processProductEvent(event: SyncEvent): Promise<void> {
    const { action, data, organizationId } = event;

    switch (action) {
      case 'create':
        await prisma.product.create({
          data: {
            ...data,
<<<<<<< HEAD
            organizationId,
=======
            organizationId
>>>>>>> 08d9e1855dc7fd2c99e5d62def516239ff37a9a7
          }
        });
        break;
      case 'update':
        await prisma.product.update({
          where: { id: data.id, organizationId },
          data: {
<<<<<<< HEAD
            ...data,
=======
            ...data
>>>>>>> 08d9e1855dc7fd2c99e5d62def516239ff37a9a7
          }
        });
        break;
      case 'delete':
        await prisma.product.delete({
          where: { id: data.id, organizationId }
        });
        break;
    }
  }

  private async processOrderEvent(event: SyncEvent): Promise<void> {
    const { action, data, organizationId } = event;

    switch (action) {
      case 'create':
        await prisma.order.create({
          data: {
            ...data,
<<<<<<< HEAD
            organizationId,
=======
            organizationId
>>>>>>> 08d9e1855dc7fd2c99e5d62def516239ff37a9a7
          }
        });
        break;
      case 'update':
        await prisma.order.update({
          where: { id: data.id, organizationId },
          data: {
<<<<<<< HEAD
            ...data,
=======
            ...data
>>>>>>> 08d9e1855dc7fd2c99e5d62def516239ff37a9a7
          }
        });
        break;
      case 'delete':
        await prisma.order.delete({
          where: { id: data.id, organizationId }
        });
        break;
    }
  }

  private async processCustomerEvent(event: SyncEvent): Promise<void> {
    const { action, data, organizationId } = event;

    switch (action) {
      case 'create':
        await prisma.customer.create({
          data: {
            ...data,
<<<<<<< HEAD
            organizationId,
=======
            organizationId
>>>>>>> 08d9e1855dc7fd2c99e5d62def516239ff37a9a7
          }
        });
        break;
      case 'update':
        await prisma.customer.update({
          where: { id: data.id, organizationId },
          data: {
<<<<<<< HEAD
            ...data,
=======
            ...data
>>>>>>> 08d9e1855dc7fd2c99e5d62def516239ff37a9a7
          }
        });
        break;
      case 'delete':
        await prisma.customer.delete({
          where: { id: data.id, organizationId }
        });
        break;
    }
  }

  private async processInventoryEvent(event: SyncEvent): Promise<void> {
    const { action, data, organizationId } = event;

    switch (action) {
      case 'update':
        await prisma.product.update({
          where: { id: data.productId, organizationId },
          data: {
            stockQuantity: data.quantity,
<<<<<<< HEAD
=======
            updatedAt: new Date()
>>>>>>> 08d9e1855dc7fd2c99e5d62def516239ff37a9a7
          }
        });
        break;
    }
  }

  private async processMessageEvent(event: SyncEvent): Promise<void> {
    const { action, data, organizationId } = event;

    switch (action) {
      case 'create':
        await prisma.chatMessage.create({
          data: {
            ...data,
<<<<<<< HEAD
            organizationId,
=======
            organizationId
>>>>>>> 08d9e1855dc7fd2c99e5d62def516239ff37a9a7
          }
        });
        break;
    }
  }

  public async broadcastEvent(event: SyncEvent): Promise<void> {
    await this.ensureWebSocketInitialized();
    
    const message = JSON.stringify(event);
    
    this.connections.forEach((ws, connectionId) => {
      if (connectionId.startsWith(event.organizationId) && ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }

  private async getLastModified(event: SyncEvent): Promise<Date | null> {
    try {
      const entity = await this.getEntity(event);
      return entity?.updatedAt || null;
    } catch (error) {
      return null;
    }
  }

  private async getCurrentData(event: SyncEvent): Promise<any> {
    try {
      const entity = await this.getEntity(event);
      return entity || null;
    } catch (error) {
      return null;
    }
  }

  private async getEntity(event: SyncEvent): Promise<any> {
    const { type, data, organizationId } = event;
    const entityId = data.id || data._id;

    switch (type) {
      case 'product':
        return await prisma.product.findUnique({
          where: { id: entityId, organizationId }
        });
      case 'order':
        return await prisma.order.findUnique({
          where: { id: entityId, organizationId }
        });
      case 'customer':
        return await prisma.customer.findUnique({
          where: { id: entityId, organizationId }
        });
      default:
        return null;
    }
  }

  private compareData(newData: any, currentData: any): string[] {
    const differences: string[] = [];
    
    if (!currentData) return differences;

    Object.keys(newData).forEach(key => {
      if (key === 'id' || key === '_id' || key === 'createdAt' || key === 'updatedAt') return;
      
      if (JSON.stringify(newData[key]) !== JSON.stringify(currentData[key])) {
        differences.push(key);
      }
    });

    return differences;
  }

  private async getPendingEvents(organizationId: string): Promise<SyncEvent[]> {
    try {
      const pending = await this.getRedis().lrange(`sync_queue:${organizationId}`, 0, -1);
      return pending?.map(p => JSON.parse(p)) || [];
    } catch (error) {
      return [];
    }
  }

  private startSyncProcessor(): void {
    setInterval(async () => {
      if (this.isProcessing || this.syncQueue.length === 0) return;
      
      this.isProcessing = true;
      
      try {
        const event = this.syncQueue.shift();
        if (event) {
          await this.handleIncomingEvent(event);
        }
      } catch (error) {
        console.error('Error processing sync queue:', error);
      } finally {
        this.isProcessing = false;
      }
    }, 100); // Process every 100ms
  }

  // Public methods
  public async queueEvent(event: SyncEvent): Promise<void> {
    this.syncQueue.push(event);
  }

  public async resolveConflict(conflictId: string, resolution: any): Promise<void> {
    const conflict = await prisma.syncConflict.findUnique({
      where: { id: conflictId }
    });

    if (!conflict) throw new Error('Conflict not found');

    await prisma.syncConflict.update({
      where: { id: conflictId },
      data: {
        conflicts: resolution.conflicts,
        resolved: true,
        resolvedAt: new Date(),
        resolvedBy: resolution.resolvedBy
      }
    });

    // Process the resolved event
    if (resolution.event) {
      await this.processEvent(resolution.event);
    }
  }

  public async getSyncStatus(organizationId: string): Promise<any> {
    const lastSync = await this.getRedis().get(`last_sync:${organizationId}`);
    const pendingCount = await this.getRedis().llen(`sync_queue:${organizationId}`);
    const activeConnections = Array.from(this.connections.keys()).filter(id => id === organizationId).length;

    return {
      lastSync: lastSync ? new Date(lastSync) : null,
      pendingEvents: pendingCount,
      activeConnections,
      isOnline: activeConnections > 0
    };
  }

  public async forceSync(organizationId: string): Promise<void> {
    const pendingEvents = await this.getPendingEvents(organizationId);
    
    for (const event of pendingEvents) {
      await this.handleIncomingEvent(event);
    }
  }

  public disconnect(): void {
    this.wss?.close();
    this.getRedis().disconnect();
  }
}

// Singleton instance
export const realTimeSyncService = new RealTimeSyncService(); 