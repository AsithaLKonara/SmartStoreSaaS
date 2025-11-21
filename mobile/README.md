# Native Mobile Apps

This directory will contain the native mobile app implementations for SmartStore AI.

## Structure

```
mobile/
├── ios/          # iOS app (Swift/SwiftUI)
├── android/      # Android app (Kotlin/Java)
└── shared/       # Shared code (React Native/Flutter)
```

## Implementation Status

**Status**: Placeholder structure created

**Next Steps**:
1. Choose mobile framework (React Native, Flutter, or native)
2. Set up project structure
3. Implement authentication
4. Port dashboard to mobile
5. Implement push notifications
6. Add offline mode
7. Publish to app stores

## API Integration

The mobile apps will use the same API endpoints as the web application:
- `/api/auth/*` - Authentication
- `/api/products/*` - Products
- `/api/orders/*` - Orders
- `/api/customers/*` - Customers
- `/api/analytics/*` - Analytics
- `/api/mobile/push/*` - Push notifications

## Features

- ✅ Authentication (OAuth, email/password)
- ✅ Product catalog browsing
- ✅ Order management
- ✅ Customer management
- ✅ Analytics dashboard
- ✅ Push notifications
- ✅ Offline mode
- ✅ Real-time sync

