import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { 
  MessageSquare, 
  ShoppingCart, 
  Truck, 
  CreditCard, 
  Users, 
  BarChart3,
  Bot,
  Zap,
  Shield,
  Globe
} from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="relative z-10">
        <nav className="container-responsive py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">SmartStore AI</span>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <Link href="#features" className="text-gray-600 hover:text-gray-900 transition-colors">
                Features
              </Link>
              <Link href="#pricing" className="text-gray-600 hover:text-gray-900 transition-colors">
                Pricing
              </Link>
              <Link href="#about" className="text-gray-600 hover:text-gray-900 transition-colors">
                About
              </Link>
              <Link href="/auth/signin">
                <Button variant="outline" size="sm">
                  Sign In
                </Button>
              </Link>
              <Link href="/auth/signup">
                <Button size="sm">
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="relative py-20 px-4">
        <div className="container-responsive text-center">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
              AI-Powered Commerce
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                Automation Platform
              </span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              Automate your e-commerce operations from product discovery to delivery confirmation 
              across WhatsApp, Facebook, Instagram, websites, and marketplaces.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/auth/signup">
                <Button size="lg" className="text-lg px-8 py-4">
                  Start Free Trial
                </Button>
              </Link>
              <Link href="#demo">
                <Button variant="outline" size="lg" className="text-lg px-8 py-4">
                  Watch Demo
                </Button>
              </Link>
            </div>
          </div>
        </div>
        
        {/* Hero Image */}
        <div className="mt-16 max-w-6xl mx-auto">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-2xl blur-3xl"></div>
            <div className="relative bg-white rounded-2xl shadow-strong p-8 border border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-4">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="flex items-center space-x-3 mb-3">
                      <MessageSquare className="w-5 h-5 text-blue-600" />
                      <span className="font-medium text-gray-900">Chat Center</span>
                    </div>
                    <div className="space-y-2">
                      <div className="bg-white rounded p-2 text-sm">Customer: "I need 2 red mugs under $20"</div>
                      <div className="bg-blue-100 rounded p-2 text-sm ml-4">AI: "Found 3 options for you..."</div>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="flex items-center space-x-3 mb-3">
                      <ShoppingCart className="w-5 h-5 text-green-600" />
                      <span className="font-medium text-gray-900">Order Management</span>
                    </div>
                    <div className="bg-white rounded p-2 text-sm">
                      Order #ORD-123456 created automatically
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="bg-purple-50 rounded-lg p-4">
                    <div className="flex items-center space-x-3 mb-3">
                      <Truck className="w-5 h-5 text-purple-600" />
                      <span className="font-medium text-gray-900">Delivery Tracking</span>
                    </div>
                    <div className="bg-white rounded p-2 text-sm">
                      Package out for delivery - ETA 2 hours
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-white">
        <div className="container-responsive">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Everything you need to scale your business
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              From AI-powered chatbots to automated order processing, SmartStore AI handles 
              every aspect of your multi-channel commerce operations.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* AI Chatbot */}
            <div className="card p-6 hover:shadow-medium transition-shadow">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <Bot className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">AI-Powered Chatbot</h3>
              <p className="text-gray-600 mb-4">
                Natural language product discovery, automated order processing, and intelligent 
                customer support with local LLM integration.
              </p>
              <ul className="space-y-1 text-sm text-gray-600">
                <li>• Product discovery via chat</li>
                <li>• Automated order creation</li>
                <li>• FAQ and status responses</li>
                <li>• Local AI model support</li>
              </ul>
            </div>

            {/* Multi-Channel Integration */}
            <div className="card p-6 hover:shadow-medium transition-shadow">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <Globe className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Multi-Channel Integration</h3>
              <p className="text-gray-600 mb-4">
                Unified inbox for WhatsApp, Facebook, Instagram, and website chat with 
                smart message routing and automation.
              </p>
              <ul className="space-y-1 text-sm text-gray-600">
                <li>• WhatsApp Business API</li>
                <li>• Facebook Messenger & Instagram DM</li>
                <li>• Website chat widget</li>
                <li>• Message templates & quick replies</li>
              </ul>
            </div>

            {/* Order Management */}
            <div className="card p-6 hover:shadow-medium transition-shadow">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <ShoppingCart className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Order Management</h3>
              <p className="text-gray-600 mb-4">
                Complete order lifecycle management with automated status updates, 
                batch processing, and return handling.
              </p>
              <ul className="space-y-1 text-sm text-gray-600">
                <li>• Multi-channel order dashboard</li>
                <li>• Automated status transitions</li>
                <li>• Batch pick & pack optimization</li>
                <li>• Return & exchange processing</li>
              </ul>
            </div>

            {/* Payment System */}
            <div className="card p-6 hover:shadow-medium transition-shadow">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mb-4">
                <CreditCard className="w-6 h-6 text-yellow-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Payment System</h3>
              <p className="text-gray-600 mb-4">
                Multiple payment gateways with auto-reconciliation, payment reminders, 
                and fraud protection.
              </p>
              <ul className="space-y-1 text-sm text-gray-600">
                <li>• COD and online payments</li>
                <li>• Stripe, PayPal, PayHere integration</li>
                <li>• Auto payment reconciliation</li>
                <li>• Payment reminders via WhatsApp</li>
              </ul>
            </div>

            {/* Customer CRM */}
            <div className="card p-6 hover:shadow-medium transition-shadow">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Customer CRM</h3>
              <p className="text-gray-600 mb-4">
                Auto-generated customer profiles with smart segmentation, loyalty points, 
                and activity tracking.
              </p>
              <ul className="space-y-1 text-sm text-gray-600">
                <li>• Auto-profile creation</li>
                <li>• Smart segmentation</li>
                <li>• Loyalty points system</li>
                <li>• Activity timeline</li>
              </ul>
            </div>

            {/* Analytics & Reports */}
            <div className="card p-6 hover:shadow-medium transition-shadow">
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
                <BarChart3 className="w-6 h-6 text-indigo-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Analytics & Reports</h3>
              <p className="text-gray-600 mb-4">
                Comprehensive analytics dashboard with sales reports, inventory insights, 
                and performance metrics.
              </p>
              <ul className="space-y-1 text-sm text-gray-600">
                <li>• Sales analytics dashboard</li>
                <li>• Inventory aging reports</li>
                <li>• Courier performance metrics</li>
                <li>• Customer lifetime value</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="container-responsive text-center">
          <h2 className="text-4xl font-bold text-white mb-4">
            Ready to automate your commerce?
          </h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Join thousands of businesses using SmartStore AI to streamline their operations 
            and boost sales across all channels.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/signup">
              <Button size="lg" variant="secondary" className="text-lg px-8 py-4">
                Start Free Trial
              </Button>
            </Link>
            <Link href="/contact">
              <Button size="lg" variant="outline" className="text-lg px-8 py-4 border-white text-white hover:bg-white hover:text-blue-600">
                Contact Sales
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container-responsive">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold">SmartStore AI</span>
              </div>
              <p className="text-gray-400">
                AI-powered commerce automation platform for modern businesses.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="#features" className="hover:text-white transition-colors">Features</Link></li>
                <li><Link href="#pricing" className="hover:text-white transition-colors">Pricing</Link></li>
                <li><Link href="/integrations" className="hover:text-white transition-colors">Integrations</Link></li>
                <li><Link href="/api" className="hover:text-white transition-colors">API</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/about" className="hover:text-white transition-colors">About</Link></li>
                <li><Link href="/blog" className="hover:text-white transition-colors">Blog</Link></li>
                <li><Link href="/careers" className="hover:text-white transition-colors">Careers</Link></li>
                <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Support</h3>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/help" className="hover:text-white transition-colors">Help Center</Link></li>
                <li><Link href="/docs" className="hover:text-white transition-colors">Documentation</Link></li>
                <li><Link href="/status" className="hover:text-white transition-colors">Status</Link></li>
                <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2024 SmartStore AI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
} 