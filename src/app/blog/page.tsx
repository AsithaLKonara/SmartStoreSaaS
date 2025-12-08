import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Bot, Calendar, User, ArrowRight } from 'lucide-react';

export default function BlogPage() {
  const posts = [
    {
      title: 'Getting Started with Multi-Channel Commerce',
      excerpt: 'Learn how to set up your first multi-channel store and start selling across WhatsApp, Facebook, and more.',
      author: 'SmartStore Team',
      date: 'December 20, 2024',
      category: 'Getting Started',
      readTime: '5 min read'
    },
    {
      title: 'AI-Powered Inventory Management Best Practices',
      excerpt: 'Discover how to leverage AI for intelligent inventory tracking and optimization.',
      author: 'SmartStore Team',
      date: 'December 15, 2024',
      category: 'Features',
      readTime: '7 min read'
    },
    {
      title: 'WhatsApp Commerce: The Future of Customer Engagement',
      excerpt: 'Explore how WhatsApp is revolutionizing customer communication and sales.',
      author: 'SmartStore Team',
      date: 'December 10, 2024',
      category: 'E-commerce',
      readTime: '6 min read'
    },
    {
      title: 'Automating Order Fulfillment: A Complete Guide',
      excerpt: 'Step-by-step guide to automating your order processing and fulfillment workflow.',
      author: 'SmartStore Team',
      date: 'December 5, 2024',
      category: 'Automation',
      readTime: '8 min read'
    },
    {
      title: 'Understanding Analytics: Key Metrics for E-commerce Success',
      excerpt: 'Learn which metrics matter most for growing your online business.',
      author: 'SmartStore Team',
      date: 'November 30, 2024',
      category: 'Analytics',
      readTime: '6 min read'
    },
    {
      title: 'Integration Spotlight: Connecting Shopify to SmartStore AI',
      excerpt: 'A detailed walkthrough of setting up your Shopify integration.',
      author: 'SmartStore Team',
      date: 'November 25, 2024',
      category: 'Integrations',
      readTime: '5 min read'
    }
  ];

  const categories = ['All', 'Getting Started', 'Features', 'E-commerce', 'Automation', 'Analytics', 'Integrations'];

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
            Blog
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            Insights, guides, and updates from the SmartStore AI team
          </p>
        </div>

        {/* Categories */}
        <div className="flex flex-wrap gap-2 mb-12 justify-center">
          {categories.map((category) => (
            <button
              key={category}
              className="px-4 py-2 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-500 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              {category}
            </button>
          ))}
        </div>

        {/* Blog Posts */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {posts.map((post, index) => (
            <article
              key={index}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-shadow"
            >
              <div className="h-48 bg-gradient-to-br from-blue-500 to-purple-500"></div>
              <div className="p-6">
                <div className="flex items-center space-x-2 mb-3">
                  <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs font-medium rounded-full">
                    {post.category}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {post.readTime}
                  </span>
                </div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  {post.title}
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                  {post.excerpt}
                </p>
                <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-4">
                  <div className="flex items-center space-x-2">
                    <User className="w-4 h-4" />
                    <span>{post.author}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4" />
                    <span>{post.date}</span>
                  </div>
                </div>
                <Link
                  href="#"
                  className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:underline font-medium"
                >
                  Read more
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Link>
              </div>
            </article>
          ))}
        </div>

        {/* Newsletter CTA */}
        <div className="mt-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-8 text-center text-white">
          <h2 className="text-2xl font-bold mb-4">Stay Updated</h2>
          <p className="text-blue-100 mb-6">
            Subscribe to our newsletter for the latest updates, tips, and insights
          </p>
          <div className="max-w-md mx-auto flex gap-2">
            <input
              type="email"
              placeholder="Enter your email"
              className="flex-1 px-4 py-2 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-white"
            />
            <Button variant="secondary" size="lg">
              Subscribe
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}

