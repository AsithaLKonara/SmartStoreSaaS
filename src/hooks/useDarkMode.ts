'use client';

import { useState, useEffect, useCallback } from 'react';
import { DarkModeService, Theme, ThemeConfig } from '@/lib/theme/darkModeService';

export function useDarkMode() {
  const [config, setConfig] = useState<ThemeConfig>({
    theme: 'system',
    isDark: false,
    systemPrefersDark: false
  });
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const service = DarkModeService.getInstance();
    
    // Set initial state
    setConfig(service.getConfig());
    setIsLoaded(true);

    // Subscribe to theme changes
    const unsubscribe = service.subscribe((newConfig) => {
      setConfig(newConfig);
    });

    // Apply CSS variables
    service.applyCSSVariables();

    return unsubscribe;
  }, []);

  const setTheme = useCallback((theme: Theme) => {
    const service = DarkModeService.getInstance();
    service.setTheme(theme);
  }, []);

  const toggleTheme = useCallback(() => {
    const service = DarkModeService.getInstance();
    service.toggleTheme();
  }, []);

  const switchThemeWithAnimation = useCallback(async (theme: Theme) => {
    const service = DarkModeService.getInstance();
    await service.switchThemeWithAnimation(theme);
  }, []);

  const enableHighContrast = useCallback(() => {
    const service = DarkModeService.getInstance();
    service.enableHighContrast();
  }, []);

  const disableHighContrast = useCallback(() => {
    const service = DarkModeService.getInstance();
    service.disableHighContrast();
  }, []);

  const enableAutoSwitch = useCallback(() => {
    const service = DarkModeService.getInstance();
    service.enableAutoSwitch();
  }, []);

  const exportTheme = useCallback(() => {
    const service = DarkModeService.getInstance();
    return service.exportTheme();
  }, []);

  const importTheme = useCallback((configString: string) => {
    const service = DarkModeService.getInstance();
    return service.importTheme(configString);
  }, []);

  return {
    // State
    theme: config.theme,
    isDark: config.isDark,
    systemPrefersDark: config.systemPrefersDark,
    isLoaded,
    
    // Actions
    setTheme,
    toggleTheme,
    switchThemeWithAnimation,
    enableHighContrast,
    disableHighContrast,
    enableAutoSwitch,
    exportTheme,
    importTheme,
    
    // Computed values
    isSystem: config.theme === 'system',
    isLight: config.theme === 'light',
    isDarkMode: config.theme === 'dark'
  };
} 