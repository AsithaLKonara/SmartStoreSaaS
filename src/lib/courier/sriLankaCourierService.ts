import { prisma } from '@/lib/prisma';
import { realTimeSyncService, SyncEvent } from '@/lib/sync/realTimeSyncService';
import { EventEmitter } from 'events';

export interface CourierConfig {
  name: string;
  code: string;
  apiKey: string;
  apiSecret?: string;
  baseUrl: string;
  isActive: boolean;
  organizationId: string;
}

export interface TrackingInfo {
  trackingNumber: string;
  courierCode: string;
  status: string;
  location?: string;
  timestamp: Date;
  description: string;
  estimatedDelivery?: Date;
  events: TrackingEvent[];
}

export interface TrackingEvent {
  status: string;
  location: string;
  timestamp: Date;
  description: string;
}

export interface ShipmentRequest {
  pickupAddress: {
    name: string;
    phone: string;
    address: string;
    city: string;
    postalCode: string;
  };
  deliveryAddress: {
    name: string;
    phone: string;
    address: string;
    city: string;
    postalCode: string;
  };
  package: {
    weight: number;
    length: number;
    width: number;
    height: number;
    description: string;
  };
  orderId: string;
  organizationId: string;
}

export interface ShipmentResponse {
  trackingNumber: string;
  courierCode: string;
  estimatedDelivery: Date;
  cost: number;
  labelUrl?: string;
  status: string;
}

export class SriLankaCourierService extends EventEmitter {
  private couriers: Map<string, CourierConfig> = new Map();
  private trackingCache: Map<string, { data: TrackingInfo; timestamp: Date }> = new Map();

  constructor() {
    super();
    this.loadCouriers();
  }

  private async loadCouriers(): Promise<void> {
    try {
      const courierConfigs = await prisma.courier.findMany({
        where: { isActive: true }
      });

      courierConfigs.forEach(courier => {
        this.couriers.set(courier.code, {
          name: courier.name,
          code: courier.code,
          apiKey: courier.apiKey || '',
          apiSecret: courier.apiSecret || '',
          baseUrl: this.getCourierBaseUrl(courier.code),
          isActive: courier.isActive,
          organizationId: courier.organizationId
        });
      });
    } catch (error) {
      console.error('Error loading courier configs:', error);
    }
  }

  private getCourierBaseUrl(courierCode: string): string {
    const baseUrls: Record<string, string> = {
      'aramex': 'https://ws.aramex.com/',
      'dhl': 'https://api.dhl.com/',
      'fedex': 'https://apis.fedex.com/',
      'ups': 'https://onlinetools.ups.com/',
      'ceylinco': 'https://api.ceylinco.com/',
      'skynet': 'https://api.skynet.lk/',
      'express': 'https://api.express.lk/',
      'courier': 'https://api.courier.lk/'
    };

    return baseUrls[courierCode.toLowerCase()] || '';
  }

  // Tracking Methods
  async trackShipment(trackingNumber: string, courierCode: string): Promise<TrackingInfo> {
    const cacheKey = `${courierCode}_${trackingNumber}`;
    const cached = this.trackingCache.get(cacheKey);
    
    // Return cached data if it's less than 5 minutes old
    if (cached && Date.now() - cached.timestamp.getTime() < 5 * 60 * 1000) {
      return cached.data;
    }

    const courier = this.couriers.get(courierCode);
    if (!courier) {
      throw new Error(`Courier ${courierCode} not configured`);
    }

    try {
      const trackingInfo = await this.fetchTrackingInfo(trackingNumber, courier);
      
      // Cache the result
      this.trackingCache.set(cacheKey, {
        data: trackingInfo,
        timestamp: new Date()
      });

      // Sync tracking update
      await this.syncTrackingEvent(trackingInfo, (courier as any).organizationId);

      this.emit('tracking_updated', trackingInfo);
      return trackingInfo;

    } catch (error) {
      console.error(`Error tracking shipment ${trackingNumber}:`, error);
      throw error;
    }
  }

  private async fetchTrackingInfo(trackingNumber: string, courier: CourierConfig): Promise<TrackingInfo> {
    switch (courier.code.toLowerCase()) {
      case 'aramex':
        return await this.trackAramex(trackingNumber, courier);
      case 'dhl':
        return await this.trackDHL(trackingNumber, courier);
      case 'fedex':
        return await this.trackFedEx(trackingNumber, courier);
      case 'ups':
        return await this.trackUPS(trackingNumber, courier);
      case 'ceylinco':
        return await this.trackCeylinco(trackingNumber, courier);
      case 'skynet':
        return await this.trackSkynet(trackingNumber, courier);
      default:
        return await this.trackGeneric(trackingNumber, courier);
    }
  }

  private async trackAramex(trackingNumber: string, courier: CourierConfig): Promise<TrackingInfo> {
    const response = await fetch(`${courier.baseUrl}tracking`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${courier.apiKey}`
      },
      body: JSON.stringify({
        ShipmentNumber: trackingNumber
      })
    });

    if (!response.ok) {
      throw new Error(`Aramex API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      trackingNumber,
      courierCode: courier.code,
      status: data.Shipments[0]?.CurrentStatus || 'Unknown',
      location: data.Shipments[0]?.CurrentLocation || '',
      timestamp: new Date(),
      description: data.Shipments[0]?.CurrentStatusDescription || '',
      estimatedDelivery: data.Shipments[0]?.EstimatedDeliveryDate ? 
        new Date(data.Shipments[0].EstimatedDeliveryDate) : undefined,
      events: data.Shipments[0]?.ShipmentEvents?.map((event: any) => ({
        status: event.Status,
        location: event.Location,
        timestamp: new Date(event.Timestamp),
        description: event.Description
      })) || []
    };
  }

  private async trackDHL(trackingNumber: string, courier: CourierConfig): Promise<TrackingInfo> {
    const response = await fetch(`${courier.baseUrl}shipments/${trackingNumber}/tracking`, {
      headers: {
        'Authorization': `Bearer ${courier.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`DHL API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      trackingNumber,
      courierCode: courier.code,
      status: data.shipments[0]?.status || 'Unknown',
      location: data.shipments[0]?.location || '',
      timestamp: new Date(),
      description: data.shipments[0]?.description || '',
      estimatedDelivery: data.shipments[0]?.estimatedDeliveryDate ? 
        new Date(data.shipments[0].estimatedDeliveryDate) : undefined,
      events: data.shipments[0]?.events?.map((event: any) => ({
        status: event.status,
        location: event.location,
        timestamp: new Date(event.timestamp),
        description: event.description
      })) || []
    };
  }

  private async trackFedEx(trackingNumber: string, courier: CourierConfig): Promise<TrackingInfo> {
    const response = await fetch(`${courier.baseUrl}track/v1/trackingnumbers`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${courier.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        trackingInfo: [{
          trackingNumberInfo: {
            trackingNumber
          }
        }]
      })
    });

    if (!response.ok) {
      throw new Error(`FedEx API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      trackingNumber,
      courierCode: courier.code,
      status: data.output?.completeTrackResults[0]?.trackResults[0]?.latestStatusDetail?.description || 'Unknown',
      location: data.output?.completeTrackResults[0]?.trackResults[0]?.scanEvents?.[0]?.scanLocation?.city || '',
      timestamp: new Date(),
      description: data.output?.completeTrackResults[0]?.trackResults[0]?.latestStatusDetail?.description || '',
      estimatedDelivery: data.output?.completeTrackResults[0]?.trackResults[0]?.deliveryDetails?.deliveryDate ? 
        new Date(data.output.completeTrackResults[0].trackResults[0].deliveryDetails.deliveryDate) : undefined,
      events: data.output?.completeTrackResults[0]?.trackResults[0]?.scanEvents?.map((event: any) => ({
        status: event.eventDescription,
        location: event.scanLocation?.city || '',
        timestamp: new Date(event.date),
        description: event.eventDescription
      })) || []
    };
  }

  private async trackUPS(trackingNumber: string, courier: CourierConfig): Promise<TrackingInfo> {
    const response = await fetch(`${courier.baseUrl}api/track/v1/details/${trackingNumber}`, {
      headers: {
        'Authorization': `Bearer ${courier.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`UPS API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      trackingNumber,
      courierCode: courier.code,
      status: data.trackResponse?.shipment[0]?.package[0]?.activity[0]?.status?.description || 'Unknown',
      location: data.trackResponse?.shipment[0]?.package[0]?.activity[0]?.location?.address?.city || '',
      timestamp: new Date(),
      description: data.trackResponse?.shipment[0]?.package[0]?.activity[0]?.status?.description || '',
      estimatedDelivery: data.trackResponse?.shipment[0]?.package[0]?.deliveryDate ? 
        new Date(data.trackResponse.shipment[0].package[0].deliveryDate) : undefined,
      events: data.trackResponse?.shipment[0]?.package[0]?.activity?.map((event: any) => ({
        status: event.status?.description || '',
        location: event.location?.address?.city || '',
        timestamp: new Date(event.date + ' ' + event.time),
        description: event.status?.description || ''
      })) || []
    };
  }

  private async trackCeylinco(trackingNumber: string, courier: CourierConfig): Promise<TrackingInfo> {
    // Ceylinco specific tracking implementation
    const response = await fetch(`${courier.baseUrl}tracking/${trackingNumber}`, {
      headers: {
        'API-Key': courier.apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Ceylinco API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      trackingNumber,
      courierCode: courier.code,
      status: data.status || 'Unknown',
      location: data.currentLocation || '',
      timestamp: new Date(),
      description: data.statusDescription || '',
      estimatedDelivery: data.estimatedDelivery ? new Date(data.estimatedDelivery) : undefined,
      events: data.trackingEvents?.map((event: any) => ({
        status: event.status,
        location: event.location,
        timestamp: new Date(event.timestamp),
        description: event.description
      })) || []
    };
  }

  private async trackSkynet(trackingNumber: string, courier: CourierConfig): Promise<TrackingInfo> {
    // Skynet specific tracking implementation
    const response = await fetch(`${courier.baseUrl}track/${trackingNumber}`, {
      headers: {
        'X-API-Key': courier.apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Skynet API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      trackingNumber,
      courierCode: courier.code,
      status: data.currentStatus || 'Unknown',
      location: data.currentLocation || '',
      timestamp: new Date(),
      description: data.statusDescription || '',
      estimatedDelivery: data.estimatedDelivery ? new Date(data.estimatedDelivery) : undefined,
      events: data.trackingHistory?.map((event: any) => ({
        status: event.status,
        location: event.location,
        timestamp: new Date(event.timestamp),
        description: event.description
      })) || []
    };
  }

  private async trackGeneric(trackingNumber: string, courier: CourierConfig): Promise<TrackingInfo> {
    // Generic tracking for unsupported couriers
    return {
      trackingNumber,
      courierCode: courier.code,
      status: 'In Transit',
      timestamp: new Date(),
      description: 'Tracking information not available',
      events: []
    };
  }

  // Shipment Creation
  async createShipment(request: ShipmentRequest, courierCode: string): Promise<ShipmentResponse> {
    const courier = this.couriers.get(courierCode);
    if (!courier) {
      throw new Error(`Courier ${courierCode} not configured`);
    }

    try {
      const shipment = await this.createShipmentWithCourier(request, courier);
      
      // Save to database
      await prisma.shipment.create({
        data: {
          trackingNumber: shipment.trackingNumber,
          status: shipment.status as any, // Cast to any to bypass type constraint
          courierId: courier.code,
          orderId: request.orderId,
          metadata: {
            cost: shipment.cost,
            estimatedDelivery: shipment.estimatedDelivery,
            labelUrl: shipment.labelUrl
          }
        }
      });

      // Sync shipment creation
      await this.syncShipmentEvent(shipment, courier.organizationId);

      this.emit('shipment_created', shipment);
      return shipment;

    } catch (error) {
      console.error('Error creating shipment:', error);
      throw error;
    }
  }

  private async createShipmentWithCourier(request: ShipmentRequest, courier: CourierConfig): Promise<ShipmentResponse> {
    switch (courier.code.toLowerCase()) {
      case 'aramex':
        return await this.createAramexShipment(request, courier);
      case 'dhl':
        return await this.createDHLShipment(request, courier);
      case 'fedex':
        return await this.createFedExShipment(request, courier);
      case 'ups':
        return await this.createUPSShipment(request, courier);
      default:
        return await this.createGenericShipment(request, courier);
    }
  }

  private async createAramexShipment(request: ShipmentRequest, courier: CourierConfig): Promise<ShipmentResponse> {
    const response = await fetch(`${courier.baseUrl}shipping/v1/shipments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${courier.apiKey}`
      },
      body: JSON.stringify({
        Shipments: [{
          Reference1: request.orderId,
          Reference2: request.organizationId,
          Shipper: {
            Reference1: request.pickupAddress.name,
            Reference2: request.pickupAddress.phone,
            AccountNumber: courier.apiKey,
            PartyAddress: {
              Line1: request.pickupAddress.address,
              City: request.pickupAddress.city,
              PostalCode: request.pickupAddress.postalCode,
              CountryCode: 'LK'
            }
          },
          Consignee: {
            Reference1: request.deliveryAddress.name,
            Reference2: request.deliveryAddress.phone,
            PartyAddress: {
              Line1: request.deliveryAddress.address,
              City: request.deliveryAddress.city,
              PostalCode: request.deliveryAddress.postalCode,
              CountryCode: 'LK'
            }
          },
          ShipmentDetails: {
            Description: request.package.description,
            Weight: request.package.weight,
            Width: request.package.width,
            Height: request.package.height,
            Length: request.package.length
          }
        }]
      })
    });

    if (!response.ok) {
      throw new Error(`Aramex API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      trackingNumber: data.Shipments[0].ShipmentNumber,
      courierCode: courier.code,
      estimatedDelivery: new Date(data.Shipments[0].EstimatedDeliveryDate),
      cost: data.Shipments[0].ShipmentAmount,
      labelUrl: data.Shipments[0].LabelURL,
      status: 'Created'
    };
  }

  private async createDHLShipment(request: ShipmentRequest, courier: CourierConfig): Promise<ShipmentResponse> {
    const response = await fetch(`${courier.baseUrl}shipments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${courier.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        plannedShippingDateAndTime: new Date().toISOString(),
        pickup: {
          isRequested: false,
          closeTime: '18:00',
          location: 'Reception'
        },
        productCode: 'N',
        localProductCode: 'N',
        getRateEstimates: false,
        accounts: [{
          typeCode: 'shipper',
          number: courier.apiKey
        }],
        customerDetails: {
          shipperDetails: {
            postalAddress: {
              postalCode: request.pickupAddress.postalCode,
              cityName: request.pickupAddress.city,
              countryCode: 'LK',
              addressLine1: request.pickupAddress.address
            },
            contactInfo: {
              phone: request.pickupAddress.phone,
              companyName: request.pickupAddress.name
            }
          },
          receiverDetails: {
            postalAddress: {
              postalCode: request.deliveryAddress.postalCode,
              cityName: request.deliveryAddress.city,
              countryCode: 'LK',
              addressLine1: request.deliveryAddress.address
            },
            contactInfo: {
              phone: request.deliveryAddress.phone,
              companyName: request.deliveryAddress.name
            }
          }
        },
        content: {
          packages: [{
            weight: request.package.weight,
            dimensions: {
              length: request.package.length,
              width: request.package.width,
              height: request.package.height
            },
            customerReferences: [{
              value: request.orderId
            }]
          }]
        }
      })
    });

    if (!response.ok) {
      throw new Error(`DHL API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      trackingNumber: data.shipmentTrackingNumber,
      courierCode: courier.code,
      estimatedDelivery: new Date(data.estimatedDeliveryDate),
      cost: data.totalNet,
      labelUrl: data.documentURL,
      status: 'Created'
    };
  }

  private async createFedExShipment(request: ShipmentRequest, courier: CourierConfig): Promise<ShipmentResponse> {
    const response = await fetch(`${courier.baseUrl}ship/v1/shipments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${courier.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        requestedShipment: {
          shipper: {
            contact: {
              personName: request.pickupAddress.name,
              phoneNumber: request.pickupAddress.phone
            },
            address: {
              streetLines: [request.pickupAddress.address],
              city: request.pickupAddress.city,
              postalCode: request.pickupAddress.postalCode,
              countryCode: 'LK'
            }
          },
          recipients: [{
            contact: {
              personName: request.deliveryAddress.name,
              phoneNumber: request.deliveryAddress.phone
            },
            address: {
              streetLines: [request.deliveryAddress.address],
              city: request.deliveryAddress.city,
              postalCode: request.deliveryAddress.postalCode,
              countryCode: 'LK'
            }
          }],
          requestedPackageLineItems: [{
            weight: {
              units: 'KG',
              value: request.package.weight
            },
            dimensions: {
              length: request.package.length,
              width: request.package.width,
              height: request.package.height,
              units: 'CM'
            }
          }],
          labelSpecification: {
            labelFormatType: 'COMMON2D',
            imageType: 'PNG'
          }
        }
      })
    });

    if (!response.ok) {
      throw new Error(`FedEx API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      trackingNumber: data.output.transactionDetail.customerTransactionId,
      courierCode: courier.code,
      estimatedDelivery: new Date(data.output.completedShipmentDetail.operationalDetail.estimatedDeliveryTimestamp),
      cost: data.output.completedShipmentDetail.completedPackageDetails[0].packageRating.packageRateDetails[0].totalNetCharge,
      labelUrl: data.output.completedShipmentDetail.completedPackageDetails[0].label.parts[0].image,
      status: 'Created'
    };
  }

  private async createUPSShipment(request: ShipmentRequest, courier: CourierConfig): Promise<ShipmentResponse> {
    const response = await fetch(`${courier.baseUrl}api/shipments/v1/fromshipment`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${courier.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ShipmentRequest: {
          Request: {
            RequestOption: 'nonvalidate',
            TransactionReference: {
              CustomerContext: request.orderId
            }
          },
          Shipment: {
            Description: request.package.description,
            Shipper: {
              Name: request.pickupAddress.name,
              Phone: {
                Number: request.pickupAddress.phone
              },
              Address: {
                AddressLine: [request.pickupAddress.address],
                City: request.pickupAddress.city,
                PostalCode: request.pickupAddress.postalCode,
                CountryCode: 'LK'
              }
            },
            ShipTo: {
              Name: request.deliveryAddress.name,
              Phone: {
                Number: request.deliveryAddress.phone
              },
              Address: {
                AddressLine: [request.deliveryAddress.address],
                City: request.deliveryAddress.city,
                PostalCode: request.deliveryAddress.postalCode,
                CountryCode: 'LK'
              }
            },
            Package: [{
              PackagingType: {
                Code: '02',
                Description: 'Package'
              },
              Dimensions: {
                UnitOfMeasurement: {
                  Code: 'CM'
                },
                Length: request.package.length.toString(),
                Width: request.package.width.toString(),
                Height: request.package.height.toString()
              },
              PackageWeight: {
                UnitOfMeasurement: {
                  Code: 'KGS'
                },
                Weight: request.package.weight.toString()
              }
            }]
          }
        }
      })
    });

    if (!response.ok) {
      throw new Error(`UPS API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      trackingNumber: data.ShipmentResponse.ShipmentResults.PackageResults.TrackingNumber,
      courierCode: courier.code,
      estimatedDelivery: new Date(data.ShipmentResponse.ShipmentResults.ShipmentCharges.TotalCharges.MonetaryValue),
      cost: parseFloat(data.ShipmentResponse.ShipmentResults.ShipmentCharges.TotalCharges.MonetaryValue),
      labelUrl: data.ShipmentResponse.ShipmentResults.PackageResults.LabelImage.GraphicImage,
      status: 'Created'
    };
  }

  private async createGenericShipment(request: ShipmentRequest, courier: CourierConfig): Promise<ShipmentResponse> {
    // Generic shipment creation for unsupported couriers
    return {
      trackingNumber: `GEN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      courierCode: courier.code,
      estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
      cost: 0,
      status: 'Created'
    };
  }

  // Sync Methods
  private async syncTrackingEvent(trackingInfo: TrackingInfo, organizationId: string): Promise<void> {
    const syncEvent: SyncEvent = {
      id: `tracking-${Date.now()}-${Math.random()}`,
      type: 'order',
      action: 'update',
      entityId: trackingInfo.trackingNumber || '',
      organizationId: organizationId,
      data: {
        trackingNumber: trackingInfo.trackingNumber,
        status: trackingInfo.status,
        location: trackingInfo.location,
        estimatedDelivery: trackingInfo.estimatedDelivery,
      },
      timestamp: new Date(),
      source: 'courier-service',
    };

    await realTimeSyncService.queueEvent(syncEvent);
  }

  private async syncShipmentEvent(shipmentResponse: ShipmentResponse, organizationId: string, action: 'create' | 'update' = 'update'): Promise<void> {
    const syncEvent: SyncEvent = {
      id: `shipment-${Date.now()}-${Math.random()}`,
      type: 'order',
      action: action,
      entityId: shipmentResponse.trackingNumber || '',
      organizationId,
      data: shipmentResponse,
      timestamp: new Date(),
      source: 'courier-service',
    };

    await realTimeSyncService.queueEvent(syncEvent);
  }

  // Utility Methods
  async addCourier(config: CourierConfig): Promise<void> {
    await prisma.courier.create({
      data: {
        name: config.name,
        code: config.code,
        apiKey: config.apiKey,
        apiSecret: config.apiSecret,
        isActive: config.isActive,
        organizationId: config.organizationId
      }
    });

    this.couriers.set(config.code, config);
    this.emit('courier_added', config);
  }

  async removeCourier(courierCode: string): Promise<void> {
    await prisma.courier.updateMany({
      where: { code: courierCode },
      data: { isActive: false }
    });

    this.couriers.delete(courierCode);
    this.emit('courier_removed', { courierCode });
  }

  async testCourierConnection(courierCode: string): Promise<boolean> {
    const courier = this.couriers.get(courierCode);
    if (!courier) return false;

    try {
      // Test with a dummy tracking number
      await this.trackShipment('TEST123', courierCode);
      return true;
    } catch (error) {
      return false;
    }
  }

  getAvailableCouriers(): string[] {
    return Array.from(this.couriers.keys());
  }
}

export const sriLankaCourierService = new SriLankaCourierService(); 