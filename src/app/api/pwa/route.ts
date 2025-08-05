import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { advancedPWAService } from '@/lib/pwa/advancedPWAService';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const organizationId = session.user.organizationId;

    switch (type) {
      case 'offline-data':
        const dataType = searchParams.get('dataType');
        const offlineData = await advancedPWAService.getOfflineData(dataType);
        return NextResponse.json({ offlineData });

      case 'background-sync-tasks':
        const syncTasks = await advancedPWAService.getBackgroundSyncTasks();
        return NextResponse.json({ syncTasks });

      case 'qr-code':
        const { qrType, qrData, size, format } = searchParams;
        const qrCodeUrl = await advancedPWAService.generateQRCode({
          type: qrType as any,
          data: JSON.parse(qrData || '{}'),
          size: size ? parseInt(size) : 200,
          format: format as 'PNG' | 'SVG' || 'PNG',
        });
        return NextResponse.json({ qrCodeUrl });

      case 'pwa-status':
        // Get PWA installation and usage statistics
        const pwaStats = await prisma.pWAStats.findMany({
          where: { organizationId },
          orderBy: { createdAt: 'desc' },
          take: 1,
        });

        const currentStats = pwaStats[0] || {
          totalInstalls: 0,
          activeUsers: 0,
          offlineUsage: 0,
          pushSubscriptions: 0,
        };

        return NextResponse.json({ pwaStats: currentStats });

      case 'notification-history':
        const notifications = await prisma.pushNotification.findMany({
          where: { organizationId },
          orderBy: { createdAt: 'desc' },
          take: 50,
        });
        return NextResponse.json({ notifications });

      default:
        return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in PWA API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, data } = body;
    const organizationId = session.user.organizationId;

    switch (action) {
      case 'subscribe-push':
        const subscription = await advancedPWAService.subscribeToPushNotifications();
        if (subscription) {
          // Store subscription in database
          await prisma.pushSubscription.create({
            data: {
              userId: session.user.id,
              organizationId,
              subscription: subscription.toJSON(),
              isActive: true,
            },
          });
        }
        return NextResponse.json({ subscription });

      case 'send-push-notification':
        const { title, body, icon, badge, notificationData, actions, requireInteraction, silent } = data;
        const notification = {
          id: crypto.randomUUID(),
          title,
          body,
          icon,
          badge,
          data: notificationData,
          actions,
          requireInteraction,
          silent,
        };

        await advancedPWAService.sendPushNotification(notification);

        // Store notification in database
        await prisma.pushNotification.create({
          data: {
            ...notification,
            organizationId,
            sentBy: session.user.id,
            status: 'SENT',
          },
        });

        return NextResponse.json({ notification });

      case 'store-offline-data':
        const { offlineDataType, offlineDataContent } = data;
        await advancedPWAService.storeOfflineData({
          type: offlineDataType,
          data: offlineDataContent,
          timestamp: new Date(),
          id: crypto.randomUUID(),
        });
        return NextResponse.json({ success: true });

      case 'register-background-sync':
        const { syncType, syncData, maxRetries } = data;
        await advancedPWAService.registerBackgroundSync({
          id: crypto.randomUUID(),
          type: syncType,
          data: syncData,
          retryCount: 0,
          maxRetries: maxRetries || 3,
          createdAt: new Date(),
        });
        return NextResponse.json({ success: true });

      case 'scan-barcode':
        const barcode = await advancedPWAService.scanBarcode();
        return NextResponse.json({ barcode });

      case 'get-location':
        const location = await advancedPWAService.getCurrentLocation();
        return NextResponse.json({ location });

      case 'initialize-voice-commands':
        await advancedPWAService.initializeVoiceCommands();
        return NextResponse.json({ success: true });

      case 'initialize-touch-gestures':
        advancedPWAService.initializeTouchGestures();
        return NextResponse.json({ success: true });

      case 'update-pwa-stats':
        const { installs, activeUsers, offlineUsage, pushSubscriptions } = data;
        await prisma.pWAStats.create({
          data: {
            organizationId,
            totalInstalls: installs,
            activeUsers,
            offlineUsage,
            pushSubscriptions,
            recordedAt: new Date(),
          },
        });
        return NextResponse.json({ success: true });

      case 'clear-offline-data':
        const { clearDataType } = data;
        await advancedPWAService.clearOfflineData(clearDataType);
        return NextResponse.json({ success: true });

      case 'sync-offline-data':
        // Sync offline data with server
        const offlineDataToSync = await advancedPWAService.getOfflineData();
        
        for (const item of offlineDataToSync) {
          try {
            switch (item.type) {
              case 'ORDER':
                // Sync offline orders
                await prisma.order.create({
                  data: {
                    ...item.data,
                    organizationId,
                    status: 'PENDING',
                    isOfflineSync: true,
                  },
                });
                break;
              case 'MESSAGE':
                // Sync offline messages
                await prisma.chatMessage.create({
                  data: {
                    ...item.data,
                    organizationId,
                    isOfflineSync: true,
                  },
                });
                break;
              case 'SYNC':
                // Handle other sync data
                console.log('Syncing data:', item.data);
                break;
            }
          } catch (error) {
            console.error('Error syncing offline data:', error);
          }
        }

        // Clear synced data
        await advancedPWAService.clearOfflineData();

        return NextResponse.json({ 
          success: true, 
          syncedItems: offlineDataToSync.length 
        });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in PWA API POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 