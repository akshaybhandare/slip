import { useState, useEffect } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

export function useTheme() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem('slip_theme') as ThemeMode | null;
      return saved || 'system';
    } catch {
      return 'system';
    }
  });

  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const isDarkPreferred = () => {
      if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
      }
      return false;
    };

    const applyTheme = () => {
      let activeTheme: 'light' | 'dark' = 'light';
      if (themeMode === 'system') {
        activeTheme = isDarkPreferred() ? 'dark' : 'light';
      } else {
        activeTheme = themeMode;
      }

      setResolvedTheme(activeTheme);
      document.documentElement.setAttribute('data-theme', activeTheme);
      try {
        localStorage.setItem('slip_theme', themeMode);
      } catch {
        // Ignore localStorage restrictions
      }

      // Update iOS & browser theme-color meta tag
      const themeMeta = document.querySelector('meta[name="theme-color"]');
      if (themeMeta) {
        themeMeta.setAttribute('content', activeTheme === 'dark' ? '#0d0e11' : '#f5f5f5');
      }
    };

    applyTheme();

    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => {
        if (themeMode === 'system') {
          applyTheme();
        }
      };

      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
      }
    }
  }, [themeMode]);

  const toggleTheme = () => {
    setThemeMode((prev) => {
      if (prev === 'light') return 'dark';
      if (prev === 'dark') return 'system';
      return 'light';
    });
  };

  return { themeMode, resolvedTheme, setThemeMode, toggleTheme };
}
