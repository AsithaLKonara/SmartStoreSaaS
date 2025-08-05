# 🚀 SmartStore AI - Real-Time Sync & Integration Platform

## 📋 Overview

SmartStore AI now features comprehensive real-time synchronization capabilities, WhatsApp Business API integration, WooCommerce plugin, and Sri Lankan courier service APIs. This document outlines the complete integration ecosystem.

## 🔄 Real-Time 2-Way Sync System

### Core Architecture

The real-time sync system provides instant synchronization across all platforms:

- **WebSocket-based communication** for real-time updates
- **Conflict resolution** with manual and automatic options
- **Event-driven architecture** with queue management
- **Redis caching** for performance optimization
- **Multi-platform support** (web, WhatsApp, WooCommerce, couriers)

### Key Components

#### 1. RealTimeSyncService
```typescript
// Core sync engine with WebSocket server
import { realTimeSyncService } from '@/lib/sync/realTimeSyncService';

// Queue an event for sync
await realTimeSyncService.queueEvent({
  id: 'unique-event-id',
  type: 'product',
  action: 'update',
  data: productData,
  source: 'web',
  timestamp: new Date(),
  organizationId: 'org-id'
});
```

#### 2. useRealTimeSync Hook
```typescript
// React hook for client-side sync management
import { useRealTimeSync } from '@/hooks/useRealTimeSync';

const {
  isConnected,
  syncStatus,
  events,
  conflicts,
  connect,
  disconnect,
  forceSync,
  resolveConflict
} = useRealTimeSync({
  organizationId: 'your-org-id',
  autoConnect: true
});
```

### Sync Events

The system handles these event types:
- **Products**: Create, update, delete
- **Orders**: Status changes, new orders
- **Customers**: Profile updates, new customers
- **Inventory**: Stock level changes
- **Messages**: WhatsApp conversations

### Conflict Resolution

When conflicts occur, the system provides multiple resolution options:
- **Local**: Use local changes
- **Remote**: Use remote changes
- **Manual**: Manual conflict resolution
- **Merge**: Intelligent data merging

## 📱 WhatsApp Business API Integration

### Features

- **Real-time messaging** with customers
- **Automatic catalog updates** when products change
- **Order status notifications** via WhatsApp
- **Customer query handling** (orders, products, support)
- **Webhook processing** for incoming messages

### Setup

#### 1. Environment Variables
```env
WHATSAPP_PHONE_NUMBER_ID="your-phone-number-id"
WHATSAPP_ACCESS_TOKEN="your-access-token"
WHATSAPP_WEBHOOK_SECRET="your-webhook-secret"
```

#### 2. Integration Configuration
```typescript
// Configure WhatsApp integration
await prisma.whatsAppIntegration.create({
  data: {
    organizationId: 'your-org-id',
    phoneNumberId: 'your-phone-number-id',
    accessToken: 'your-access-token',
    webhookSecret: 'your-webhook-secret',
    isActive: true
  }
});
```

#### 3. Send Messages
```typescript
import { whatsAppService } from '@/lib/whatsapp/whatsappService';

// Send text message
await whatsAppService.sendMessage(
  '+1234567890',
  'Your order has been shipped!',
  'text',
  'your-org-id'
);

// Send template message
await whatsAppService.sendMessage(
  '+1234567890',
  {
    name: 'order_status',
    language: 'en',
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: 'ORD-123' },
          { type: 'text', text: 'Shipped' }
        ]
      }
    ]
  },
  'template',
  'your-org-id'
);
```

#### 4. Update Catalog
```typescript
// Automatically update WhatsApp catalog
await whatsAppService.updateCatalog('your-org-id');
```

### Webhook Processing

The system automatically processes WhatsApp webhooks:

```typescript
// POST /api/webhooks/whatsapp
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "phone-number-id",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "messages": [{
          "id": "message-id",
          "from": "customer-phone",
          "text": { "body": "Hello" }
        }]
      },
      "field": "messages"
    }]
  }]
}
```

## 🛒 WooCommerce WordPress Plugin

### Plugin Features

- **Bidirectional sync** between WooCommerce and SmartStore
- **Real-time product updates** (create, update, delete)
- **Order synchronization** with status tracking
- **Inventory management** across platforms
- **Webhook integration** for instant updates

### Installation

1. **Download the plugin** from `wordpress-plugin/smartstore-woocommerce.php`
2. **Upload to WordPress** plugins directory
3. **Activate the plugin** in WordPress admin
4. **Configure integration** in SmartStore → WooCommerce

### Configuration

#### 1. SmartStore Settings
```php
// In WordPress admin
SmartStore → WooCommerce Integration

API URL: https://your-smartstore.com
API Key: your-api-key
Organization ID: your-org-id
Webhook Secret: your-webhook-secret
```

#### 2. Auto Sync Options
- ✅ Sync Products
- ✅ Sync Orders
- ✅ Auto Sync Enabled

#### 3. Manual Sync
- **Sync All Products**: Manually sync all products
- **Sync All Orders**: Manually sync all orders
- **Test Connection**: Verify API connectivity

### Webhook Integration

The plugin automatically sets up webhooks for:
- `product.created`
- `product.updated`
- `product.deleted`
- `order.created`
- `order.updated`

### API Endpoints

```php
// WooCommerce webhook endpoint
POST /api/webhooks/woocommerce/{organizationId}

// Process product updates
{
  "topic": "product.updated",
  "data": {
    "id": 123,
    "name": "Product Name",
    "price": "29.99",
    "stock_quantity": 10
  }
}
```

## 🚚 Sri Lankan Courier Service APIs

### Supported Couriers

| Courier | API Status | Features |
|---------|------------|----------|
| **Aramex** | ✅ Full Support | Tracking, Shipment Creation |
| **DHL** | ✅ Full Support | Tracking, Shipment Creation |
| **FedEx** | ✅ Full Support | Tracking, Shipment Creation |
| **UPS** | ✅ Full Support | Tracking, Shipment Creation |
| **Ceylinco** | ✅ Full Support | Local Tracking |
| **Skynet** | ✅ Full Support | Local Delivery |

### Setup

#### 1. Add Courier Configuration
```typescript
import { sriLankaCourierService } from '@/lib/courier/sriLankaCourierService';

await sriLankaCourierService.addCourier({
  name: 'Aramex',
  code: 'aramex',
  apiKey: 'your-api-key',
  apiSecret: 'your-api-secret',
  baseUrl: 'https://ws.aramex.com/',
  isActive: true,
  organizationId: 'your-org-id'
});
```

#### 2. Track Shipments
```typescript
// Track shipment
const trackingInfo = await sriLankaCourierService.trackShipment(
  'TRACK123456',
  'aramex'
);

console.log(trackingInfo);
// {
//   trackingNumber: 'TRACK123456',
//   courierCode: 'aramex',
//   status: 'In Transit',
//   location: 'Colombo',
//   timestamp: '2024-01-15T10:30:00Z',
//   description: 'Package picked up',
//   estimatedDelivery: '2024-01-17T14:00:00Z',
//   events: [...]
// }
```

#### 3. Create Shipments
```typescript
const shipment = await sriLankaCourierService.createShipment({
  pickupAddress: {
    name: 'John Doe',
    phone: '+94123456789',
    address: '123 Main St',
    city: 'Colombo',
    postalCode: '10000'
  },
  deliveryAddress: {
    name: 'Jane Smith',
    phone: '+94123456790',
    address: '456 Oak Ave',
    city: 'Kandy',
    postalCode: '20000'
  },
  package: {
    weight: 2.5,
    length: 30,
    width: 20,
    height: 15,
    description: 'Electronics package'
  },
  orderId: 'ORD-123',
  organizationId: 'your-org-id'
}, 'aramex');
```

### API Endpoints

#### Track Shipment
```http
GET /api/courier/track?trackingNumber=TRACK123&courierCode=aramex
```

#### Create Shipment
```http
POST /api/courier/track
{
  "pickupAddress": { ... },
  "deliveryAddress": { ... },
  "package": { ... },
  "orderId": "ORD-123",
  "organizationId": "your-org-id",
  "courierCode": "aramex"
}
```

## 🔧 Integration Management

### Integration Dashboard

Access the integration management dashboard at `/integrations`:

- **WhatsApp Configuration**: Phone number, access token, webhook setup
- **WooCommerce Setup**: Site URL, API credentials, webhook configuration
- **Courier Services**: Add and configure multiple courier APIs
- **Connection Testing**: Verify all integrations are working
- **Status Monitoring**: Real-time status of all integrations

### Health Monitoring

#### Health Check Endpoint
```http
GET /api/health?organizationId=your-org-id&detailed=true
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.0.0",
  "environment": "production",
  "uptime": 86400,
  "services": {
    "database": "healthy",
    "redis": "healthy",
    "websocket": "healthy",
    "integrations": {
      "whatsapp": "healthy",
      "woocommerce": "healthy",
      "couriers": {
        "aramex": "healthy",
        "dhl": "healthy"
      }
    }
  }
}
```

### Sync Status Monitoring

Access sync status at `/sync`:

- **Connection Status**: WebSocket connection health
- **Last Sync**: Timestamp of last successful sync
- **Pending Events**: Number of events in queue
- **Active Connections**: Number of connected clients
- **Conflict Resolution**: Manage sync conflicts
- **Recent Events**: View recent sync activity

## 🚀 Deployment

### Environment Setup

#### Required Environment Variables
```env
# Database
DATABASE_URL="mongodb://localhost:27017/smartstore"

# Redis
REDIS_URL="redis://localhost:6379"

# WhatsApp Business API
WHATSAPP_PHONE_NUMBER_ID="your-phone-number-id"
WHATSAPP_ACCESS_TOKEN="your-access-token"
WHATSAPP_WEBHOOK_SECRET="your-webhook-secret"

# WooCommerce
WOOCOMMERCE_CONSUMER_KEY="your-consumer-key"
WOOCOMMERCE_CONSUMER_SECRET="your-consumer-secret"

# Courier APIs
ARAMEX_API_KEY="your-aramex-api-key"
DHL_API_KEY="your-dhl-api-key"
FEDEX_API_KEY="your-fedex-api-key"
UPS_API_KEY="your-ups-api-key"
CEYLINCO_API_KEY="your-ceylinco-api-key"
SKYNET_API_KEY="your-skynet-api-key"

# WebSocket
WEBSOCKET_PORT="3001"
```

### Docker Deployment

#### docker-compose.yml
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
      - "3001:3001"
    environment:
      - DATABASE_URL=mongodb://mongo:27017/smartstore
      - REDIS_URL=redis://redis:6379
    depends_on:
      - mongo
      - redis

  mongo:
    image: mongo:7.0
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  mongo-express:
    image: mongo-express
    ports:
      - "8081:8081"
    environment:
      - ME_CONFIG_MONGODB_SERVER=mongo
      - ME_CONFIG_BASICAUTH_USERNAME=admin
      - ME_CONFIG_BASICAUTH_PASSWORD=password

volumes:
  mongo_data:
```

### Production Considerations

1. **SSL/TLS**: Use HTTPS for all webhook endpoints
2. **Rate Limiting**: Implement rate limiting for API endpoints
3. **Monitoring**: Set up monitoring for sync health
4. **Backup**: Regular database backups
5. **Scaling**: Use Redis cluster for high availability

## 📊 Business Benefits

### Real-Time Operations
- **Instant Updates**: Changes reflect immediately across all platforms
- **Live Inventory**: Real-time stock level synchronization
- **Order Tracking**: Live order status updates
- **Customer Communication**: Instant WhatsApp notifications

### Multi-Channel Management
- **Unified Dashboard**: Manage all channels from one platform
- **Consistent Data**: Same product and customer data everywhere
- **Automated Sync**: No manual data entry required
- **Error Prevention**: Reduced data inconsistencies

### Customer Experience
- **WhatsApp Support**: Direct customer communication
- **Order Notifications**: Real-time order status updates
- **Product Catalogs**: WhatsApp product catalogs
- **Multi-Platform Shopping**: Seamless experience across channels

### Operational Efficiency
- **Automated Workflows**: Reduced manual processes
- **Real-Time Analytics**: Live business insights
- **Integrated Logistics**: Courier service integration
- **Scalable Architecture**: Handle growing business needs

## 🔮 Future Enhancements

### Planned Features
- **AI-Powered Sync**: Intelligent conflict resolution
- **Advanced Analytics**: Sync performance metrics
- **Mobile App**: Native mobile integration
- **API Marketplace**: Third-party integrations
- **Multi-Language**: Internationalization support

### Integration Roadmap
- **Shopify**: Direct Shopify integration
- **Magento**: Magento e-commerce support
- **Social Media**: Instagram, Facebook Shop integration
- **Payment Gateways**: Additional payment providers
- **ERP Systems**: Enterprise resource planning integration

## 📞 Support

For technical support and integration assistance:

- **Documentation**: Complete API documentation
- **Community**: Developer community forum
- **Support**: Technical support team
- **Training**: Integration training sessions

---

**SmartStore AI** - Powering the future of multi-channel commerce with real-time synchronization and intelligent automation. 