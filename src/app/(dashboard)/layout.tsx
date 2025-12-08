'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Menu, 
  X, 
  Bot, 
  ShoppingCart, 
  Users, 
  Truck, 
  Settings, 
  LogOut,
  Bell,
  Search,
  Home,
  Package2,
  Building2,
  DollarSign,
  Megaphone,
  MessageCircle,
  BarChart,
  Settings2,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { ThemeProvider, ThemeToggle } from '@/components/theme/ThemeProvider';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Products', href: '/products', icon: Package2 },
  { name: 'Orders', href: '/orders', icon: ShoppingCart },
  { name: 'Customers', href: '/customers', icon: Users },
  { name: 'Couriers', href: '/couriers', icon: Truck },
  { name: 'Warehouses', href: '/warehouses', icon: Building2 },
  { name: 'Expenses', href: '/expenses', icon: DollarSign },
  { name: 'Campaigns', href: '/campaigns', icon: Megaphone },
  { name: 'Chat', href: '/chat', icon: MessageCircle },
  { name: 'Reports', href: '/reports', icon: BarChart },
  { name: 'Integrations', href: '/integrations', icon: Settings },
  { name: 'Sync', href: '/sync', icon: RefreshCw },
  { name: 'Settings', href: '/settings', icon: Settings2 },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Redirect to sign in if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/auth/signin');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="loading-spinner w-8 h-8" />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="loading-spinner w-8 h-8" />
      </div>
    );
  }

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/' });
  };

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Mobile sidebar */}
        <div className={cn('sidebar md:hidden', sidebarOpen ? 'sidebar-open' : 'sidebar-closed')}>
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold text-gray-900 dark:text-white">SmartStore AI</span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <nav className="mt-4 px-4 space-y-2">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="nav-item"
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon className="w-5 h-5 mr-3" />
                {item.name}
              </Link>
            ))}
          </nav>
        </div>

        {/* Desktop sidebar */}
        <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
          <div className="flex flex-col flex-grow bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
            <div className="flex items-center p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <span className="text-lg font-bold text-gray-900 dark:text-white">SmartStore AI</span>
              </div>
            </div>
            <nav className="mt-4 flex-1 px-4 space-y-2">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="nav-item"
                >
                  <item.icon className="w-5 h-5 mr-3" />
                  {item.name}
                </Link>
              ))}
            </nav>
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <Button
                variant="outline"
                className="w-full"
                onClick={handleSignOut}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign out
              </Button>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="md:pl-64">
          {/* Top header */}
          <div className="sticky top-0 z-40 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
              <div className="flex items-center">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="md:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <Menu className="w-6 h-6" />
                </button>
                
                {/* Search */}
                <div className="ml-4 flex-1 max-w-lg">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      placeholder="Search..."
                      className="form-input pl-10 w-full"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                {/* Theme Toggle */}
                <ThemeToggle />

                {/* Notifications */}
                <button className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 relative">
                  <Bell className="w-6 h-6" />
                  <span className="absolute top-1 right-1 block h-2 w-2 rounded-full bg-red-400"></span>
                </button>

                {/* User menu */}
                <div className="flex items-center space-x-3">
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {session?.user?.name || 'User'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {session?.user?.email}
                    </p>
                  </div>
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-white">
                      {session?.user?.name?.charAt(0) || 'U'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Page content */}
          <main className="p-4 sm:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </ThemeProvider>
  );
} 