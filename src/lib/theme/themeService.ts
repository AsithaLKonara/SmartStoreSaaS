export interface ThemeConfig {
  mode: 'light' | 'dark' | 'system';
  primaryColor: string;
  accentColor: string;
  borderRadius: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  fontSize: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl';
  fontFamily: 'sans' | 'serif' | 'mono';
  animationSpeed: 'slow' | 'normal' | 'fast';
  reducedMotion: boolean;
  highContrast: boolean;
}

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  config: ThemeConfig;
  isDefault?: boolean;
}

export class ThemeService {
  private static instance: ThemeService;
  private defaultConfig: ThemeConfig = {
    mode: 'system',
    primaryColor: '#3b82f6',
    accentColor: '#f59e0b',
    borderRadius: 'md',
    fontSize: 'base',
    fontFamily: 'sans',
    animationSpeed: 'normal',
    reducedMotion: false,
    highContrast: false
  };

  private presets: ThemePreset[] = [
    {
      id: 'default',
      name: 'Default',
      description: 'Clean and modern default theme',
      config: this.defaultConfig,
      isDefault: true
    },
    {
      id: 'dark',
      name: 'Dark Mode',
      description: 'Elegant dark theme for low-light environments',
      config: {
        ...this.defaultConfig,
        mode: 'dark',
        primaryColor: '#60a5fa',
        accentColor: '#fbbf24'
      }
    },
    {
      id: 'light',
      name: 'Light Mode',
      description: 'Bright and clean light theme',
      config: {
        ...this.defaultConfig,
        mode: 'light',
        primaryColor: '#2563eb',
        accentColor: '#d97706'
      }
    },
    {
      id: 'high-contrast',
      name: 'High Contrast',
      description: 'High contrast theme for accessibility',
      config: {
        ...this.defaultConfig,
        mode: 'light',
        primaryColor: '#000000',
        accentColor: '#ffffff',
        highContrast: true
      }
    },
    {
      id: 'minimal',
      name: 'Minimal',
      description: 'Minimalist theme with subtle colors',
      config: {
        ...this.defaultConfig,
        primaryColor: '#6b7280',
        accentColor: '#9ca3af',
        borderRadius: 'sm',
        fontSize: 'sm'
      }
    }
  ];

  constructor() {
    if (ThemeService.instance) {
      return ThemeService.instance;
    }
    ThemeService.instance = this;
  }

  static getInstance(): ThemeService {
    if (!ThemeService.instance) {
      ThemeService.instance = new ThemeService();
    }
    return ThemeService.instance;
  }

  getDefaultConfig(): ThemeConfig {
    return { ...this.defaultConfig };
  }

  getPresets(): ThemePreset[] {
    return [...this.presets];
  }

  getPreset(presetId: string): ThemePreset | null {
    return this.presets.find(preset => preset.id === presetId) || null;
  }

  addPreset(preset: ThemePreset): void {
    this.presets.push(preset);
  }

  removePreset(presetId: string): void {
    this.presets = this.presets.filter(preset => preset.id !== presetId);
  }

  getSystemTheme(): 'light' | 'dark' {
    if (typeof window === 'undefined') return 'light';
    
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  getEffectiveTheme(config: ThemeConfig): 'light' | 'dark' {
    if (config.mode === 'system') {
      return this.getSystemTheme();
    }
    return config.mode;
  }

  applyTheme(config: ThemeConfig): void {
    if (typeof window === 'undefined') return;

    const effectiveTheme = this.getEffectiveTheme(config);
    const root = document.documentElement;

    // Apply theme mode
    root.classList.remove('light', 'dark');
    root.classList.add(effectiveTheme);

    // Apply custom properties
    root.style.setProperty('--color-primary', config.primaryColor);
    root.style.setProperty('--color-accent', config.accentColor);
    root.style.setProperty('--border-radius', this.getBorderRadiusValue(config.borderRadius));
    root.style.setProperty('--font-size', this.getFontSizeValue(config.fontSize));
    root.style.setProperty('--font-family', this.getFontFamilyValue(config.fontFamily));
    root.style.setProperty('--animation-speed', this.getAnimationSpeedValue(config.animationSpeed));

    // Apply accessibility settings
    if (config.reducedMotion) {
      root.style.setProperty('--reduced-motion', 'reduce');
    } else {
      root.style.setProperty('--reduced-motion', 'no-preference');
    }

    if (config.highContrast) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }

    // Save to localStorage
    this.saveTheme(config);
  }

  loadTheme(): ThemeConfig {
    if (typeof window === 'undefined') return this.defaultConfig;

    try {
      const saved = localStorage.getItem('smartstore-theme');
      if (saved) {
        const config = JSON.parse(saved);
        return { ...this.defaultConfig, ...config };
      }
    } catch (error) {
      console.warn('Failed to load theme from localStorage:', error);
    }

    return this.defaultConfig;
  }

  saveTheme(config: ThemeConfig): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem('smartstore-theme', JSON.stringify(config));
    } catch (error) {
      console.warn('Failed to save theme to localStorage:', error);
    }
  }

  resetTheme(): void {
    this.applyTheme(this.defaultConfig);
  }

  watchSystemTheme(callback: (theme: 'light' | 'dark') => void): () => void {
    if (typeof window === 'undefined') return () => {};

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      callback(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }

  generateThemeCSS(config: ThemeConfig): string {
    const effectiveTheme = this.getEffectiveTheme(config);
    const isDark = effectiveTheme === 'dark';

    return `
      :root {
        --color-primary: ${config.primaryColor};
        --color-accent: ${config.accentColor};
        --border-radius: ${this.getBorderRadiusValue(config.borderRadius)};
        --font-size: ${this.getFontSizeValue(config.fontSize)};
        --font-family: ${this.getFontFamilyValue(config.fontFamily)};
        --animation-speed: ${this.getAnimationSpeedValue(config.animationSpeed)};
        --reduced-motion: ${config.reducedMotion ? 'reduce' : 'no-preference'};
      }

      .dark {
        --bg-primary: #1f2937;
        --bg-secondary: #374151;
        --bg-tertiary: #4b5563;
        --text-primary: #f9fafb;
        --text-secondary: #d1d5db;
        --text-tertiary: #9ca3af;
        --border-color: #4b5563;
        --shadow-color: rgba(0, 0, 0, 0.3);
      }

      .light {
        --bg-primary: #ffffff;
        --bg-secondary: #f9fafb;
        --bg-tertiary: #f3f4f6;
        --text-primary: #111827;
        --text-secondary: #374151;
        --text-tertiary: #6b7280;
        --border-color: #e5e7eb;
        --shadow-color: rgba(0, 0, 0, 0.1);
      }

      .high-contrast {
        --bg-primary: #000000;
        --bg-secondary: #1a1a1a;
        --bg-tertiary: #333333;
        --text-primary: #ffffff;
        --text-secondary: #cccccc;
        --text-tertiary: #999999;
        --border-color: #ffffff;
        --shadow-color: rgba(255, 255, 255, 0.3);
      }

      * {
        transition: background-color var(--animation-speed), 
                    color var(--animation-speed), 
                    border-color var(--animation-speed);
      }

      @media (prefers-reduced-motion: reduce) {
        * {
          transition: none !important;
          animation: none !important;
        }
      }
    `;
  }

  private getBorderRadiusValue(borderRadius: string): string {
    const values = {
      none: '0',
      sm: '0.125rem',
      md: '0.375rem',
      lg: '0.5rem',
      xl: '0.75rem'
    };
    return values[borderRadius as keyof typeof values] || '0.375rem';
  }

  private getFontSizeValue(fontSize: string): string {
    const values = {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem'
    };
    return values[fontSize as keyof typeof values] || '1rem';
  }

  private getFontFamilyValue(fontFamily: string): string {
    const values = {
      sans: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
      serif: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
      mono: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace'
    };
    return values[fontFamily as keyof typeof values] || values.sans;
  }

  private getAnimationSpeedValue(animationSpeed: string): string {
    const values = {
      slow: '0.5s',
      normal: '0.3s',
      fast: '0.15s'
    };
    return values[animationSpeed as keyof typeof values] || '0.3s';
  }

  // Utility methods for theme-aware components
  isDarkMode(config: ThemeConfig): boolean {
    return this.getEffectiveTheme(config) === 'dark';
  }

  getContrastColor(backgroundColor: string): string {
    // Simple contrast calculation
    const hex = backgroundColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 128 ? '#000000' : '#ffffff';
  }

  generateColorPalette(baseColor: string): {
    primary: string;
    secondary: string;
    tertiary: string;
    accent: string;
  } {
    // Simple color palette generation
    return {
      primary: baseColor,
      secondary: this.adjustColor(baseColor, -20),
      tertiary: this.adjustColor(baseColor, -40),
      accent: this.adjustColor(baseColor, 20)
    };
  }

  private adjustColor(color: string, amount: number): string {
    const hex = color.replace('#', '');
    const r = Math.max(0, Math.min(255, parseInt(hex.substr(0, 2), 16) + amount));
    const g = Math.max(0, Math.min(255, parseInt(hex.substr(2, 2), 16) + amount));
    const b = Math.max(0, Math.min(255, parseInt(hex.substr(4, 2), 16) + amount));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }
} 