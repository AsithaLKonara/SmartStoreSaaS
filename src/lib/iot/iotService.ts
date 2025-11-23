import { prisma } from '@/lib/prisma';

export interface IoTDeviceReading {
  deviceId: string;
  sensorType: string;
  value: number;
  unit: string;
  timestamp: Date;
}

export class IoTService {
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
    }

    return {
      id: device.id,
      deviceId: device.deviceId,
      name: device.name,
      type: device.deviceType,
      location: device.location,
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

  private async triggerLowInventoryAlert(sensor: Record<string, unknown>): Promise<void> {
    // In production, would send notification or trigger reorder
    console.log(`Low inventory alert for sensor ${sensor.id}`);
  }

  private async triggerMotionAlert(sensor: Record<string, unknown>): Promise<void> {
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
  }
}
