import { usePWA } from '@/hooks/usePWA';

export interface PushNotification {
  id: string;
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: any;
  actions?: NotificationAction[];
  requireInteraction?: boolean;
  silent?: boolean;
}

export interface NotificationAction {
  action: string;
  title: string;
  icon?: string;
}

export interface OfflineData {
  type: 'ORDER' | 'MESSAGE' | 'SYNC';
  data: any;
  timestamp: Date;
  id: string;
}

export interface BackgroundSyncTask {
  id: string;
  type: 'ORDER_SYNC' | 'MESSAGE_SYNC' | 'DATA_SYNC';
  data: any;
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
}

export interface QRCodeData {
  type: 'PRODUCT' | 'ORDER' | 'CUSTOMER' | 'INVENTORY';
  data: any;
  size?: number;
  format?: 'PNG' | 'SVG';
}

export class AdvancedPWAService {
  private db: IDBDatabase | null = null;
  private readonly DB_NAME = 'SmartStorePWA';
  private readonly DB_VERSION = 1;

  /**
   * Initialize IndexedDB for offline storage
   */
  async initializeDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores
        if (!db.objectStoreNames.contains('offlineData')) {
          const offlineStore = db.createObjectStore('offlineData', { keyPath: 'id' });
          offlineStore.createIndex('type', 'type', { unique: false });
          offlineStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        if (!db.objectStoreNames.contains('backgroundSync')) {
          const syncStore = db.createObjectStore('backgroundSync', { keyPath: 'id' });
          syncStore.createIndex('type', 'type', { unique: false });
          syncStore.createIndex('retryCount', 'retryCount', { unique: false });
        }

        if (!db.objectStoreNames.contains('notifications')) {
          const notificationStore = db.createObjectStore('notifications', { keyPath: 'id' });
          notificationStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  /**
   * Push Notifications
   */
  async requestNotificationPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      throw new Error('Notifications not supported');
    }

    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      return permission;
    }

    return Notification.permission;
  }

  async subscribeToPushNotifications(): Promise<PushSubscription | null> {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        throw new Error('Push notifications not supported');
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '') as BufferSource,
      });

      // Send subscription to server
      await this.sendSubscriptionToServer(subscription);

      return subscription;
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      return null;
    }
  }

  async sendPushNotification(notification: PushNotification): Promise<void> {
    try {
      if (Notification.permission !== 'granted') {
        throw new Error('Notification permission not granted');
      }

      const serviceWorkerRegistration = await navigator.serviceWorker.ready;
      
      const notificationOptions: any = {
        body: notification.body,
        icon: notification.icon || '/icons/icon-192x192.png',
        badge: notification.badge || '/badge-72x72.png',
        data: notification.data,
        requireInteraction: notification.requireInteraction,
        silent: notification.silent,
        tag: notification.id,
      };

      // Add actions if they exist
      if (notification.actions) {
        notificationOptions.actions = notification.actions;
      }

      await serviceWorkerRegistration.showNotification(notification.title, notificationOptions);

      // Store notification in IndexedDB
      await this.storeNotification(notification);
    } catch (error) {
      console.error('Error sending push notification:', error);
    }
  }

  /**
   * Offline Data Management
   */
  async storeOfflineData(data: OfflineData): Promise<void> {
    if (!this.db) await this.initializeDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['offlineData'], 'readwrite');
      const store = transaction.objectStore('offlineData');
      const request = store.add(data);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getOfflineData(type?: string): Promise<OfflineData[]> {
    if (!this.db) await this.initializeDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['offlineData'], 'readonly');
      const store = transaction.objectStore('offlineData');
      const request = type ? store.index('type').getAll(type) : store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async clearOfflineData(type?: string): Promise<void> {
    if (!this.db) await this.initializeDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['offlineData'], 'readwrite');
      const store = transaction.objectStore('offlineData');
      let request: IDBRequest;
      
      if (type) {
        const index = store.index('type');
        request = index.openCursor(IDBKeyRange.only(type));
        
        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          } else {
            resolve();
          }
        };
      } else {
        request = store.clear();
        request.onsuccess = () => resolve();
      }
      
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Background Sync
   */
  async registerBackgroundSync(task: BackgroundSyncTask): Promise<void> {
    if (!('serviceWorker' in navigator) || !('sync' in window.ServiceWorkerRegistration.prototype)) {
      // Fallback: store in IndexedDB for later sync
      await this.storeBackgroundSyncTask(task);
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      await (registration as any).sync.register(task.id);
      
      // Store task data
      await this.storeBackgroundSyncTask(task);
    } catch (error) {
      console.error('Error registering background sync:', error);
      // Fallback to IndexedDB
      await this.storeBackgroundSyncTask(task);
    }
  }

  async storeBackgroundSyncTask(task: BackgroundSyncTask): Promise<void> {
    if (!this.db) await this.initializeDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['backgroundSync'], 'readwrite');
      const store = transaction.objectStore('backgroundSync');
      const request = store.add(task);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getBackgroundSyncTasks(): Promise<BackgroundSyncTask[]> {
    if (!this.db) await this.initializeDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['backgroundSync'], 'readonly');
      const store = transaction.objectStore('backgroundSync');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * QR Code Generation
   */
  async generateQRCode(data: QRCodeData): Promise<string> {
    try {
      const qrData = JSON.stringify({
        type: data.type,
        data: data.data,
        timestamp: new Date().toISOString(),
      });

      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${data.size || 200}x${data.size || 200}&data=${encodeURIComponent(qrData)}&format=${data.format || 'PNG'}`;
      
      return qrCodeUrl;
    } catch (error) {
      console.error('Error generating QR code:', error);
      throw new Error('Failed to generate QR code');
    }
  }

  /**
   * Camera Integration
   */
  async scanBarcode(): Promise<string | null> {
    try {
      if (!('mediaDevices' in navigator)) {
        throw new Error('Camera not supported');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      
      // This is a simplified implementation
      // In production, you would use a barcode scanning library like QuaggaJS or ZXing
      return new Promise((resolve) => {
        // Simulate barcode scanning
        setTimeout(() => {
          stream.getTracks().forEach(track => track.stop());
          resolve('123456789'); // Mock barcode
        }, 2000);
      });
    } catch (error) {
      console.error('Error scanning barcode:', error);
      return null;
    }
  }

  /**
   * GPS Tracking
   */
  async getCurrentLocation(): Promise<GeolocationPosition | null> {
    try {
      if (!('geolocation' in navigator)) {
        throw new Error('Geolocation not supported');
      }

      return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (position) => resolve(position),
          (error) => reject(error),
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000,
          }
        );
      });
    } catch (error) {
      console.error('Error getting location:', error);
      return null;
    }
  }

  /**
   * Voice Commands
   */
  async initializeVoiceCommands(): Promise<void> {
    try {
      if (!('webkitSpeechRecognition' in window)) {
        throw new Error('Speech recognition not supported');
      }

      const recognition = new (window as any).webkitSpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0])
          .map(result => result.transcript)
          .join('');

        this.processVoiceCommand(transcript);
      };

      recognition.start();
    } catch (error) {
      console.error('Error initializing voice commands:', error);
    }
  }

  private processVoiceCommand(transcript: string): void {
    const command = transcript.toLowerCase();
    
    if (command.includes('new order')) {
      // Navigate to new order page
      window.location.href = '/orders/new';
    } else if (command.includes('products')) {
      // Navigate to products page
      window.location.href = '/products';
    } else if (command.includes('customers')) {
      // Navigate to customers page
      window.location.href = '/customers';
    } else if (command.includes('analytics')) {
      // Navigate to analytics page
      window.location.href = '/analytics';
    }
  }

  /**
   * Touch Gestures
   */
  initializeTouchGestures(): void {
    let startX = 0;
    let startY = 0;
    let startTime = 0;

    document.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startTime = Date.now();
    });

    document.addEventListener('touchend', (e) => {
      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const endTime = Date.now();
      const duration = endTime - startTime;
      const distanceX = endX - startX;
      const distanceY = endY - startY;

      // Swipe detection
      if (duration < 300 && Math.abs(distanceX) > 50) {
        if (distanceX > 0) {
          this.handleSwipeRight();
        } else {
          this.handleSwipeLeft();
        }
      }

      // Long press detection
      if (duration > 500 && Math.abs(distanceX) < 10 && Math.abs(distanceY) < 10) {
        this.handleLongPress();
      }
    });
  }

  private handleSwipeRight(): void {
    // Navigate back or open sidebar
    console.log('Swipe right detected');
  }

  private handleSwipeLeft(): void {
    // Navigate forward or close sidebar
    console.log('Swipe left detected');
  }

  private handleLongPress(): void {
    // Show context menu or additional options
    console.log('Long press detected');
  }

  /**
   * Utility Methods
   */
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  private async sendSubscriptionToServer(subscription: PushSubscription): Promise<void> {
    try {
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(subscription),
      });
    } catch (error) {
      console.error('Error sending subscription to server:', error);
    }
  }

  private async storeNotification(notification: PushNotification): Promise<void> {
    if (!this.db) await this.initializeDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['notifications'], 'readwrite');
      const store = transaction.objectStore('notifications');
      const request = store.add({
        ...notification,
        timestamp: new Date(),
      });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async generateFingerprint(): Promise<string> {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // Generate a simple fingerprint
    ctx.fillStyle = 'rgb(255, 255, 255)';
    ctx.fillRect(0, 0, 100, 100);
    ctx.fillStyle = 'rgb(0, 0, 0)';
    ctx.fillText('SmartStore PWA', 10, 50);

    const dataURL = canvas.toDataURL();
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(dataURL));
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  async showNotification(title: string, options: NotificationOptions = {}): Promise<void> {
    if (!('Notification' in window)) {
      console.warn('Notifications not supported');
      return;
    }

    if (Notification.permission === 'granted') {
      const notification = new Notification(title, {
        icon: '/icon-192x192.png',
        badge: '/badge-72x72.png',
        ...options
      });

      // Handle notification actions if supported
      if ('actions' in options && Array.isArray((options as any).actions)) {
        (options as any).actions.forEach((action: any) => {
          // Handle action clicks
          notification.addEventListener('click', () => {
            console.log('Notification action clicked:', action.action);
          });
        });
      }

      // Don't return the notification object since method returns void
    } else if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        await this.showNotification(title, options);
      }
    }
  }

  async handleBackgroundSync(tag: string): Promise<void> {
    if ('serviceWorker' in navigator && 'sync' in (navigator.serviceWorker as any)) {
      const registration = await navigator.serviceWorker.ready;
      
      // Use type assertion for sync property
      if ('sync' in registration) {
        await (registration as any).sync.register(tag);
      } else {
        console.warn('Background sync not supported');
      }
    } else {
      console.warn('Service Worker or Background Sync not supported');
    }
  }
}

export const advancedPWAService = new AdvancedPWAService(); 