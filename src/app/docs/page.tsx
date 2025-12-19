import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { 
  BookOpen, 
  Code, 
  Zap, 
  Globe,
  Bot,
  FileText,
  ChevronRight
} from 'lucide-react';

export default function DocsPage() {
  const sections = [
    {
      title: 'Getting Started',
      icon: Zap,
      description: 'Quick start guides and tutorials',
      links: [
        { title: 'Introduction', href: '#' },
        { title: 'Installation', href: '#' },
        { title: 'First Steps', href: '#' },
        { title: 'Quick Tour', href: '#' }
      ]
    },
    {
      title: 'API Reference',
      icon: Code,
      description: 'Complete API documentation',
      links: [
        { title: 'Authentication', href: '#' },
        { title: 'Products API', href: '#' },
        { title: 'Orders API', href: '#' },
        { title: 'Webhooks', href: '#' }
      ]
    },
    {
      title: 'Integrations',
      icon: Globe,
      description: 'Connect with external services',
      links: [
        { title: 'Shopify', href: '#' },
        { title: 'WhatsApp', href: '#' },
        { title: 'Facebook', href: '#' },
        { title: 'Stripe', href: '#' }
      ]
    },
    {
      title: 'Guides',
      icon: BookOpen,
      description: 'Step-by-step tutorials',
      links: [
        { title: 'Product Management', href: '#' },
        { title: 'Order Processing', href: '#' },
        { title: 'Analytics Setup', href: '#' },
        { title: 'Multi-channel Setup', href: '#' }
      ]
    }
  ];

  const quickLinks = [
    { title: 'API Authentication', href: '#', category: 'API' },
    { title: 'Webhook Setup', href: '#', category: 'API' },
    { title: 'Shopify Integration', href: '#', category: 'Integration' },
    { title: 'WhatsApp Configuration', href: '#', category: 'Integration' },
    { title: 'Product Creation', href: '#', category: 'Guide' },
    { title: 'Order Management', href: '#', category: 'Guide' }
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900 dark:text-white">SmartStore AI</span>
            </Link>
            <div className="flex items-center space-x-4">
              <Link href="/auth/signin">
                <Button variant="outline" size="sm">Sign In</Button>
              </Link>
              <Link href="/auth/signup">
                <Button size="sm">Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full mb-4">
            <FileText className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Documentation
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Comprehensive guides and API reference for SmartStore AI platform
          </p>
        </div>

        {/* Quick Links */}
        <div className="mb-12">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
            Quick Links
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {quickLinks.map((link, index) => (
              <Link
                key={index}
                href={link.href}
                className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                      {link.category}
                    </span>
                    <h3 className="font-medium text-gray-900 dark:text-white mt-1 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                      {link.title}
                    </h3>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Sections */}
        <div className="mb-12">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
            Documentation Sections
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {sections.map((section, index) => {
              const Icon = section.icon;
              return (
                <div
                  key={index}
                  className="p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-center space-x-4 mb-4">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                      <Icon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                        {section.title}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {section.description}
                      </p>
                    </div>
                  </div>
                  <ul className="space-y-2">
                    {section.links.map((link, linkIndex) => (
                      <li key={linkIndex}>
                        <Link
                          href={link.href}
                          className="flex items-center text-blue-600 dark:text-blue-400 hover:underline text-sm"
                        >
                          {link.title}
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>

        {/* API Status */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-8 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2">API Status</h2>
              <p className="text-blue-100">
                All systems operational
              </p>
            </div>
            <Link href="/status">
              <Button variant="secondary" size="lg">
                View Status
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

