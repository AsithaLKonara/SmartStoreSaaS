import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Bot, Users, Target, Zap, Globe } from 'lucide-react';

export default function AboutPage() {
  const values = [
    {
      icon: Target,
      title: 'Mission-Driven',
      description: 'Empowering businesses to succeed in the digital commerce landscape'
    },
    {
      icon: Zap,
      title: 'Innovation',
      description: 'Constantly pushing boundaries with cutting-edge AI technology'
    },
    {
      icon: Users,
      title: 'Customer-First',
      description: 'Your success is our success - we put you at the center of everything'
    },
    {
      icon: Globe,
      title: 'Global Reach',
      description: 'Supporting businesses worldwide with multi-channel solutions'
    }
  ];

  const stats = [
    { number: '10,000+', label: 'Active Users' },
    { number: '50+', label: 'Countries' },
    { number: '1M+', label: 'Orders Processed' },
    { number: '99.9%', label: 'Uptime' }
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
      <main>
        {/* Hero Section */}
        <section className="container mx-auto px-4 py-20 text-center">
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-6">
            About SmartStore AI
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
            We're building the future of commerce automation, empowering businesses to thrive in the digital age with AI-powered solutions.
          </p>
        </section>

        {/* Stats Section */}
        <section className="bg-white dark:bg-gray-800 py-12">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {stats.map((stat, index) => (
                <div key={index} className="text-center">
                  <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                    {stat.number}
                  </div>
                  <div className="text-gray-600 dark:text-gray-400">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Story Section */}
        <section className="container mx-auto px-4 py-20">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
              Our Story
            </h2>
            <div className="space-y-4 text-gray-600 dark:text-gray-400 leading-relaxed">
              <p>
                SmartStore AI was founded with a simple mission: to make commerce automation accessible to businesses of all sizes. We recognized that the future of retail lies in seamless, multi-channel experiences powered by intelligent automation.
              </p>
              <p>
                Starting as a small team of passionate developers and entrepreneurs, we've grown into a platform trusted by thousands of businesses worldwide. Our journey has been driven by a commitment to innovation, customer success, and the belief that technology should empower, not complicate.
              </p>
              <p>
                Today, SmartStore AI helps businesses automate their operations across WhatsApp, Facebook, Instagram, websites, and marketplaces - all from a single, unified platform. We're proud to be at the forefront of the AI-powered commerce revolution.
              </p>
            </div>
          </div>
        </section>

        {/* Values Section */}
        <section className="bg-white dark:bg-gray-800 py-20">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white text-center mb-12">
              Our Values
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {values.map((value, index) => {
                const Icon = value.icon;
                return (
                  <div key={index} className="text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full mb-4">
                      <Icon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                      {value.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      {value.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="container mx-auto px-4 py-20">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-12 text-center text-white">
            <h2 className="text-3xl font-bold mb-4">Join Us on This Journey</h2>
            <p className="text-blue-100 mb-8 max-w-2xl mx-auto">
              Whether you're a business owner looking to automate your operations or a talented individual looking to make an impact, we'd love to have you on board.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/auth/signup">
                <Button variant="secondary" size="lg">
                  Get Started
                </Button>
              </Link>
              <Link href="/careers">
                <Button variant="outline" size="lg" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                  View Careers
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

