import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { 
  Search, 
  BookOpen, 
  MessageCircle, 
  Video, 
  FileText,
  HelpCircle,
  Mail,
  Bot
} from 'lucide-react';

export default function HelpPage() {
  const categories = [
    {
      title: 'Getting Started',
      icon: BookOpen,
      description: 'Learn the basics of SmartStore AI',
      articles: [
        'Creating your first product',
        'Setting up integrations',
        'Managing orders',
        'Understanding analytics'
      ]
    },
    {
      title: 'Account & Billing',
      icon: FileText,
      description: 'Manage your account and subscription',
      articles: [
        'Updating your profile',
        'Changing your plan',
        'Payment methods',
        'Billing history'
      ]
    },
    {
      title: 'Integrations',
      icon: Bot,
      description: 'Connect with your favorite platforms',
      articles: [
        'Shopify integration',
        'WhatsApp setup',
        'Facebook integration',
        'API documentation'
      ]
    },
    {
      title: 'Troubleshooting',
      icon: HelpCircle,
      description: 'Common issues and solutions',
      articles: [
        'Sync issues',
        'Payment problems',
        'Order processing',
        'Performance optimization'
      ]
    }
  ];

  const popularArticles = [
    'How to create your first product',
    'Setting up WhatsApp messaging',
    'Understanding order statuses',
    'Configuring payment methods',
    'Setting up inventory tracking'
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
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            How can we help you?
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-8">
            Find answers to common questions and learn how to get the most out of SmartStore AI
          </p>
          
          {/* Search Bar */}
          <div className="max-w-2xl mx-auto">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search for help articles..."
                className="w-full pl-12 pr-4 py-4 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Popular Articles */}
        <div className="mb-12">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
            Popular Articles
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {popularArticles.map((article, index) => (
              <Link
                key={index}
                href="#"
                className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition-colors"
              >
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                  {article}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Learn more →
                </p>
              </Link>
            ))}
          </div>
        </div>

        {/* Categories */}
        <div className="mb-12">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
            Browse by Category
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {categories.map((category, index) => {
              const Icon = category.icon;
              return (
                <div
                  key={index}
                  className="p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex items-center space-x-4 mb-4">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                      <Icon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                        {category.title}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {category.description}
                      </p>
                    </div>
                  </div>
                  <ul className="space-y-2">
                    {category.articles.map((article, articleIndex) => (
                      <li key={articleIndex}>
                        <Link
                          href="#"
                          className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
                        >
                          {article}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>

        {/* Contact Support */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-8 text-white text-center">
          <MessageCircle className="w-12 h-12 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-4">Still need help?</h2>
          <p className="text-blue-100 mb-6">
            Our support team is here to help you 24/7
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/contact">
              <Button variant="secondary" size="lg">
                <Mail className="w-4 h-4 mr-2" />
                Contact Support
              </Button>
            </Link>
            <Button variant="outline" size="lg" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
              <Video className="w-4 h-4 mr-2" />
              Schedule a Call
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}

