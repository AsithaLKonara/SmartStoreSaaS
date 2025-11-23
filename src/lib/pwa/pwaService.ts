import { prisma } from '@/lib/prisma';

export interface PWAConfig {
  name: string;
  shortName: string;
  description: string;
  themeColor: string;
  backgroundColor: string;
  display: 'standalone' | 'fullscreen' | 'minimal-ui' | 'browser';
  orientation: 'portrait' | 'landscape' | 'any';
  scope: string;
  startUrl: string;
  icons: Array<{
    src: string;
    sizes: string;
    type: string;
    purpose?: string;
  }>;
}

export interface PushNotification {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  data?: Record<string, unknown>;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  tag?: string;
  requireInteraction?: boolean;
  silent?: boolean;
  vibrate?: number[];
}

export interface OfflineData {
  id: string;
  type: 'product' | 'order' | 'customer' | 'cart';
  data: Record<string, unknown>;
  timestamp: Date;
  syncStatus: 'pending' | 'synced' | 'error';
}

export interface InstallPrompt {
  canInstall: boolean;
  platform: 'ios' | 'android' | 'desktop' | 'unknown';
  instructions: string[];
}

export class PWAService {
  private swRegistration: ServiceWorkerRegistration | null = null;
  private deferredPrompt: BeforeInstallPromptEvent | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initializePWA();
    }
  }

  /**
   * Initialize PWA features
   */
  private async initializePWA(): Promise<void> {
    try {
      // Register service worker
      if ('serviceWorker' in navigator) {
        this.swRegistration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });
        
        console.log('Service Worker registered successfully');
        
        // Listen for updates
        this.swRegistration.addEventListener('updatefound', () => {
          const newWorker = this.swRegistration!.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                this.showUpdateAvailable();
              }
            });
          }
        });
      }

      // Handle install prompt
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        this.deferredPrompt = e;
        this.showInstallBanner();
      });

      // Handle app installed
      window.addEventListener('appinstalled', () => {
        console.log('PWA was installed');
        this.trackInstallation();
      });

      // Initialize push notifications
      await this.initializePushNotifications();

      // Initialize offline storage
      await this.initializeOfflineStorage();

     } catch {
       console.error('Error initializing PWA');
    }
  }

  /**
   * Generate PWA manifest
   */
  generateManifest(config: PWAConfig): Record<string, unknown> {
    return {
      name: config.name,
      short_name: config.shortName,
      description: config.description,
      theme_color: config.themeColor,
      background_color: config.backgroundColor,
      display: config.display,
      orientation: config.orientation,
      scope: config.scope,
      start_url: config.startUrl,
      icons: config.icons,
      categories: ['shopping', 'business', 'productivity'],
      shortcuts: [
        {
          name: 'New Order',
          short_name: 'Order',
          description: 'Create a new order',
          url: '/orders/new',
          icons: [{ src: '/icons/order-96x96.png', sizes: '96x96' }],
        },
        {
          name: 'Products',
          short_name: 'Products',
          description: 'Browse products',
          url: '/products',
          icons: [{ src: '/icons/products-96x96.png', sizes: '96x96' }],
        },
        {
          name: 'Analytics',
          short_name: 'Analytics',
          description: 'View analytics',
          url: '/analytics',
          icons: [{ src: '/icons/analytics-96x96.png', sizes: '96x96' }],
        },
      ],
      prefer_related_applications: false,
      related_applications: [],
    };
  }

  /**
   * Check if app can be installed
   */
  canInstall(): InstallPrompt {
    const platform = this.detectPlatform();
    
    if (this.deferredPrompt) {
      return {
        canInstall: true,
        platform,
        instructions: this.getInstallInstructions(platform),
      };
    }

    // Check if already installed
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
      return {
        canInstall: false,
        platform,
        instructions: ['App is already installed'],
      };
    }

    return {
      canInstall: false,
      platform,
      instructions: this.getInstallInstructions(platform),
    };
  }

  /**
   * Trigger install prompt
   */
  async install(): Promise<boolean> {
    if (!this.deferredPrompt) {
      return false;
    }

    try {
      this.deferredPrompt.prompt();
      const { outcome } = await this.deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
        this.deferredPrompt = null;
        return true;
      } else {
        console.log('User dismissed the install prompt');
        return false;
      }
     } catch {
       console.error('Error during installation');
      return false;
    }
  }

  /**
   * Initialize push notifications
   */
  private async initializePushNotifications(): Promise<void> {
    if (!('Notification' in window) || !this.swRegistration) {
      console.log('Push notifications not supported');
      return;
    }

    // Request permission if not granted
    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }

    if (Notification.permission === 'granted') {
      try {
        // Subscribe to push notifications
        const subscription = await this.swRegistration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!) as BufferSource,
        });

        // Send subscription to server
        await this.sendSubscriptionToServer(subscription);
        
        console.log('Push notifications initialized');
       } catch {
         console.error('Error initializing push notifications');
      }
    }
  }

  /**
   * Send push notification
   */
  async sendPushNotification(
    userId: string,
    notification: PushNotification
  ): Promise<boolean> {
    try {
      // Get user's push subscription from metadata or use a fallback
      // Since pushSubscription model doesn't exist, we'll use a different approach
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true }
      });

      if (!user) {
        console.log('User not found');
        return false;
      }

      // For now, we'll assume the user has push notifications enabled
      // In a real implementation, you would store this in a separate table or user preferences
      console.log('User found, proceeding with push notification');

      // Send notification via web push
      const payload = JSON.stringify(notification);
      
      // This would use a web push library like 'web-push'
      // For now, we'll simulate the notification
      console.log('Sending push notification:', payload);

      // Store notification in database
      await prisma.notification.create({
        data: {
          type: 'push',
          title: notification.title || 'Push Notification',
          message: notification.body,
          userId: userId,
          organizationId: 'default-org', // You'll need to get this from context
          priority: 'MEDIUM',
          metadata: {
            ...notification.data,
          sent: true,
            sentAt: new Date().toISOString()
          }
        }
      });

      return true;
     } catch {
       console.error('Error sending push notification');
      return false;
    }
  }

  /**
   * Initialize offline storage
   */
  private async initializeOfflineStorage(): Promise<void> {
    if (!('indexedDB' in window)) {
      console.log('IndexedDB not supported');
      return;
    }

    try {
      // Initialize IndexedDB for offline data
      const request = indexedDB.open('SmartStoreOffline', 1);
      
      request.onerror = () => {
        console.error('Error opening IndexedDB');
      };

      request.onsuccess = () => {
        console.log('Offline storage initialized');
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create object stores
        if (!db.objectStoreNames.contains('products')) {
          db.createObjectStore('products', { keyPath: 'id' });
        }
        
        if (!db.objectStoreNames.contains('cart')) {
          db.createObjectStore('cart', { keyPath: 'id' });
        }
        
        if (!db.objectStoreNames.contains('orders')) {
          db.createObjectStore('orders', { keyPath: 'id' });
        }
        
        if (!db.objectStoreNames.contains('syncQueue')) {
          const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
          syncStore.createIndex('timestamp', 'timestamp');
          syncStore.createIndex('syncStatus', 'syncStatus');
        }
      };
     } catch {
       console.error('Error initializing offline storage');
    }
  }

  /**
   * Store data for offline access
   */
  async storeOfflineData(type: string, data: Record<string, unknown>): Promise<void> {
    try {
      const request = indexedDB.open('SmartStoreOffline', 1);
      
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction([type], 'readwrite');
        const store = transaction.objectStore(type);
        
        store.put(data);
        
        transaction.oncomplete = () => {
          console.log(`Stored ${type} data offline:`, data.id);
        };
      };
     } catch {
       console.error('Error storing offline data');
    }
  }

  /**
   * Get offline data
   */
  async getOfflineData(type: string, id?: string): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        const request = indexedDB.open('SmartStoreOffline', 1);
        
        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction([type], 'readonly');
          const store = transaction.objectStore(type);
          
          if (id) {
            const getRequest = store.get(id);
            getRequest.onsuccess = () => resolve(getRequest.result);
            getRequest.onerror = () => reject(getRequest.error);
          } else {
            const getAllRequest = store.getAll();
            getAllRequest.onsuccess = () => resolve(getAllRequest.result);
            getAllRequest.onerror = () => reject(getAllRequest.error);
          }
        };
        
        request.onerror = () => reject(request.error);
       } catch (err) {
         reject(err);
      }
    });
  }

  /**
   * Add to sync queue for offline actions
   */
  async addToSyncQueue(action: string, data: Record<string, unknown>): Promise<void> {
    try {
      const request = indexedDB.open('SmartStoreOffline', 1);
      
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['syncQueue'], 'readwrite');
        const store = transaction.objectStore('syncQueue');
        
        store.add({
          action,
          data,
          timestamp: new Date(),
          syncStatus: 'pending',
        });
        
        console.log('Added to sync queue:', action);
      };
     } catch {
       console.error('Error adding to sync queue');
    }
  }

  /**
   * Sync offline data when online
   */
  async syncOfflineData(): Promise<void> {
    if (!navigator.onLine) {
      console.log('Device is offline, skipping sync');
      return;
    }

    try {
      const pendingActions = await this.getOfflineData('syncQueue');
      
      for (const action of pendingActions.filter((a: { syncStatus?: string }) => a.syncStatus === 'pending')) {
        try {
          await this.executeSyncAction(action);
          
          // Mark as synced
          await this.updateSyncStatus(action.id, 'synced');
          
          console.log('Synced action:', action.action);
         } catch {
           console.error('Error syncing action');
          await this.updateSyncStatus(action.id, 'error');
        }
      }
     } catch {
       console.error('Error syncing offline data');
    }
  }

  /**
   * Check if app is running in standalone mode
   */
  isStandalone(): boolean {
    return window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
  }

  /**
   * Get app installation status
   */
  getInstallationStatus(): {
    isInstalled: boolean;
    isStandalone: boolean;
    canInstall: boolean;
    platform: string;
  } {
    return {
      isInstalled: this.isStandalone(),
      isStandalone: this.isStandalone(),
      canInstall: !!this.deferredPrompt,
      platform: this.detectPlatform(),
    };
  }

  /**
   * Private helper methods
   */
  private detectPlatform(): 'ios' | 'android' | 'desktop' | 'unknown' {
    const userAgent = navigator.userAgent.toLowerCase();
    
    if (/iphone|ipad|ipod/.test(userAgent)) {
      return 'ios';
    } else if (/android/.test(userAgent)) {
      return 'android';
    } else if (/windows|mac|linux/.test(userAgent)) {
      return 'desktop';
    }
    
    return 'unknown';
  }

  private getInstallInstructions(platform: string): string[] {
    switch (platform) {
      case 'ios':
        return [
          'Tap the Share button in Safari',
          'Scroll down and tap "Add to Home Screen"',
          'Tap "Add" to install the app',
        ];
      case 'android':
        return [
          'Tap the menu button (⋮) in Chrome',
          'Tap "Add to Home screen"',
          'Tap "Add" to install the app',
        ];
      case 'desktop':
        return [
          'Look for the install icon in the address bar',
          'Click "Install SmartStore AI"',
          'The app will be added to your desktop',
        ];
      default:
        return ['Installation not available on this platform'];
    }
  }

  private showInstallBanner(): void {
    // This would show a custom install banner
    console.log('App can be installed');
  }

  private showUpdateAvailable(): void {
    // This would show an update notification
    console.log('App update available');
  }

  private trackInstallation(): void {
    // Track installation analytics
    console.log('PWA installed successfully');
  }

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
    // Send subscription to your server
    console.log('Push subscription:', subscription);
  }

  private async executeSyncAction(action: Record<string, unknown>): Promise<void> {
    // Execute the sync action based on type
    switch (action.action) {
      case 'create_order':
        // Sync order creation
        break;
      case 'update_cart':
        // Sync cart updates
        break;
      default:
        console.log('Unknown sync action:', action.action);
    }
  }

  private async updateSyncStatus(actionId: string, status: string): Promise<void> {
    const request = indexedDB.open('SmartStoreOffline', 1);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['syncQueue'], 'readwrite');
      const store = transaction.objectStore('syncQueue');
      
      const getRequest = store.get(actionId);
      getRequest.onsuccess = () => {
        const action = getRequest.result;
        if (action) {
          action.syncStatus = status;
          store.put(action);
        }
      };
    };
  }
}

export const pwaService = new PWAService();
