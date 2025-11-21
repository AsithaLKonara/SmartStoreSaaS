import { prisma } from '@/lib/prisma';

export interface IoTDeviceReading {
  deviceId: string;
  sensorType: string;
  value: number;
  unit: string;
  timestamp: Date;
}

export class IoTService {
<<<<<<< HEAD
  async registerDevice(
    organizationId: string,
    warehouseId: string | null,
    deviceId: string,
    deviceType: string,
    name: string,
    location?: string
  ): Promise<any> {
    const device = await prisma.ioTDevice.upsert({
      where: { deviceId },
      create: {
        organizationId,
        warehouseId: warehouseId || null,
        deviceId,
        deviceType,
        name,
        location: location || null,
        isActive: true,
      },
      update: {
        name,
        location: location || undefined,
        isActive: true,
        lastSeen: new Date(),
      },
    });

    return device;
  }

  async updateSensorReading(
    deviceId: string,
    sensorType: string,
    value: number,
    unit: string,
    productId?: string
  ): Promise<void> {
    const device = await prisma.ioTDevice.findUnique({
      where: { deviceId },
    });

    if (!device) {
      throw new Error('Device not found');
    }

    // Update or create sensor
    await prisma.ioTSensor.upsert({
      where: {
        deviceId_sensorType: {
          deviceId: device.id,
          sensorType,
        },
      },
      create: {
        deviceId: device.id,
        sensorType,
        currentValue: value,
        unit,
        productId: productId || null,
        lastReading: new Date(),
      },
      update: {
        currentValue: value,
        lastReading: new Date(),
      },
    });

    // Update device last seen
    await prisma.ioTDevice.update({
      where: { id: device.id },
      data: { lastSeen: new Date() },
    });

    // Check thresholds and trigger alerts if needed
    await this.checkThresholds(device.id, sensorType, value);
  }

  async getDeviceStatus(deviceId: string): Promise<any> {
    const device = await prisma.ioTDevice.findUnique({
      where: { deviceId },
      include: {
        sensors: true,
        warehouse: true,
      },
    });

    if (!device) {
      throw new Error('Device not found');
=======
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
      // TODO: Create IoT models in Prisma schema
      // For now, create mock device
      const device: IoTDevice = {
        id: `device_${Date.now()}`,
        ...deviceData,
        lastSeen: new Date(),
        installedAt: new Date(),
      };

      // Store device connection
      this.deviceConnections.set(device.id, {} as WebSocket);

      return device;
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
      // Store WebSocket connection
      this.deviceConnections.set(deviceId, ws);

      // Update device status to online
      // TODO: Update when IoT models are created
      console.log(`Device ${deviceId} connected`);

      // Set up message handlers
      ws.onmessage = (event) => this.handleDeviceMessage(deviceId, event.data);
      ws.onclose = () => this.handleDeviceDisconnect(deviceId);
      ws.onerror = (error) => console.error(`Device ${deviceId} WebSocket error:`, error);

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'connection_established',
        deviceId,
        timestamp: new Date().toISOString(),
      }));
    } catch (error) {
      console.error('Error connecting IoT device:', error);
      throw new Error('Failed to connect IoT device');
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
      // TODO: Create sensor reading record when IoT models are available
      const sensorReading: SensorReading = {
        id: `reading_${Date.now()}`,
        deviceId,
        ...reading,
        timestamp: new Date(),
      };

      // Store in buffer for batch processing
      if (!this.sensorDataBuffer.has(deviceId)) {
        this.sensorDataBuffer.set(deviceId, []);
      }
      this.sensorDataBuffer.get(deviceId)!.push(sensorReading);

      // Check for alerts
      await this.checkSensorAlerts(deviceId, reading);

      // Update device last seen
      await this.updateDeviceLastSeen(deviceId);

      return sensorReading;
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
      // Process smart shelf data
      console.log('Processing smart shelf data:', shelfData);

      // Update product quantities
      for (const product of shelfData.products) {
        await this.updateProductQuantityFromShelf(
          product.productId,
          product.quantity,
          shelfData.deviceId
        );
      }

      // Process alerts
      for (const alert of shelfData.alerts) {
        if (alert.severity === 'critical' || alert.severity === 'high') {
          await this.createAlert({
            deviceId: shelfData.deviceId,
            type: 'sensor_anomaly',
            severity: alert.severity,
            message: alert.message,
            data: { shelfId: shelfData.shelfId, productId: alert.productId },
          });
        }
      }
    } catch (error) {
      console.error('Error processing smart shelf data:', error);
      throw new Error('Failed to process smart shelf data');
    }
  }

  /**
   * Process beacon data for customer analytics
   */
  async processBeaconData(beaconData: BeaconData): Promise<void> {
    try {
      // Process beacon data for customer tracking
      console.log('Processing beacon data:', beaconData);

      // Update customer interactions
      for (const customerDevice of beaconData.customerDevices) {
        if (customerDevice.userId) {
          // TODO: Create customer interaction record when models are available
          console.log(`Customer ${customerDevice.userId} interaction at beacon ${beaconData.beaconId}`);
        }
      }

      // Generate location insights
      await this.generateLocationInsights(beaconData);
    } catch (error) {
      console.error('Error processing beacon data:', error);
      throw new Error('Failed to process beacon data');
    }
  }

  /**
   * Process RFID readings for inventory tracking
   */
  async processRFIDReading(reading: RFIDReading): Promise<void> {
    try {
      // Process RFID reading
      console.log('Processing RFID reading:', reading);

      // Update inventory if product is identified
      if (reading.productId) {
        await this.updateInventoryFromRFID(reading);
      }

      // Check for security issues
      await this.checkRFIDSecurity(reading);
    } catch (error) {
      console.error('Error processing RFID reading:', error);
      throw new Error('Failed to process RFID reading');
    }
  }

  /**
   * Get environmental conditions for location
   */
  async getEnvironmentalConditions(location: string): Promise<EnvironmentalConditions> {
    try {
      // TODO: Get actual sensor readings when IoT models are available
      // For now, return mock data
      const mockConditions: EnvironmentalConditions = {
        location,
        timestamp: new Date(),
        temperature: {
          current: 22,
          min: 18,
          max: 26,
          unit: 'C',
        },
        humidity: {
          current: 45,
          min: 40,
          max: 60,
          unit: '%',
        },
        airQuality: {
          index: 25,
          status: 'good',
          co2: 400,
          particles: 10,
        },
        lighting: {
          lux: 500,
          status: 'normal',
        },
      };

      return mockConditions;
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
      // TODO: Get actual analytics when IoT models are available
      // For now, return mock data
      const mockAnalytics = {
        totalDevices: 25,
        onlineDevices: 22,
        offlineDevices: 3,
        batteryAlerts: 2,
        sensorReadings: 1500,
        alerts: [],
        deviceUptime: {},
      };

      return mockAnalytics;
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
      // TODO: Create IoT alert record when models are available
      const alert: IoTAlert = {
        id: `alert_${Date.now()}`,
        ...alertData,
        isResolved: false,
        createdAt: new Date(),
      };

      // Send notifications for critical alerts
      if (alert.severity === 'critical') {
        await this.sendCriticalAlertNotifications(alert);
      }

      return alert;
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
      // TODO: Update IoT alert record when models are available
      const alert: IoTAlert = {
        id: alertId,
        deviceId: '',
        type: 'device_offline',
        severity: 'low',
        message: '',
        data: {},
        isResolved: true,
        createdAt: new Date(),
        resolvedAt: new Date(),
        resolvedBy,
      };

      return alert;
    } catch (error) {
      console.error('Error resolving IoT alert:', error);
      throw new Error('Failed to resolve IoT alert');
    }
  }

  /**
   * Private helper methods
   */
  private setupDefaultThresholds(): void {
    // Set default alert thresholds
    this.alertThresholds.set('temperature', { min: 15, max: 30 });
    this.alertThresholds.set('humidity', { min: 30, max: 70 });
    this.alertThresholds.set('battery', { low: 20, critical: 10 });
  }

  private startPeriodicTasks(): void {
    // Check offline devices every 5 minutes
    setInterval(() => this.checkOfflineDevices(), 5 * 60 * 1000);

    // Process sensor data buffer every minute
    setInterval(() => this.processSensorDataBuffer(), 60 * 1000);

    // Check battery levels every hour
    setInterval(() => this.checkBatteryLevels(), 60 * 60 * 1000);
  }

  private async handleDeviceMessage(deviceId: string, message: any): Promise<void> {
    try {
      const data = JSON.parse(message);
      
      switch (data.type) {
        case 'sensor_reading':
          await this.processSensorReading(deviceId, data.reading);
          break;
        case 'smart_shelf_data':
          await this.processSmartShelfData(data.shelfData);
          break;
        case 'beacon_data':
          await this.processBeaconData(data.beaconData);
          break;
        case 'rfid_reading':
          await this.processRFIDReading(data.rfidReading);
          break;
        default:
          console.log(`Unknown message type from device ${deviceId}:`, data.type);
      }
    } catch (error) {
      console.error(`Error handling message from device ${deviceId}:`, error);
    }
  }

  private async handleDeviceDisconnect(deviceId: string): Promise<void> {
    try {
      // Remove WebSocket connection
      this.deviceConnections.delete(deviceId);

      // Update device status to offline
      // TODO: Update when IoT models are created
      console.log(`Device ${deviceId} disconnected`);
    } catch (error) {
      console.error(`Error handling device disconnect for ${deviceId}:`, error);
    }
  }

  private async checkSensorAlerts(deviceId: string, reading: any): Promise<void> {
    try {
      const thresholds = this.alertThresholds.get(reading.type);
      if (!thresholds) return;

      let shouldAlert = false;
      let message = '';

      if (reading.type === 'temperature') {
        if (reading.value < thresholds.min || reading.value > thresholds.max) {
          shouldAlert = true;
          message = `Temperature ${reading.value}${reading.unit} is outside normal range (${thresholds.min}-${thresholds.max}${reading.unit})`;
        }
      } else if (reading.type === 'humidity') {
        if (reading.value < thresholds.min || reading.value > thresholds.max) {
          shouldAlert = true;
          message = `Humidity ${reading.value}${reading.unit} is outside normal range (${thresholds.min}-${thresholds.max}${reading.unit})`;
        }
      }

      if (shouldAlert) {
        await this.createAlert({
          deviceId,
          type: 'sensor_anomaly',
          severity: 'medium',
          message,
          data: { reading, thresholds },
        });
      }
    } catch (error) {
      console.error('Error checking sensor alerts:', error);
    }
  }

  private async updateDeviceLastSeen(deviceId: string): Promise<void> {
    try {
      // TODO: Update device last seen when IoT models are created
      console.log(`Updated last seen for device ${deviceId}`);
    } catch (error) {
      console.error(`Error updating last seen for device ${deviceId}:`, error);
    }
  }

  private async updateProductQuantityFromShelf(
    productId: string,
    quantity: number,
    deviceId: string
  ): Promise<void> {
    try {
      // Update product quantity in inventory
      await prisma.product.update({
        where: { id: productId },
        data: { stockQuantity: quantity },
      });

      console.log(`Updated product ${productId} quantity to ${quantity} from shelf device ${deviceId}`);
    } catch (error) {
      console.error(`Error updating product quantity for ${productId}:`, error);
    }
  }

  private async generateLocationInsights(beaconData: BeaconData): Promise<void> {
    try {
      // Generate insights about customer movement patterns
      const totalInteractions = beaconData.customerDevices.reduce(
        (sum, device) => sum + device.interactions,
        0
      );

      if (totalInteractions > 100) {
        console.log(`High traffic detected at beacon ${beaconData.beaconId}: ${totalInteractions} interactions`);
      }
    } catch (error) {
      console.error('Error generating location insights:', error);
    }
  }

  private async updateInventoryFromRFID(reading: RFIDReading): Promise<void> {
    try {
      if (reading.productId) {
        // Update product with RFID information - store in ProductActivity since Product doesn't have metadata
        await prisma.product.update({
          where: { id: reading.productId },
          data: {
            // Update product with RFID information - store in ProductActivity since Product doesn't have metadata
          }
        });

        // Store RFID data in ProductActivity
        await prisma.productActivity.create({
          data: {
            productId: reading.productId,
            type: 'STATUS_CHANGED',
            description: 'RFID scan update',
            metadata: {
              lastRFIDScan: reading.timestamp,
              lastLocation: reading.location,
              signalStrength: reading.signalStrength,
            }
          }
        });

        console.log(`Updated product ${reading.productId} from RFID reading at ${reading.location}`);
      }
    } catch (error) {
      console.error('Error updating inventory from RFID:', error);
    }
  }

  private async checkRFIDSecurity(reading: RFIDReading): Promise<void> {
    try {
      // Check for suspicious RFID activity
      if (reading.signalStrength < -70) {
        // Weak signal might indicate tampering
        await this.createAlert({
          deviceId: reading.deviceId,
          type: 'security_breach',
          severity: 'medium',
          message: `Weak RFID signal detected, possible tampering at ${reading.location}`,
          data: { reading },
        });
      }
    } catch (error) {
      console.error('Error checking RFID security:', error);
    }
  }

  private async checkOfflineDevices(): Promise<void> {
    try {
      // TODO: Check for offline devices when IoT models are created
      // For now, just log the check
      console.log('Checking for offline devices...');
    } catch (error) {
      console.error('Error checking offline devices:', error);
    }
  }

  private async processSensorDataBuffer(): Promise<void> {
    try {
      // Process buffered sensor data
      for (const [deviceId, readings] of Array.from(this.sensorDataBuffer.entries())) {
        if (readings.length > 0) {
          // Group readings by device ID
          const groupedReadings = new Map<string, SensorReading[]>();
          for (const reading of readings) {
            const deviceId = reading.deviceId;
            if (!groupedReadings.has(deviceId)) {
              groupedReadings.set(deviceId, []);
            }
            groupedReadings.get(deviceId)!.push(reading);
          }

          // Process grouped readings
          for (const [sensorId, sensorReadings] of Array.from(groupedReadings.entries())) {
            // Process readings in batch
            console.log(`Processing ${sensorReadings.length} buffered readings from device ${deviceId}`);
            
            // Clear buffer after processing
            this.sensorDataBuffer.set(deviceId, []);
          }
        }
      }
    } catch (error) {
      console.error('Error processing sensor data buffer:', error);
    }
  }

  private async checkBatteryLevels(): Promise<void> {
    try {
      // TODO: Check battery levels when IoT models are created
      // For now, just log the check
      console.log('Checking device battery levels...');
    } catch (error) {
      console.error('Error checking battery levels:', error);
    }
  }

  private async sendCriticalAlertNotifications(alert: any): Promise<void> {
    try {
      // TODO: Send notifications when notification services are available
      console.log(`Critical alert: ${alert.message}`);
      
      // In production, this would send emails, SMS, or push notifications
      // to relevant staff members
    } catch (error) {
      console.error('Error sending critical alert notifications:', error);
>>>>>>> 08d9e1855dc7fd2c99e5d62def516239ff37a9a7
    }

<<<<<<< HEAD
=======
  private getAirQualityStatus(index: number): 'good' | 'moderate' | 'poor' | 'hazardous' {
    if (index <= 50) return 'good';
    if (index <= 100) return 'moderate';
    if (index <= 150) return 'poor';
    return 'hazardous';
  }

  private getLightingStatus(lux: number): 'dim' | 'normal' | 'bright' {
    if (lux < 100) return 'dim';
    if (lux < 1000) return 'normal';
    return 'bright';
  }

  private calculateDeviceUptime(device: any, since: Date): number {
    // Calculate device uptime percentage
    const totalTime = Date.now() - since.getTime();
    const onlineTime = totalTime; // Simplified calculation
    return (onlineTime / totalTime) * 100;
  }

  private calculatePeakHours(customers: any[]): string[] {
    // Calculate peak business hours based on customer data
    // Simplified implementation
    return ['10:00', '14:00', '18:00'];
  }

  private mapDeviceFromDB(device: any): IoTDevice {
    // Map database device to IoTDevice interface
>>>>>>> 08d9e1855dc7fd2c99e5d62def516239ff37a9a7
    return {
      id: device.id,
      deviceId: device.deviceId,
      name: device.name,
      type: device.deviceType,
      location: device.location,
<<<<<<< HEAD
=======
      warehouseId: device.warehouseId,
      storeId: device.storeId,
      macAddress: device.macAddress,
      ipAddress: device.ipAddress,
      firmwareVersion: device.firmwareVersion,
      batteryLevel: device.batteryLevel,
      status: device.status,
      lastSeen: device.lastSeen,
      configuration: device.configuration || {},
      metadata: device.metadata || {},
>>>>>>> 08d9e1855dc7fd2c99e5d62def516239ff37a9a7
      isActive: device.isActive,
      lastSeen: device.lastSeen,
      warehouse: device.warehouse?.name,
      sensors: device.sensors.map(sensor => ({
        type: sensor.sensorType,
        value: sensor.currentValue,
        unit: sensor.unit,
        threshold: sensor.threshold,
        lastReading: sensor.lastReading,
      })),
    };
  }

<<<<<<< HEAD
  async getWarehouseDevices(warehouseId: string): Promise<any[]> {
    const devices = await prisma.ioTDevice.findMany({
      where: { warehouseId },
      include: {
        sensors: true,
      },
    });

    return devices.map(device => ({
      id: device.id,
      deviceId: device.deviceId,
      name: device.name,
      type: device.deviceType,
      location: device.location,
      isActive: device.isActive,
      lastSeen: device.lastSeen,
      sensors: device.sensors,
    }));
  }

  async checkThresholds(deviceDbId: string, sensorType: string, value: number): Promise<void> {
    const sensor = await prisma.ioTSensor.findFirst({
      where: {
        deviceId: deviceDbId,
        sensorType,
      },
    });

    if (!sensor || !sensor.threshold) {
      return;
    }

    // Check if value exceeds threshold
    if (sensorType === 'weight' && value < sensor.threshold) {
      // Low inventory alert
      await this.triggerLowInventoryAlert(sensor);
    } else if (sensorType === 'motion' && value > sensor.threshold) {
      // Motion detected
      await this.triggerMotionAlert(sensor);
    }
  }

  private async triggerLowInventoryAlert(sensor: any): Promise<void> {
    // In production, would send notification or trigger reorder
    console.log(`Low inventory alert for sensor ${sensor.id}`);
  }

  private async triggerMotionAlert(sensor: any): Promise<void> {
    // In production, would send security alert
    console.log(`Motion detected on sensor ${sensor.id}`);
  }

  async createSmartShelf(
    organizationId: string,
    warehouseId: string,
    productId: string,
    location: string,
    threshold: number
  ): Promise<any> {
    const deviceId = `shelf_${Date.now()}`;
    
    const device = await this.registerDevice(
      organizationId,
      warehouseId,
      deviceId,
      'shelf',
      `Smart Shelf - ${location}`,
      location
    );

    // Create weight sensor for the shelf
    await prisma.ioTSensor.create({
      data: {
        deviceId: device.id,
        sensorType: 'weight',
        productId,
        threshold,
        unit: 'kg',
      },
    });

    return device;
  }

  async getSmartShelfInventory(deviceId: string): Promise<{ current: number; threshold: number; status: string }> {
    const device = await prisma.ioTDevice.findUnique({
      where: { deviceId },
      include: {
        sensors: {
          where: { sensorType: 'weight' },
        },
      },
    });

    if (!device || device.sensors.length === 0) {
      throw new Error('Smart shelf not found or no sensors');
    }

    const sensor = device.sensors[0];
    const current = sensor.currentValue || 0;
    const threshold = sensor.threshold || 0;
    const status = current < threshold ? 'low' : current < threshold * 1.2 ? 'warning' : 'ok';

    return { current, threshold, status };
=======
  private mapSensorReadingFromDB(reading: any): SensorReading {
    // Map database sensor reading to SensorReading interface
    return {
      id: reading.id,
      deviceId: reading.deviceId,
      type: reading.type,
      value: reading.value,
      unit: reading.unit,
      timestamp: reading.timestamp,
      location: reading.location,
      metadata: reading.metadata || {},
    };
  }

  private mapAlertFromDB(alert: any): IoTAlert {
    // Map database alert to IoTAlert interface
    return {
      id: alert.id,
      deviceId: alert.deviceId,
      type: alert.type,
      severity: alert.severity,
      message: alert.message,
      data: alert.data || {},
      isResolved: alert.isResolved,
      createdAt: alert.createdAt,
      resolvedAt: alert.resolvedAt,
      resolvedBy: alert.resolvedBy,
    };
>>>>>>> 08d9e1855dc7fd2c99e5d62def516239ff37a9a7
  }
}
