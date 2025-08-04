import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';

interface PWAStatus {
  isInstalled: boolean;
  isOnline: boolean;
  isUpdateAvailable: boolean;
  canInstall: boolean;
  isSupported: boolean;
}

interface NotificationPermission {
  permission: NotificationPermission;
  isSupported: boolean;
}

export function usePWA() {
  const [pwaStatus, setPwaStatus] = useState<PWAStatus>({
    isInstalled: false,
    isOnline: navigator.onLine,
    isUpdateAvailable: false,
    canInstall: false,
    isSupported: 'serviceWorker' in navigator,
  });

  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>({
    permission: 'default',
    isSupported: 'Notification' in window,
  });

  // Check if PWA is installed
  useEffect(() => {
    const checkInstallation = () => {
      const isInstalled = window.matchMedia('(display-mode: standalone)').matches ||
                         (window.navigator as any).standalone === true;
      setPwaStatus(prev => ({ ...prev, isInstalled }));
    };

    checkInstallation();
    window.addEventListener('appinstalled', checkInstallation);
    return () => window.removeEventListener('appinstalled', checkInstallation);
  }, []);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setPwaStatus(prev => ({ ...prev, isOnline: true }));
    const handleOffline = () => setPwaStatus(prev => ({ ...prev, isOnline: false }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Check for PWA install prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setPwaStatus(prev => ({ ...prev, canInstall: true }));
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  // Register service worker
  const registerServiceWorker = useCallback(async () => {
    if (!('serviceWorker' in navigator)) {
      console.log('Service Worker not supported');
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered:', registration);

      // Check for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setPwaStatus(prev => ({ ...prev, isUpdateAvailable: true }));
              toast.success('New version available! Refresh to update.');
            }
          });
        }
      });

      return true;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return false;
    }
  }, []);

  // Install PWA
  const installPWA = useCallback(async () => {
    if (!pwaStatus.canInstall) {
      toast.error('PWA installation not available');
      return false;
    }

    try {
      // Trigger install prompt
      const promptEvent = (window as any).deferredPrompt;
      if (promptEvent) {
        promptEvent.prompt();
        const { outcome } = await promptEvent.userChoice;
        
        if (outcome === 'accepted') {
          toast.success('SmartStore AI installed successfully!');
          setPwaStatus(prev => ({ ...prev, canInstall: false }));
          (window as any).deferredPrompt = null;
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('PWA installation failed:', error);
      toast.error('Installation failed');
      return false;
    }
  }, [pwaStatus.canInstall]);

  // Request notification permission
  const requestNotificationPermission = useCallback(async () => {
    if (!notificationPermission.isSupported) {
      toast.error('Notifications not supported');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(prev => ({ ...prev, permission }));
      
      if (permission === 'granted') {
        toast.success('Notifications enabled!');
        return true;
      } else {
        toast.error('Notification permission denied');
        return false;
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }, [notificationPermission.isSupported]);

  // Send push notification
  const sendPushNotification = useCallback(async (title: string, options?: NotificationOptions) => {
    if (notificationPermission.permission !== 'granted') {
      const granted = await requestNotificationPermission();
      if (!granted) return false;
    }

    try {
      const notification = new Notification(title, {
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        vibrate: [100, 50, 100],
        ...options,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      return true;
    } catch (error) {
      console.error('Error sending notification:', error);
      return false;
    }
  }, [notificationPermission.permission, requestNotificationPermission]);

  // Subscribe to push notifications
  const subscribeToPushNotifications = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      toast.error('Push notifications not supported');
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      });

      // Send subscription to server
      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription),
      });

      if (response.ok) {
        toast.success('Push notifications enabled!');
        return true;
      } else {
        toast.error('Failed to enable push notifications');
        return false;
      }
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      toast.error('Failed to enable push notifications');
      return false;
    }
  }, []);

  // Update PWA
  const updatePWA = useCallback(() => {
    if (pwaStatus.isUpdateAvailable) {
      window.location.reload();
    }
  }, [pwaStatus.isUpdateAvailable]);

  // Background sync
  const requestBackgroundSync = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('sync' in (navigator.serviceWorker as any))) {
      toast.error('Background sync not supported');
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      await (registration.sync as any).register('background-sync');
      toast.success('Background sync registered');
      return true;
    } catch (error) {
      console.error('Error registering background sync:', error);
      return false;
    }
  }, []);

  // Initialize PWA
  useEffect(() => {
    registerServiceWorker();
  }, [registerServiceWorker]);

  return {
    pwaStatus,
    notificationPermission,
    registerServiceWorker,
    installPWA,
    requestNotificationPermission,
    sendPushNotification,
    subscribeToPushNotifications,
    updatePWA,
    requestBackgroundSync,
  };
} 