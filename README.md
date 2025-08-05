# 🚀 SmartStore AI - AI-Powered Multi-Channel Commerce Platform

A comprehensive, production-ready SaaS platform that combines AI-powered automation with multi-channel commerce management. Built with Next.js 14, TypeScript, and modern web technologies.

![SmartStore AI](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.3-38B2AC?style=for-the-badge&logo=tailwind-css)
![Prisma](https://img.shields.io/badge/Prisma-5.0-2D3748?style=for-the-badge&logo=prisma)
![MongoDB](https://img.shields.io/badge/MongoDB-7.0-47A248?style=for-the-badge&logo=mongodb)

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Environment Setup](#environment-setup)
- [Database Setup](#database-setup)
- [API Documentation](#api-documentation)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

## 🎯 Overview

SmartStore AI is a cutting-edge e-commerce management platform that leverages artificial intelligence to automate and optimize business operations. The platform provides comprehensive tools for managing products, orders, customers, inventory, and multi-channel sales across various platforms.

### Key Highlights

- 🤖 **AI-Powered Automation**: Intelligent chatbots, predictive analytics, and automated workflows
- 📱 **Multi-Channel Integration**: Unified management across web, mobile, social media, and marketplaces
- 🏪 **Complete E-commerce Suite**: From product management to order fulfillment
- 📊 **Advanced Analytics**: Real-time insights and business intelligence
- 🔄 **Workflow Automation**: Streamlined business processes
- 🛡️ **Enterprise Security**: Multi-tenant architecture with role-based access control

## ✨ Features

### Core Modules

#### 🛍️ **Product Management**
- Product catalog with categories and variants
- Inventory tracking and stock management
- Bulk import/export operations
- Product analytics and performance metrics

#### 📦 **Order Management**
- Order processing and fulfillment
- Real-time order tracking
- Automated order status updates
- Multi-channel order aggregation

#### 👥 **Customer Management**
- Customer profiles and segmentation
- Purchase history and preferences
- Customer lifetime value analysis
- Automated customer engagement

#### 🚚 **Courier & Delivery**
- Real-time courier tracking
- Delivery route optimization
- Performance analytics
- Automated delivery assignments

#### 🏭 **Warehouse Management**
- Multi-location inventory management
- Stock movement tracking
- Warehouse performance analytics
- Automated reorder notifications

#### 💰 **Expense Management**
- Expense categorization and tracking
- Approval workflows
- Financial reporting
- Budget management

#### 📊 **Advanced Reporting**
- Custom report generation
- Multiple export formats (PDF, Excel, CSV)
- Scheduled reporting
- Business intelligence dashboards

#### 🔄 **Bulk Operations**
- Data import/export tools
- Batch processing capabilities
- Progress tracking
- Error handling and validation

#### 📢 **Campaign Management**
- Multi-channel marketing campaigns
- Email, SMS, WhatsApp integration
- Campaign templates
- Performance analytics

### AI-Powered Features

#### 🤖 **AI Chatbot**
- Product discovery and recommendations
- Order status inquiries
- Customer support automation
- Sentiment analysis
- Urgent issue detection

#### 📈 **Predictive Analytics**
- Sales forecasting
- Customer churn prediction
- Inventory optimization
- Demand planning
- Seasonal trend analysis

#### 🔄 **Automated Workflows**
- Order processing automation
- Inventory management workflows
- Customer engagement automation
- Payment processing workflows

### Multi-Channel Integration

- **Web Store**: Customizable online storefront
- **Mobile App**: Progressive Web App (PWA)
- **Social Media**: Facebook, Instagram, TikTok integration
- **Marketplaces**: Shopify, WooCommerce, Magento integration
- **Messaging**: WhatsApp Business API, Facebook Messenger
- **Payment Gateways**: Stripe, PayPal, PayHere, COD

## 🛠 Tech Stack

### Frontend
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS** - Utility-first CSS framework
- **Headless UI** - Accessible UI components
- **Lucide React** - Beautiful icons
- **React Query** - Data fetching and caching
- **React Hook Form** - Form management
- **Zod** - Schema validation

### Backend
- **Next.js API Routes** - Server-side API endpoints
- **Prisma ORM** - Database toolkit
- **MongoDB** - NoSQL database
- **Redis** - Caching and session storage
- **NextAuth.js** - Authentication solution

### AI & External Services
- **OpenAI API** - AI-powered features
- **Ollama** - Local LLM integration
- **Twilio** - WhatsApp Business API
- **Stripe** - Payment processing
- **Cloudinary** - Image management

### Development Tools
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **Husky** - Git hooks
- **Docker** - Containerization
- **GitHub Actions** - CI/CD

## 🏗 Architecture

### System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   External      │
│   (Next.js)     │◄──►│   (API Routes)  │◄──►│   Services      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   PWA           │    │   Database      │    │   AI Services   │
│   (Offline)     │    │   (MongoDB)     │    │   (OpenAI)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Cache         │    │   File Storage  │    │   Payment       │
│   (Redis)       │    │   (Cloudinary)  │    │   (Stripe)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Database Schema

The platform uses a multi-tenant architecture with the following core entities:

- **Organizations** - Multi-tenant isolation
- **Users** - Authentication and authorization
- **Products** - Product catalog and inventory
- **Orders** - Order management and tracking
- **Customers** - Customer profiles and data
- **Couriers** - Delivery management
- **Warehouses** - Inventory locations
- **Expenses** - Financial tracking
- **Campaigns** - Marketing campaigns
- **Reports** - Analytics and reporting

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- MongoDB 7.0+
- Redis 6+
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/AsithaLKonara/SmartStoreSaaS.git
   cd SmartStoreSaaS
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env.local
   ```

4. **Configure environment variables** (see [Environment Setup](#environment-setup))

5. **Set up the database**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

6. **Seed the database** (optional)
   ```bash
   npm run db:seed
   ```

7. **Start the development server**
   ```bash
   npm run dev
   ```

8. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## ⚙️ Environment Setup

Create a `.env.local` file with the following variables:

### Database
```env
DATABASE_URL="mongodb://localhost:27017/smartstore"
```

### Authentication
```env
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

### AI Services
```env
OPENAI_API_KEY="your-openai-api-key"
OLLAMA_BASE_URL="http://localhost:11434"
```

### Payment Gateways
```env
STRIPE_SECRET_KEY="your-stripe-secret-key"
STRIPE_PUBLISHABLE_KEY="your-stripe-publishable-key"
PAYPAL_CLIENT_ID="your-paypal-client-id"
PAYPAL_CLIENT_SECRET="your-paypal-client-secret"
```

### Messaging Services
```env
TWILIO_ACCOUNT_SID="your-twilio-account-sid"
TWILIO_AUTH_TOKEN="your-twilio-auth-token"
TWILIO_PHONE_NUMBER="your-twilio-phone-number"
```

### File Storage
```env
CLOUDINARY_CLOUD_NAME="your-cloudinary-cloud-name"
CLOUDINARY_API_KEY="your-cloudinary-api-key"
CLOUDINARY_API_SECRET="your-cloudinary-api-secret"
```

### Redis
```env
REDIS_URL="redis://localhost:6379"
```

## 🗄 Database Setup

### Using Docker (Recommended)

1. **Start MongoDB and Redis**
   ```bash
   docker-compose up -d
   ```

2. **Run database migrations**
   ```bash
   npx prisma db push
   ```

3. **Access MongoDB Express** (optional)
   Navigate to [http://localhost:8081](http://localhost:8081)
   - Username: `admin`
   - Password: `password`

### Manual Setup

1. **Install MongoDB**
   - Download from [mongodb.com](https://www.mongodb.com/try/download/community)
   - Start MongoDB service

2. **Install Redis**
   - Download from [redis.io](https://redis.io/download)
   - Start Redis server

3. **Update DATABASE_URL in .env.local**
   ```env
   DATABASE_URL="mongodb://localhost:27017/smartstore"
   ```

### MongoDB Atlas (Cloud)

For production, you can use MongoDB Atlas:

1. **Create a MongoDB Atlas account**
   - Go to [mongodb.com/atlas](https://www.mongodb.com/atlas)
   - Create a free cluster

2. **Get your connection string**
   ```env
   DATABASE_URL="mongodb+srv://username:password@cluster.mongodb.net/smartstore?retryWrites=true&w=majority"
   ```

## 📚 API Documentation

### Authentication Endpoints

- `POST /api/auth/signin` - User sign in
- `POST /api/auth/signup` - User registration
- `GET /api/auth/session` - Get current session
- `POST /api/auth/signout` - User sign out

### Core API Endpoints

#### Products
- `GET /api/products` - List all products
- `POST /api/products` - Create new product
- `GET /api/products/[id]` - Get product details
- `PUT /api/products/[id]` - Update product
- `DELETE /api/products/[id]` - Delete product

#### Orders
- `GET /api/orders` - List all orders
- `POST /api/orders` - Create new order
- `GET /api/orders/[id]` - Get order details
- `PUT /api/orders/[id]` - Update order status

#### Customers
- `GET /api/customers` - List all customers
- `POST /api/customers` - Create new customer
- `GET /api/customers/[id]` - Get customer details

#### Couriers
- `GET /api/couriers` - List all couriers
- `POST /api/couriers` - Create new courier
- `GET /api/couriers/deliveries` - Get delivery assignments

#### Warehouse
- `GET /api/warehouses` - List all warehouses
- `GET /api/warehouses/inventory` - Get inventory status
- `GET /api/warehouses/movements` - Get inventory movements

#### Expenses
- `GET /api/expenses` - List all expenses
- `POST /api/expenses` - Create new expense
- `PUT /api/expenses/[id]/approve` - Approve expense

#### Reports
- `GET /api/reports` - List all reports
- `POST /api/reports/generate` - Generate new report
- `GET /api/reports/[id]/download` - Download report

#### Bulk Operations
- `GET /api/bulk-operations` - List all operations
- `POST /api/bulk-operations/start` - Start bulk operation
- `GET /api/bulk-operations/templates` - Get operation templates

### AI Endpoints

- `POST /api/chat/ai` - AI-powered chat interactions
- `GET /api/analytics/ai` - AI-powered analytics
- `POST /api/workflows/trigger` - Trigger automated workflows

## 🚀 Deployment

### Docker Deployment

1. **Build the Docker image**
   ```bash
   docker build -t smartstore-ai .
   ```

2. **Run with Docker Compose**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

### Vercel Deployment

1. **Install Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Deploy to Vercel**
   ```bash
   vercel --prod
   ```

### Environment Variables for Production

Set the following environment variables in your production environment:

- `DATABASE_URL` - Production MongoDB URL
- `NEXTAUTH_SECRET` - Strong secret key
- `NEXTAUTH_URL` - Production domain
- `REDIS_URL` - Production Redis URL
- All API keys for external services

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Make your changes**
4. **Run tests**
   ```bash
   npm run test
   ```
5. **Commit your changes**
   ```bash
   git commit -m 'Add amazing feature'
   ```
6. **Push to the branch**
   ```bash
   git push origin feature/amazing-feature
   ```
7. **Open a Pull Request**

### Development Guidelines

- Follow TypeScript best practices
- Use ESLint and Prettier for code formatting
- Write meaningful commit messages
- Add tests for new features
- Update documentation as needed

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [docs.smartstore.ai](https://docs.smartstore.ai)
- **Issues**: [GitHub Issues](https://github.com/AsithaLKonara/SmartStoreSaaS/issues)
- **Discussions**: [GitHub Discussions](https://github.com/AsithaLKonara/SmartStoreSaaS/discussions)
- **Email**: support@smartstore.ai

## 🙏 Acknowledgments

- Next.js team for the amazing framework
- Vercel for hosting and deployment
- OpenAI for AI capabilities
- All contributors and supporters

---

**Made with ❤️ by the SmartStore AI Team**

[![GitHub stars](https://img.shields.io/github/stars/AsithaLKonara/SmartStoreSaaS?style=social)](https://github.com/AsithaLKonara/SmartStoreSaaS/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/AsithaLKonara/SmartStoreSaaS?style=social)](https://github.com/AsithaLKonara/SmartStoreSaaS/network/members)
[![GitHub issues](https://img.shields.io/github/issues/AsithaLKonara/SmartStoreSaaS)](https://github.com/AsithaLKonara/SmartStoreSaaS/issues)
[![GitHub license](https://img.shields.io/github/license/AsithaLKonara/SmartStoreSaaS)](https://github.com/AsithaLKonara/SmartStoreSaaS/blob/main/LICENSE)