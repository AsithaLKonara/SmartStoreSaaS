import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Bot, MapPin, Briefcase, Clock, Users, Heart, Zap } from 'lucide-react';

export default function CareersPage() {
  const openPositions = [
    {
      title: 'Senior Full Stack Developer',
      department: 'Engineering',
      location: 'Remote',
      type: 'Full-time',
      description: 'We\'re looking for an experienced full-stack developer to join our engineering team.'
    },
    {
      title: 'Product Designer',
      department: 'Design',
      location: 'Remote',
      type: 'Full-time',
      description: 'Help shape the future of commerce automation with beautiful, intuitive designs.'
    },
    {
      title: 'DevOps Engineer',
      department: 'Engineering',
      location: 'Remote',
      type: 'Full-time',
      description: 'Build and maintain our infrastructure to ensure reliability and scalability.'
    },
    {
      title: 'Customer Success Manager',
      department: 'Customer Success',
      location: 'Remote',
      type: 'Full-time',
      description: 'Help our customers succeed and get the most out of SmartStore AI.'
    },
    {
      title: 'Marketing Manager',
      department: 'Marketing',
      location: 'Remote',
      type: 'Full-time',
      description: 'Drive growth and brand awareness through strategic marketing initiatives.'
    },
    {
      title: 'AI/ML Engineer',
      department: 'Engineering',
      location: 'Remote',
      type: 'Full-time',
      description: 'Develop and improve our AI-powered features and machine learning models.'
    }
  ];

  const benefits = [
    { icon: Users, title: 'Remote First', description: 'Work from anywhere in the world' },
    { icon: Heart, title: 'Health & Wellness', description: 'Comprehensive health insurance' },
    { icon: Zap, title: 'Learning Budget', description: 'Annual budget for courses and conferences' },
    { icon: Briefcase, title: 'Flexible Hours', description: 'Work when you\'re most productive' }
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
            Join Our Team
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
            We're building the future of commerce automation. Join us in empowering businesses worldwide.
          </p>
        </section>

        {/* Benefits Section */}
        <section className="bg-white dark:bg-gray-800 py-16">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white text-center mb-12">
              Why Work With Us
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {benefits.map((benefit, index) => {
                const Icon = benefit.icon;
                return (
                  <div key={index} className="text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full mb-4">
                      <Icon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                      {benefit.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      {benefit.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Open Positions */}
        <section className="container mx-auto px-4 py-20">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-12">
            Open Positions
          </h2>
          <div className="space-y-4">
            {openPositions.map((position, index) => (
              <div
                key={index}
                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                      {position.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      {position.description}
                    </p>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex items-center space-x-1">
                        <Briefcase className="w-4 h-4" />
                        <span>{position.department}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <MapPin className="w-4 h-4" />
                        <span>{position.location}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Clock className="w-4 h-4" />
                        <span>{position.type}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 md:mt-0 md:ml-6">
                    <Button size="lg">
                      Apply Now
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="container mx-auto px-4 py-20">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-12 text-center text-white">
            <h2 className="text-3xl font-bold mb-4">Don't See a Role That Fits?</h2>
            <p className="text-blue-100 mb-8 max-w-2xl mx-auto">
              We're always looking for talented individuals. Send us your resume and we'll keep you in mind for future opportunities.
            </p>
            <Link href="/contact">
              <Button variant="secondary" size="lg">
                Get in Touch
              </Button>
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}

