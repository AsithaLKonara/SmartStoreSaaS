# SmartStore AI 🚀

An AI-powered multi-channel commerce automation platform for social sellers, chat-first businesses, and omnichannel retailers.

## 🌟 Features

### 🤖 AI-Powered Chatbot
- Natural language product discovery
- Automated order processing
- FAQ and order status responses
- Local LLM integration (Ollama)
- Chat confidence scoring

### 💬 Multi-Channel Integration
- WhatsApp Business API
- Facebook Messenger & Instagram DM
- Website chatbot widget
- Unified inbox with smart filters
- Message templates and quick replies

### 📦 Order Management
- Multi-channel order dashboard
- Automated status transitions
- Batch pick & pack optimization
- Return & exchange processing
- Print-ready packing lists

### 🚚 Courier & Delivery
- API integration with major couriers
- Real-time delivery tracking
- Customer rescheduling via chatbot
- Delivery analytics and performance

### 💳 Payment System
- COD and online payments
- Multiple gateway support (Stripe, PayPal, PayHere)
- Auto payment reconciliation
- Payment reminders via WhatsApp/Email

### 👥 Customer CRM
- Auto-generated customer profiles
- Smart segmentation
- Loyalty points system
- Activity timeline
- Purchase history tracking

### 📊 Analytics & Reports
- Sales analytics dashboard
- Inventory aging reports
- Courier performance metrics
- Customer lifetime value
- Profit & loss tracking

## 🏗️ Architecture

### Tech Stack
- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS, Headless UI
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: PostgreSQL
- **Authentication**: NextAuth.js
- **AI**: OpenAI API, Ollama (Local LLM)
- **Payments**: Stripe, PayPal, PayHere
- **File Storage**: Cloudinary
- **Caching**: Redis
- **Deployment**: Vercel/Railway

### Database Schema
The platform uses a comprehensive Prisma schema with:
- Multi-tenant organization structure
- Complete e-commerce models (Products, Orders, Customers)
- Chat and communication tracking
- Payment and shipping management
- Marketing campaign system

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- PostgreSQL database
- Redis (optional, for caching)
- Ollama (for local AI features)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/smartstore-ai.git
   cd smartstore-ai
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env.local
   # Edit .env.local with your configuration
   ```

4. **Set up the database**
   ```bash
   npx prisma generate
   npx prisma db push
   npx prisma db seed
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 📁 Project Structure

```
smartstore-ai/
├── src/
│   ├── app/                 # Next.js 14 App Router
│   │   ├── (auth)/          # Authentication pages
│   │   ├── (dashboard)/     # Dashboard pages
│   │   ├── api/             # API routes
│   │   └── globals.css      # Global styles
│   ├── components/          # Reusable components
│   │   ├── ui/              # Base UI components
│   │   ├── forms/           # Form components
│   │   ├── dashboard/       # Dashboard components
│   │   └── chat/            # Chat components
│   ├── lib/                 # Utility libraries
│   │   ├── prisma.ts        # Prisma client
│   │   ├── auth.ts          # Authentication config
│   │   └── utils.ts         # Utility functions
│   ├── services/            # Business logic services
│   │   ├── ai/              # AI services
│   │   ├── chat/            # Chat services
│   │   ├── payment/         # Payment services
│   │   └── courier/         # Courier services
│   ├── types/               # TypeScript type definitions
│   └── hooks/               # Custom React hooks
├── prisma/                  # Database schema and migrations
├── public/                  # Static assets
└── docs/                    # Documentation
```

## 🔧 Configuration

### Environment Variables

Key environment variables you need to configure:

```bash
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/smartstore_ai"

# Authentication
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key"

# Payment Gateways
STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_SECRET_KEY="sk_test_..."

# WhatsApp Integration
TWILIO_ACCOUNT_SID="your-twilio-sid"
TWILIO_AUTH_TOKEN="your-twilio-token"

# AI Services
OPENAI_API_KEY="your-openai-key"
OLLAMA_BASE_URL="http://localhost:11434"
```

### Database Setup

1. **Create PostgreSQL database**
2. **Run migrations**
   ```bash
   npx prisma migrate dev
   ```
3. **Seed initial data**
   ```bash
   npx prisma db seed
   ```

## 🎯 Core Modules

### 1. Chat Center
- Unified inbox for all channels
- AI-powered chatbot responses
- Message templates and automation
- Agent assignment and handover

### 2. Product Catalog
- Product management with variants
- Bulk import/export (CSV)
- Multi-channel sync
- Inventory tracking

### 3. Order Management
- Complete order lifecycle
- Automated status updates
- Batch processing
- Return management

### 4. Customer CRM
- Auto-profile creation
- Segmentation and tagging
- Loyalty program
- Activity tracking

### 5. Payment Processing
- Multiple payment methods
- Gateway integration
- Auto-reconciliation
- Payment reminders

### 6. Courier Integration
- API integrations
- Real-time tracking
- Delivery optimization
- Performance analytics

## 🤖 AI Features

### Local LLM Integration
The platform supports local AI models via Ollama:

```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Pull a model
ollama pull llama2

# Start Ollama service
ollama serve
```

### AI Capabilities
- **Product Discovery**: Natural language product search
- **Order Processing**: Automated order creation from chat
- **Customer Support**: FAQ and status inquiries
- **Recommendations**: Product suggestions based on chat context

## 📱 Multi-Channel Support

### WhatsApp Business API
- Twilio integration
- Message templates
- Media sharing
- Quick replies

### Facebook & Instagram
- Messenger integration
- Instagram DM support
- Comment management
- Page insights

### Website Widget
- Embedded chat widget
- Real-time messaging
- File sharing
- Location sharing

## 💳 Payment Integration

### Supported Gateways
- **Stripe**: Credit/debit cards, digital wallets
- **PayPal**: Global payment processing
- **PayHere**: Local payment gateway
- **COD**: Cash on delivery management

### Features
- Secure payment processing
- Multiple currency support
- Auto-reconciliation
- Payment reminders
- Fraud protection

## 🚚 Courier Integration

### Supported Couriers
- **PickMe**: Local delivery service
- **Aramex**: International shipping
- **Custom APIs**: Extensible for other couriers

### Features
- Real-time tracking
- Delivery status updates
- Customer rescheduling
- Performance analytics

## 📊 Analytics & Reporting

### Dashboard Metrics
- Sales performance
- Order status distribution
- Customer acquisition
- Inventory levels
- Delivery success rates

### Export Options
- PDF reports
- Excel spreadsheets
- CSV data export
- Automated reporting

## 🔒 Security & Compliance

### Security Features
- JWT authentication
- Role-based access control
- API rate limiting
- Data encryption
- Audit logging

### Compliance
- GDPR compliance
- Data privacy controls
- Consent management
- Data deletion requests

## 🚀 Deployment

### Vercel Deployment
1. Connect your GitHub repository
2. Configure environment variables
3. Deploy automatically on push

### Self-Hosted
1. Set up PostgreSQL database
2. Configure Redis (optional)
3. Set environment variables
4. Run with PM2 or Docker

### Docker Deployment
```bash
# Build the image
docker build -t smartstore-ai .

# Run the container
docker run -p 3000:3000 smartstore-ai
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [docs.smartstore-ai.com](https://docs.smartstore-ai.com)
- **Issues**: [GitHub Issues](https://github.com/your-username/smartstore-ai/issues)
- **Discord**: [Join our community](https://discord.gg/smartstore-ai)

## 🎉 Acknowledgments

- Built with Next.js and Prisma
- AI powered by OpenAI and Ollama
- Icons by Lucide React
- UI components by Headless UI

---

**SmartStore AI** - Revolutionizing e-commerce with AI-powered automation 🚀 #   S m a r t S t o r e S a a S  
 