'use client';

import { createContext, useContext, useEffect, ReactNode } from 'react';
import { useDarkMode } from '@/hooks/useDarkMode';
import { Theme, ThemeConfig } from '@/lib/theme/darkModeService';

interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  systemPrefersDark: boolean;
  isLoaded: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  switchThemeWithAnimation: (theme: Theme) => Promise<void>;
  enableHighContrast: () => void;
  disableHighContrast: () => void;
  enableAutoSwitch: () => void;
  exportTheme: () => string;
  importTheme: (configString: string) => boolean;
  isSystem: boolean;
  isLight: boolean;
  isDarkMode: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: Theme;
}

export function ThemeProvider({ children, defaultTheme = 'system' }: ThemeProviderProps) {
  const darkMode = useDarkMode();

  useEffect(() => {
    // Set default theme if provided and no theme is currently set
    if (defaultTheme && darkMode.isLoaded && darkMode.theme === 'system') {
      darkMode.setTheme(defaultTheme);
    }
  }, [defaultTheme, darkMode.isLoaded, darkMode.theme, darkMode.setTheme]);

  useEffect(() => {
    // Apply theme classes to body for global styling
    const body = document.body;
    if (darkMode.isDark) {
      body.classList.add('dark');
      body.classList.remove('light');
    } else {
      body.classList.add('light');
      body.classList.remove('dark');
    }
  }, [darkMode.isDark]);

  // Prevent flash of unstyled content
  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'theme-style';
    style.innerHTML = `
      html { visibility: hidden; }
      html.theme-loaded { visibility: visible; }
    `;
    
    // Check if style already exists
    const existingStyle = document.getElementById('theme-style');
    if (!existingStyle) {
      document.head.appendChild(style);
    }

    if (darkMode.isLoaded) {
      document.documentElement.classList.add('theme-loaded');
    }

    return () => {
      // Only remove if it exists and was created by this component
      const styleToRemove = document.getElementById('theme-style');
      if (styleToRemove && styleToRemove.parentNode) {
        styleToRemove.parentNode.removeChild(styleToRemove);
      }
    };
  }, [darkMode.isLoaded]);

  return (
    <ThemeContext.Provider value={darkMode}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

// Theme toggle button component
export function ThemeToggle() {
  const { isDark, toggleTheme, isLoaded } = useTheme();

  if (!isLoaded) {
    return (
      <button
        className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center"
        disabled
      >
        <div className="w-5 h-5 bg-gray-400 rounded animate-pulse" />
      </button>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center justify-center"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? (
        <svg
          className="w-5 h-5 text-yellow-500"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
            clipRule="evenodd"
          />
        </svg>
      ) : (
        <svg
          className="w-5 h-5 text-gray-700"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
        </svg>
      )}
    </button>
  );
}

// Theme selector component
export function ThemeSelector() {
  const { theme, setTheme, isLoaded } = useTheme();

  if (!isLoaded) {
    return (
      <div className="flex space-x-2">
        <div className="w-8 h-8 bg-gray-200 rounded animate-pulse" />
        <div className="w-8 h-8 bg-gray-200 rounded animate-pulse" />
        <div className="w-8 h-8 bg-gray-200 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex space-x-2">
      <button
        onClick={() => setTheme('light')}
        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
          theme === 'light'
            ? 'bg-blue-500 text-white'
            : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
        }`}
        aria-label="Light mode"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      <button
        onClick={() => setTheme('dark')}
        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
          theme === 'dark'
            ? 'bg-blue-500 text-white'
            : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
        }`}
        aria-label="Dark mode"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
        </svg>
      </button>

      <button
        onClick={() => setTheme('system')}
        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
          theme === 'system'
            ? 'bg-blue-500 text-white'
            : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
        }`}
        aria-label="System mode"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </div>
  );
} 