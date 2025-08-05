export type Theme = 'light' | 'dark' | 'system';

export interface ThemeConfig {
  theme: Theme;
  isDark: boolean;
  systemPrefersDark: boolean;
}

export class DarkModeService {
  private static instance: DarkModeService;
  private listeners: Set<(config: ThemeConfig) => void> = new Set();

  private constructor() {
    // Initialize theme on client side
    if (typeof window !== 'undefined') {
      this.initializeTheme();
    }
  }

  static getInstance(): DarkModeService {
    if (!DarkModeService.instance) {
      DarkModeService.instance = new DarkModeService();
    }
    return DarkModeService.instance;
  }

  private initializeTheme(): void {
    // Check for saved theme preference or default to system
    const savedTheme = this.getStoredTheme();
    const systemPrefersDark = this.getSystemPreference();
    
    if (savedTheme) {
      this.applyTheme(savedTheme);
    } else {
      this.applyTheme('system');
    }

    // Listen for system theme changes
    this.setupSystemThemeListener();
  }

  private getStoredTheme(): Theme | null {
    if (typeof window === 'undefined') return null;
    
    try {
      const stored = localStorage.getItem('smartstore-theme');
      return stored as Theme || null;
    } catch {
      return null;
    }
  }

  private setStoredTheme(theme: Theme): void {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem('smartstore-theme', theme);
    } catch {
      // Handle localStorage errors
    }
  }

  private getSystemPreference(): boolean {
    if (typeof window === 'undefined') return false;
    
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  private setupSystemThemeListener(): void {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = () => {
      const currentTheme = this.getStoredTheme();
      if (currentTheme === 'system') {
        this.applyTheme('system');
      }
    };

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handleChange);
    }
  }

  private applyTheme(theme: Theme): void {
    if (typeof window === 'undefined') return;

    const root = document.documentElement;
    const systemPrefersDark = this.getSystemPreference();
    
    let isDark = false;

    switch (theme) {
      case 'dark':
        isDark = true;
        break;
      case 'light':
        isDark = false;
        break;
      case 'system':
        isDark = systemPrefersDark;
        break;
    }

    // Apply theme classes
    if (isDark) {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }

    // Set data attribute for CSS custom properties
    root.setAttribute('data-theme', isDark ? 'dark' : 'light');

    // Notify listeners
    this.notifyListeners({
      theme,
      isDark,
      systemPrefersDark
    });
  }

  private notifyListeners(config: ThemeConfig): void {
    this.listeners.forEach(listener => {
      try {
        listener(config);
      } catch (error) {
        console.error('Theme listener error:', error);
      }
    });
  }

  // Public methods
  getTheme(): Theme {
    return this.getStoredTheme() || 'system';
  }

  setTheme(theme: Theme): void {
    this.setStoredTheme(theme);
    this.applyTheme(theme);
  }

  toggleTheme(): void {
    const currentTheme = this.getTheme();
    const newTheme: Theme = currentTheme === 'dark' ? 'light' : 'dark';
    this.setTheme(newTheme);
  }

  isDark(): boolean {
    const theme = this.getTheme();
    if (theme === 'system') {
      return this.getSystemPreference();
    }
    return theme === 'dark';
  }

  getConfig(): ThemeConfig {
    const theme = this.getTheme();
    const systemPrefersDark = this.getSystemPreference();
    const isDark = this.isDark();

    return {
      theme,
      isDark,
      systemPrefersDark
    };
  }

  subscribe(listener: (config: ThemeConfig) => void): () => void {
    this.listeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  // Utility methods for CSS custom properties
  getCSSVariables(): Record<string, string> {
    const isDark = this.isDark();
    
    if (isDark) {
      return {
        '--bg-primary': '#1a1a1a',
        '--bg-secondary': '#2d2d2d',
        '--bg-tertiary': '#404040',
        '--text-primary': '#ffffff',
        '--text-secondary': '#e5e5e5',
        '--text-muted': '#a0a0a0',
        '--border-primary': '#404040',
        '--border-secondary': '#525252',
        '--accent-primary': '#3b82f6',
        '--accent-secondary': '#1d4ed8',
        '--success': '#10b981',
        '--warning': '#f59e0b',
        '--error': '#ef4444',
        '--shadow': '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
        '--shadow-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.4)'
      };
    } else {
      return {
        '--bg-primary': '#ffffff',
        '--bg-secondary': '#f9fafb',
        '--bg-tertiary': '#f3f4f6',
        '--text-primary': '#111827',
        '--text-secondary': '#374151',
        '--text-muted': '#6b7280',
        '--border-primary': '#d1d5db',
        '--border-secondary': '#e5e7eb',
        '--accent-primary': '#3b82f6',
        '--accent-secondary': '#1d4ed8',
        '--success': '#10b981',
        '--warning': '#f59e0b',
        '--error': '#ef4444',
        '--shadow': '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        '--shadow-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
      };
    }
  }

  applyCSSVariables(): void {
    if (typeof window === 'undefined') return;

    const variables = this.getCSSVariables();
    const root = document.documentElement;

    Object.entries(variables).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
  }

  // Animation utilities
  enableTransitions(): void {
    if (typeof window === 'undefined') return;

    const root = document.documentElement;
    root.style.setProperty('--transition-duration', '0.2s');
    root.style.setProperty('--transition-timing', 'ease-in-out');
  }

  disableTransitions(): void {
    if (typeof window === 'undefined') return;

    const root = document.documentElement;
    root.style.setProperty('--transition-duration', '0s');
  }

  // Theme switching with animation
  switchThemeWithAnimation(newTheme: Theme): Promise<void> {
    return new Promise((resolve) => {
      this.disableTransitions();
      
      // Force a reflow
      document.documentElement.offsetHeight;
      
      this.setTheme(newTheme);
      this.applyCSSVariables();
      
      // Re-enable transitions after a short delay
      setTimeout(() => {
        this.enableTransitions();
        resolve();
      }, 10);
    });
  }

  // Auto-switch based on time
  enableAutoSwitch(): void {
    if (typeof window === 'undefined') return;

    const now = new Date();
    const hour = now.getHours();
    
    // Switch to dark mode between 6 PM and 6 AM
    const shouldBeDark = hour >= 18 || hour < 6;
    const currentTheme = this.getTheme();
    
    if (currentTheme === 'system') {
      // Only auto-switch if user hasn't set a preference
      const newTheme: Theme = shouldBeDark ? 'dark' : 'light';
      this.setTheme(newTheme);
    }
  }

  // Accessibility features
  enableHighContrast(): void {
    if (typeof window === 'undefined') return;

    const root = document.documentElement;
    root.classList.add('high-contrast');
  }

  disableHighContrast(): void {
    if (typeof window === 'undefined') return;

    const root = document.documentElement;
    root.classList.remove('high-contrast');
  }

  // Theme export/import
  exportTheme(): string {
    const config = this.getConfig();
    return JSON.stringify(config);
  }

  importTheme(configString: string): boolean {
    try {
      const config = JSON.parse(configString);
      if (config.theme && ['light', 'dark', 'system'].includes(config.theme)) {
        this.setTheme(config.theme);
        return true;
      }
    } catch {
      // Invalid JSON
    }
    return false;
  }
} 