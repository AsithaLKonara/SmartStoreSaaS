import { prisma } from '@/lib/prisma';
import { realTimeSyncService } from '@/lib/sync/realTimeSyncService';
import { emailService } from '@/lib/email/emailService';
import { smsService } from '@/lib/sms/smsService';

export interface IoTDevice {
  id: string;
  name: string;
  type: 'sensor' | 'beacon' | 'camera' | 'scale' | 'thermometer' | 'rfid_reader' | 'smart_shelf' | 'pos_terminal';
  location: string;
  warehouseId?: string;
  storeId?: string;
  macAddress: string;
  ipAddress?: string;
  firmwareVersion: string;
  batteryLevel?: number;
  status: 'online' | 'offline' | 'maintenance' | 'error';
  lastSeen: Date;
  configuration: Record<string, any>;
  metadata: Record<string, any>;
  isActive: boolean;
  installedAt: Date;
}

export interface SensorReading {
  id: string;
  deviceId: string;
  type: 'temperature' | 'humidity' | 'weight' | 'motion' | 'proximity' | 'light' | 'sound' | 'air_quality';
  value: number;
  unit: string;
  timestamp: Date;
  location: string;
  metadata?: Record<string, any>;
}

export interface SmartShelfData {
  deviceId: string;
  shelfId: string;
  products: Array<{
    productId: string;
    sku: string;
    quantity: number;
    weight: number;
    lastUpdated: Date;
  }>;
  capacity: {
    total: number;
    used: number;
    available: number;
  };
  alerts: Array<{
    type: 'low_stock' | 'out_of_stock' | 'overweight' | 'misplaced';
    productId?: string;
    message: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }>;
}

export interface BeaconData {
  deviceId: string;
  beaconId: string;
  uuid: string;
  major: number;
  minor: number;
  rssi: number;
  proximity: 'immediate' | 'near' | 'far' | 'unknown';
  customerDevices: Array<{
    deviceId: string;
    userId?: string;
    entryTime: Date;
    exitTime?: Date;
    dwellTime?: number; // seconds
    interactions: number;
  }>;
}

export interface RFIDReading {
  deviceId: string;
  tagId: string;
  productId?: string;
  location: string;
  action: 'read' | 'write' | 'inventory';
  timestamp: Date;
  signalStrength: number;
  metadata?: Record<string, any>;
}

export interface IoTAlert {
  id: string;
  deviceId: string;
  type: 'device_offline' | 'low_battery' | 'sensor_anomaly' | 'security_breach' | 'maintenance_required';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  data: Record<string, any>;
  isResolved: boolean;
  createdAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
}

export interface EnvironmentalConditions {
  location: string;
  timestamp: Date;
  temperature: {
    current: number;
    min: number;
    max: number;
    unit: 'C' | 'F';
  };
  humidity: {
    current: number;
    min: number;
    max: number;
    unit: '%';
  };
  airQuality: {
    index: number;
    status: 'good' | 'moderate' | 'poor' | 'hazardous';
    co2: number;
    particles: number;
  };
  lighting: {
    lux: number;
    status: 'dim' | 'normal' | 'bright';
  };
}

export class IoTService {
  private deviceConnections: Map<string, WebSocket> = new Map();
  private sensorDataBuffer: Map<string, SensorReading[]> = new Map();
  private alertThresholds: Map<string, any> = new Map();

  constructor() {
    this.initializeIoTService();
  }

  /**
   * Initialize IoT service
   */
  private initializeIoTService(): void {
    try {
      // Set up default alert thresholds
      this.setupDefaultThresholds();
      
      // Start periodic tasks
      this.startPeriodicTasks();
      
      console.log('IoT service initialized');
    } catch (error) {
      console.error('Error initializing IoT service:', error);
    }
  }

  /**
   * Register new IoT device
   */
  async registerDevice(deviceData: Omit<IoTDevice, 'id' | 'lastSeen' | 'installedAt'>): Promise<IoTDevice> {
    try {
      const device = await prisma.iotDevice.create({
        data: {
          name: deviceData.name,
          type: deviceData.type,
          location: deviceData.location,
          warehouseId: deviceData.warehouseId,
          storeId: deviceData.storeId,
          macAddress: deviceData.macAddress,
          ipAddress: deviceData.ipAddress,
          firmwareVersion: deviceData.firmwareVersion,
          batteryLevel: deviceData.batteryLevel,
          status: deviceData.status,
          lastSeen: new Date(),
          configuration: deviceData.configuration,
          metadata: deviceData.metadata,
          isActive: deviceData.isActive,
          installedAt: new Date(),
        },
      });

      // Broadcast device registration
      await realTimeSyncService.broadcastEvent({
        type: 'iot_device_registered',
        entityId: device.id,
        entityType: 'iot_device',
        organizationId: 'iot',
        data: device,
        timestamp: new Date(),
      });

      return this.mapDeviceFromDB(device);
    } catch (error) {
      console.error('Error registering IoT device:', error);
      throw new Error('Failed to register IoT device');
    }
  }

  /**
   * Connect device via WebSocket
   */
  async connectDevice(deviceId: string, ws: WebSocket): Promise<void> {
    try {
      // Store connection
      this.deviceConnections.set(deviceId, ws);

      // Update device status
      await prisma.iotDevice.update({
        where: { id: deviceId },
        data: {
          status: 'online',
          lastSeen: new Date(),
        },
      });

      // Set up message handlers
      ws.onmessage = (event) => {
        this.handleDeviceMessage(deviceId, JSON.parse(event.data));
      };

      ws.onclose = () => {
        this.handleDeviceDisconnect(deviceId);
      };

      ws.onerror = (error) => {
        console.error(`WebSocket error for device ${deviceId}:`, error);
      };

      console.log(`Device ${deviceId} connected`);
    } catch (error) {
      console.error('Error connecting device:', error);
    }
  }

  /**
   * Process sensor reading
   */
  async processSensorReading(
    deviceId: string,
    reading: Omit<SensorReading, 'id' | 'deviceId' | 'timestamp'>
  ): Promise<SensorReading> {
    try {
      const sensorReading = await prisma.sensorReading.create({
        data: {
          deviceId,
          type: reading.type,
          value: reading.value,
          unit: reading.unit,
          timestamp: new Date(),
          location: reading.location,
          metadata: reading.metadata,
        },
      });

      // Buffer reading for batch processing
      if (!this.sensorDataBuffer.has(deviceId)) {
        this.sensorDataBuffer.set(deviceId, []);
      }
      
      const buffer = this.sensorDataBuffer.get(deviceId)!;
      buffer.push(this.mapSensorReadingFromDB(sensorReading));

      // Check for alerts
      await this.checkSensorAlerts(deviceId, reading);

      // Update device last seen
      await this.updateDeviceLastSeen(deviceId);

      return this.mapSensorReadingFromDB(sensorReading);
    } catch (error) {
      console.error('Error processing sensor reading:', error);
      throw new Error('Failed to process sensor reading');
    }
  }

  /**
   * Process smart shelf data
   */
  async processSmartShelfData(shelfData: SmartShelfData): Promise<void> {
    try {
      // Update product quantities based on shelf readings
      for (const product of shelfData.products) {
        await this.updateProductQuantityFromShelf(
          product.productId,
          product.quantity,
          shelfData.deviceId
        );
      }

      // Process alerts
      for (const alert of shelfData.alerts) {
        if (alert.severity === 'high' || alert.severity === 'critical') {
          await this.createAlert({
            deviceId: shelfData.deviceId,
            type: alert.type as any,
            severity: alert.severity,
            message: alert.message,
            data: { shelfId: shelfData.shelfId, productId: alert.productId },
          });
        }
      }

      // Broadcast shelf update
      await realTimeSyncService.broadcastEvent({
        type: 'smart_shelf_updated',
        entityId: shelfData.deviceId,
        entityType: 'smart_shelf',
        organizationId: 'iot',
        data: shelfData,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('Error processing smart shelf data:', error);
    }
  }

  /**
   * Process beacon data for customer analytics
   */
  async processBeaconData(beaconData: BeaconData): Promise<void> {
    try {
      // Store customer interaction data
      for (const customer of beaconData.customerDevices) {
        await prisma.customerInteraction.upsert({
          where: {
            deviceId_beaconId: {
              deviceId: customer.deviceId,
              beaconId: beaconData.beaconId,
            },
          },
          update: {
            exitTime: customer.exitTime,
            dwellTime: customer.dwellTime,
            interactions: customer.interactions,
            lastSeen: new Date(),
          },
          create: {
            deviceId: customer.deviceId,
            userId: customer.userId,
            beaconId: beaconData.beaconId,
            location: beaconData.deviceId, // Using device location
            entryTime: customer.entryTime,
            exitTime: customer.exitTime,
            dwellTime: customer.dwellTime,
            interactions: customer.interactions,
            lastSeen: new Date(),
          },
        });
      }

      // Generate location-based insights
      await this.generateLocationInsights(beaconData);
    } catch (error) {
      console.error('Error processing beacon data:', error);
    }
  }

  /**
   * Process RFID readings for inventory tracking
   */
  async processRFIDReading(reading: RFIDReading): Promise<void> {
    try {
      // Store RFID reading
      await prisma.rfidReading.create({
        data: {
          deviceId: reading.deviceId,
          tagId: reading.tagId,
          productId: reading.productId,
          location: reading.location,
          action: reading.action,
          timestamp: reading.timestamp,
          signalStrength: reading.signalStrength,
          metadata: reading.metadata,
        },
      });

      // Update inventory based on RFID reading
      if (reading.productId && reading.action === 'inventory') {
        await this.updateInventoryFromRFID(reading);
      }

      // Check for security alerts (unauthorized tag movement)
      await this.checkRFIDSecurity(reading);
    } catch (error) {
      console.error('Error processing RFID reading:', error);
    }
  }

  /**
   * Get environmental conditions for location
   */
  async getEnvironmentalConditions(location: string): Promise<EnvironmentalConditions> {
    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      // Get recent sensor readings for the location
      const readings = await prisma.sensorReading.findMany({
        where: {
          location,
          timestamp: {
            gte: oneHourAgo,
          },
        },
        orderBy: { timestamp: 'desc' },
      });

      // Process readings by type
      const temperatureReadings = readings.filter(r => r.type === 'temperature');
      const humidityReadings = readings.filter(r => r.type === 'humidity');
      const lightReadings = readings.filter(r => r.type === 'light');
      const airQualityReadings = readings.filter(r => r.type === 'air_quality');

      return {
        location,
        timestamp: now,
        temperature: {
          current: temperatureReadings[0]?.value || 22,
          min: Math.min(...temperatureReadings.map(r => r.value)) || 20,
          max: Math.max(...temperatureReadings.map(r => r.value)) || 25,
          unit: 'C',
        },
        humidity: {
          current: humidityReadings[0]?.value || 45,
          min: Math.min(...humidityReadings.map(r => r.value)) || 40,
          max: Math.max(...humidityReadings.map(r => r.value)) || 60,
          unit: '%',
        },
        airQuality: {
          index: airQualityReadings[0]?.value || 50,
          status: this.getAirQualityStatus(airQualityReadings[0]?.value || 50),
          co2: 400,
          particles: 10,
        },
        lighting: {
          lux: lightReadings[0]?.value || 500,
          status: this.getLightingStatus(lightReadings[0]?.value || 500),
        },
      };
    } catch (error) {
      console.error('Error getting environmental conditions:', error);
      throw new Error('Failed to get environmental conditions');
    }
  }

  /**
   * Get device analytics
   */
  async getDeviceAnalytics(
    deviceId?: string,
    timeRange: '1h' | '24h' | '7d' | '30d' = '24h'
  ): Promise<{
    totalDevices: number;
    onlineDevices: number;
    offlineDevices: number;
    batteryAlerts: number;
    sensorReadings: number;
    alerts: IoTAlert[];
    deviceUptime: Record<string, number>;
  }> {
    try {
      const timeRangeMs = {
        '1h': 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000,
      };

      const since = new Date(Date.now() - timeRangeMs[timeRange]);

      // Get device counts
      const totalDevices = await prisma.iotDevice.count({
        where: deviceId ? { id: deviceId } : {},
      });

      const onlineDevices = await prisma.iotDevice.count({
        where: {
          ...(deviceId ? { id: deviceId } : {}),
          status: 'online',
        },
      });

      const offlineDevices = totalDevices - onlineDevices;

      const batteryAlerts = await prisma.iotDevice.count({
        where: {
          ...(deviceId ? { id: deviceId } : {}),
          batteryLevel: { lt: 20 },
        },
      });

      const sensorReadings = await prisma.sensorReading.count({
        where: {
          ...(deviceId ? { deviceId } : {}),
          timestamp: { gte: since },
        },
      });

      const alerts = await prisma.iotAlert.findMany({
        where: {
          ...(deviceId ? { deviceId } : {}),
          createdAt: { gte: since },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      // Calculate device uptime
      const devices = await prisma.iotDevice.findMany({
        where: deviceId ? { id: deviceId } : {},
      });

      const deviceUptime: Record<string, number> = {};
      for (const device of devices) {
        const uptime = this.calculateDeviceUptime(device, since);
        deviceUptime[device.id] = uptime;
      }

      return {
        totalDevices,
        onlineDevices,
        offlineDevices,
        batteryAlerts,
        sensorReadings,
        alerts: alerts.map(this.mapAlertFromDB),
        deviceUptime,
      };
    } catch (error) {
      console.error('Error getting device analytics:', error);
      throw new Error('Failed to get device analytics');
    }
  }

  /**
   * Create IoT alert
   */
  async createAlert(alertData: Omit<IoTAlert, 'id' | 'isResolved' | 'createdAt'>): Promise<IoTAlert> {
    try {
      const alert = await prisma.iotAlert.create({
        data: {
          deviceId: alertData.deviceId,
          type: alertData.type,
          severity: alertData.severity,
          message: alertData.message,
          data: alertData.data,
          isResolved: false,
        },
      });

      // Send notifications for critical alerts
      if (alertData.severity === 'critical') {
        await this.sendCriticalAlertNotifications(alert);
      }

      // Broadcast alert
      await realTimeSyncService.broadcastEvent({
        type: 'iot_alert_created',
        entityId: alert.id,
        entityType: 'iot_alert',
        organizationId: 'iot',
        data: alert,
        timestamp: new Date(),
      });

      return this.mapAlertFromDB(alert);
    } catch (error) {
      console.error('Error creating IoT alert:', error);
      throw new Error('Failed to create IoT alert');
    }
  }

  /**
   * Resolve alert
   */
  async resolveAlert(alertId: string, resolvedBy: string): Promise<IoTAlert> {
    try {
      const alert = await prisma.iotAlert.update({
        where: { id: alertId },
        data: {
          isResolved: true,
          resolvedAt: new Date(),
          resolvedBy,
        },
      });

      return this.mapAlertFromDB(alert);
    } catch (error) {
      console.error('Error resolving alert:', error);
      throw new Error('Failed to resolve alert');
    }
  }

  /**
   * Private helper methods
   */
  private setupDefaultThresholds(): void {
    this.alertThresholds.set('temperature', { min: 18, max: 25 });
    this.alertThresholds.set('humidity', { min: 30, max: 70 });
    this.alertThresholds.set('battery', { critical: 10, low: 20 });
    this.alertThresholds.set('offline_timeout', 300); // 5 minutes
  }

  private startPeriodicTasks(): void {
    // Check for offline devices every minute
    setInterval(() => {
      this.checkOfflineDevices();
    }, 60 * 1000);

    // Process buffered sensor data every 5 minutes
    setInterval(() => {
      this.processSensorDataBuffer();
    }, 5 * 60 * 1000);

    // Check battery levels every hour
    setInterval(() => {
      this.checkBatteryLevels();
    }, 60 * 60 * 1000);
  }

  private async handleDeviceMessage(deviceId: string, message: any): Promise<void> {
    try {
      switch (message.type) {
        case 'sensor_reading':
          await this.processSensorReading(deviceId, message.data);
          break;
        case 'smart_shelf_data':
          await this.processSmartShelfData({ ...message.data, deviceId });
          break;
        case 'beacon_data':
          await this.processBeaconData({ ...message.data, deviceId });
          break;
        case 'rfid_reading':
          await this.processRFIDReading({ ...message.data, deviceId });
          break;
        case 'heartbeat':
          await this.updateDeviceLastSeen(deviceId);
          break;
        default:
          console.log(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error(`Error handling message from device ${deviceId}:`, error);
    }
  }

  private async handleDeviceDisconnect(deviceId: string): Promise<void> {
    try {
      this.deviceConnections.delete(deviceId);
      
      await prisma.iotDevice.update({
        where: { id: deviceId },
        data: { status: 'offline' },
      });

      console.log(`Device ${deviceId} disconnected`);
    } catch (error) {
      console.error(`Error handling disconnect for device ${deviceId}:`, error);
    }
  }

  private async checkSensorAlerts(deviceId: string, reading: any): Promise<void> {
    const thresholds = this.alertThresholds.get(reading.type);
    if (!thresholds) return;

    let alertType: string | null = null;
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';

    if (reading.value < thresholds.min) {
      alertType = `${reading.type}_low`;
      severity = 'medium';
    } else if (reading.value > thresholds.max) {
      alertType = `${reading.type}_high`;
      severity = 'medium';
    }

    if (alertType) {
      await this.createAlert({
        deviceId,
        type: 'sensor_anomaly',
        severity,
        message: `${reading.type} reading of ${reading.value}${reading.unit} is outside normal range`,
        data: { reading, thresholds },
      });
    }
  }

  private async updateDeviceLastSeen(deviceId: string): Promise<void> {
    await prisma.iotDevice.update({
      where: { id: deviceId },
      data: { lastSeen: new Date() },
    });
  }

  private async updateProductQuantityFromShelf(
    productId: string,
    quantity: number,
    deviceId: string
  ): Promise<void> {
    // Update product inventory based on smart shelf reading
    await prisma.product.update({
      where: { id: productId },
      data: { 
        stock: quantity,
        lastInventoryUpdate: new Date(),
      },
    });

    console.log(`Updated product ${productId} quantity to ${quantity} from shelf ${deviceId}`);
  }

  private async generateLocationInsights(beaconData: BeaconData): Promise<void> {
    // Generate insights about customer behavior in specific locations
    const insights = {
      location: beaconData.deviceId,
      totalVisitors: beaconData.customerDevices.length,
      averageDwellTime: beaconData.customerDevices.reduce((sum, c) => sum + (c.dwellTime || 0), 0) / beaconData.customerDevices.length,
      peakHours: this.calculatePeakHours(beaconData.customerDevices),
    };

    console.log('Location insights:', insights);
  }

  private async updateInventoryFromRFID(reading: RFIDReading): Promise<void> {
    if (!reading.productId) return;

    // Update product location based on RFID reading
    await prisma.product.update({
      where: { id: reading.productId },
      data: { 
        location: reading.location,
        lastInventoryUpdate: new Date(),
      },
    });
  }

  private async checkRFIDSecurity(reading: RFIDReading): Promise<void> {
    // Check for unauthorized tag movements
    // This is a simplified security check
    if (reading.location.includes('restricted') && reading.action === 'read') {
      await this.createAlert({
        deviceId: reading.deviceId,
        type: 'security_breach',
        severity: 'high',
        message: `Unauthorized RFID tag detected in restricted area: ${reading.location}`,
        data: { reading },
      });
    }
  }

  private async checkOfflineDevices(): Promise<void> {
    const offlineThreshold = new Date(Date.now() - this.alertThresholds.get('offline_timeout') * 1000);
    
    const offlineDevices = await prisma.iotDevice.findMany({
      where: {
        lastSeen: { lt: offlineThreshold },
        status: { not: 'offline' },
      },
    });

    for (const device of offlineDevices) {
      await prisma.iotDevice.update({
        where: { id: device.id },
        data: { status: 'offline' },
      });

      await this.createAlert({
        deviceId: device.id,
        type: 'device_offline',
        severity: 'medium',
        message: `Device ${device.name} has gone offline`,
        data: { lastSeen: device.lastSeen },
      });
    }
  }

  private async processSensorDataBuffer(): Promise<void> {
    for (const [deviceId, readings] of this.sensorDataBuffer.entries()) {
      if (readings.length > 0) {
        // Process aggregated sensor data
        console.log(`Processing ${readings.length} buffered readings for device ${deviceId}`);
        
        // Clear buffer
        this.sensorDataBuffer.set(deviceId, []);
      }
    }
  }

  private async checkBatteryLevels(): Promise<void> {
    const lowBatteryDevices = await prisma.iotDevice.findMany({
      where: {
        batteryLevel: { lt: this.alertThresholds.get('battery').low },
        isActive: true,
      },
    });

    for (const device of lowBatteryDevices) {
      const severity = device.batteryLevel! < this.alertThresholds.get('battery').critical ? 'critical' : 'medium';
      
      await this.createAlert({
        deviceId: device.id,
        type: 'low_battery',
        severity,
        message: `Device ${device.name} has low battery: ${device.batteryLevel}%`,
        data: { batteryLevel: device.batteryLevel },
      });
    }
  }

  private async sendCriticalAlertNotifications(alert: any): Promise<void> {
    // Send email and SMS notifications for critical alerts
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
    });

    for (const admin of admins) {
      if (admin.email) {
        await emailService.sendEmail({
          to: admin.email,
          subject: 'Critical IoT Alert',
          templateId: 'iot-critical-alert',
          templateData: {
            adminName: admin.name,
            alertMessage: alert.message,
            deviceId: alert.deviceId,
            dashboardUrl: `${process.env.NEXTAUTH_URL}/dashboard/iot/alerts/${alert.id}`,
          },
        });
      }

      if (admin.phone) {
        await smsService.sendSMS({
          to: admin.phone,
          message: `CRITICAL IoT ALERT: ${alert.message}. Check dashboard for details.`,
        });
      }
    }
  }

  private getAirQualityStatus(index: number): 'good' | 'moderate' | 'poor' | 'hazardous' {
    if (index <= 50) return 'good';
    if (index <= 100) return 'moderate';
    if (index <= 150) return 'poor';
    return 'hazardous';
  }

  private getLightingStatus(lux: number): 'dim' | 'normal' | 'bright' {
    if (lux < 200) return 'dim';
    if (lux > 1000) return 'bright';
    return 'normal';
  }

  private calculateDeviceUptime(device: any, since: Date): number {
    // Simplified uptime calculation
    const totalTime = Date.now() - since.getTime();
    const lastSeenTime = device.lastSeen.getTime();
    const uptime = Math.max(0, (lastSeenTime - since.getTime()) / totalTime);
    return Math.round(uptime * 100);
  }

  private calculatePeakHours(customers: any[]): string[] {
    // Simplified peak hours calculation
    return ['10:00-11:00', '14:00-15:00', '18:00-19:00'];
  }

  private mapDeviceFromDB(device: any): IoTDevice {
    return {
      id: device.id,
      name: device.name,
      type: device.type,
      location: device.location,
      warehouseId: device.warehouseId,
      storeId: device.storeId,
      macAddress: device.macAddress,
      ipAddress: device.ipAddress,
      firmwareVersion: device.firmwareVersion,
      batteryLevel: device.batteryLevel,
      status: device.status,
      lastSeen: device.lastSeen,
      configuration: device.configuration as Record<string, any>,
      metadata: device.metadata as Record<string, any>,
      isActive: device.isActive,
      installedAt: device.installedAt,
    };
  }

  private mapSensorReadingFromDB(reading: any): SensorReading {
    return {
      id: reading.id,
      deviceId: reading.deviceId,
      type: reading.type,
      value: reading.value,
      unit: reading.unit,
      timestamp: reading.timestamp,
      location: reading.location,
      metadata: reading.metadata as Record<string, any>,
    };
  }

  private mapAlertFromDB(alert: any): IoTAlert {
    return {
      id: alert.id,
      deviceId: alert.deviceId,
      type: alert.type,
      severity: alert.severity,
      message: alert.message,
      data: alert.data as Record<string, any>,
      isResolved: alert.isResolved,
      createdAt: alert.createdAt,
      resolvedAt: alert.resolvedAt,
      resolvedBy: alert.resolvedBy,
    };
  }
}

export const iotService = new IoTService();
