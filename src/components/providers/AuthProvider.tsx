'use client';

import { SessionProvider } from 'next-auth/react';
import { ReactNode, useEffect } from 'react';

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Suppress CLIENT_FETCH_ERROR in console if session is still valid
 */
function suppressNonCriticalErrors() {
  if (typeof window === 'undefined') return;

  const originalError = console.error;
  console.error = (...args: any[]) => {
    const message = args[0]?.toString() || '';
    
    // Suppress CLIENT_FETCH_ERROR if it's non-critical
    if (message.includes('[next-auth][error][CLIENT_FETCH_ERROR]')) {
      // Only log in development, suppress in production
      if (process.env.NODE_ENV === 'development') {
        originalError.apply(console, args);
      }
      return;
    }
    
    // Log all other errors normally
    originalError.apply(console, args);
  };

  return () => {
    console.error = originalError;
  };
}

export function AuthProvider({ children }: AuthProviderProps) {
  useEffect(() => {
    // Suppress non-critical NextAuth errors
    const cleanup = suppressNonCriticalErrors();
    return cleanup;
  }, []);

  return (
    <SessionProvider
      refetchInterval={300} // Refetch session every 5 minutes (reduced frequency)
      refetchOnWindowFocus={false} // Don't refetch on window focus (reduces errors)
      refetchWhenOffline={false} // Don't refetch when offline
    >
      {children}
    </SessionProvider>
  );
} 