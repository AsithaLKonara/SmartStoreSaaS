import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { QueryProvider } from '@/components/providers/QueryProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SmartStore AI - AI-Powered Commerce Automation',
  description: 'An AI-powered multi-channel commerce automation platform for social sellers, chat-first businesses, and omnichannel retailers.',
  keywords: 'e-commerce, AI, chatbot, WhatsApp, automation, multi-channel, retail',
  authors: [{ name: 'SmartStore AI Team' }],
  creator: 'SmartStore AI',
  publisher: 'SmartStore AI',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  openGraph: {
    title: 'SmartStore AI - AI-Powered Commerce Automation',
    description: 'An AI-powered multi-channel commerce automation platform for social sellers, chat-first businesses, and omnichannel retailers.',
    url: 'https://smartstore-ai.com',
    siteName: 'SmartStore AI',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'SmartStore AI - AI-Powered Commerce Automation',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SmartStore AI - AI-Powered Commerce Automation',
    description: 'An AI-powered multi-channel commerce automation platform for social sellers, chat-first businesses, and omnichannel retailers.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'your-google-verification-code',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} h-full bg-gray-50`}>
        <QueryProvider>
          <AuthProvider>
            {children}
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#363636',
                  color: '#fff',
                },
                success: {
                  duration: 3000,
                  iconTheme: {
                    primary: '#22c55e',
                    secondary: '#fff',
                  },
                },
                error: {
                  duration: 5000,
                  iconTheme: {
                    primary: '#ef4444',
                    secondary: '#fff',
                  },
                },
              }}
            />
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
} 