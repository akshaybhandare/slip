import { useState, useEffect, useCallback } from 'react';
import {
  ThemeMode,
  ThemePreset,
  THEME_PRESETS,
  STORAGE_KEY_THEME_MODE,
  STORAGE_KEY_THEME_PRESET,
  STORAGE_KEY_CUSTOM_ACCENT
} from '../config/themeConfig';
import {
  normalizeHex,
  getContrastingTextColor,
  getAlphaColor,
  getHoverColor
} from '../utils/themeUtils';

export type { ThemeMode, ThemePreset };

export function useTheme() {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_THEME_MODE) as ThemeMode | null;
      return (saved === 'light' || saved === 'dark' || saved === 'system') ? saved : 'system';
    } catch {
      return 'system';
    }
  });

  const [themePreset, setThemePresetState] = useState<ThemePreset>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_THEME_PRESET) as ThemePreset | null;
      return (saved && saved in THEME_PRESETS) ? saved : 'default';
    } catch {
      return 'default';
    }
  });

  const [customAccent, setCustomAccentState] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CUSTOM_ACCENT);
      return saved ? normalizeHex(saved) : null;
    } catch {
      return null;
    }
  });

  const [resolvedMode, setResolvedMode] = useState<'light' | 'dark'>('light');

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
    try {
      localStorage.setItem(STORAGE_KEY_THEME_MODE, mode);
    } catch {}
  }, []);

  const setThemePreset = useCallback((preset: ThemePreset) => {
    setThemePresetState(preset);
    try {
      localStorage.setItem(STORAGE_KEY_THEME_PRESET, preset);
    } catch {}
  }, []);

  const setCustomAccent = useCallback((accent: string | null) => {
    const normalized = accent ? normalizeHex(accent) : null;
    setCustomAccentState(normalized);
    try {
      if (normalized) {
        localStorage.setItem(STORAGE_KEY_CUSTOM_ACCENT, normalized);
      } else {
        localStorage.removeItem(STORAGE_KEY_CUSTOM_ACCENT);
      }
    } catch {}
  }, []);

  const resetTheme = useCallback(() => {
    setThemeMode('system');
    setThemePreset('default');
    setCustomAccent(null);
  }, [setThemeMode, setThemePreset, setCustomAccent]);

  // Apply theme classes and dynamic CSS variable overrides
  useEffect(() => {
    const isDarkPreferred = () => {
      if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
      }
      return false;
    };

    const applyTheme = () => {
      const isDark = themeMode === 'system' ? isDarkPreferred() : themeMode === 'dark';
      const activeMode: 'light' | 'dark' = isDark ? 'dark' : 'light';
      setResolvedMode(activeMode);

      const root = document.documentElement;
      root.setAttribute('data-theme', activeMode);
      root.setAttribute('data-preset', themePreset);

      // Determine active accent color
      const presetDef = THEME_PRESETS[themePreset] || THEME_PRESETS.default;
      const effectiveAccent = customAccent || null;

      if (effectiveAccent) {
        const contrastText = getContrastingTextColor(effectiveAccent);
        const hoverColor = getHoverColor(effectiveAccent, isDark);
        const alpha10 = getAlphaColor(effectiveAccent, 0.1);
        const alpha15 = getAlphaColor(effectiveAccent, 0.15);
        const alpha25 = getAlphaColor(effectiveAccent, 0.25);
        const glow = getAlphaColor(effectiveAccent, isDark ? 0.45 : 0.25);

        root.style.setProperty('--color-primary', effectiveAccent);
        root.style.setProperty('--color-primary-contrast', contrastText);
        root.style.setProperty('--color-primary-hover', hoverColor);
        root.style.setProperty('--color-primary-alpha-10', alpha10);
        root.style.setProperty('--color-primary-alpha-15', alpha15);
        root.style.setProperty('--color-primary-alpha-25', alpha25);
        root.style.setProperty('--color-primary-glow', glow);
        root.style.setProperty('--shadow-fab', `0 4px 16px ${glow}`);
      } else {
        // Remove runtime inline overrides so stylesheet variables take effect
        root.style.removeProperty('--color-primary');
        root.style.removeProperty('--color-primary-contrast');
        root.style.removeProperty('--color-primary-hover');
        root.style.removeProperty('--color-primary-alpha-10');
        root.style.removeProperty('--color-primary-alpha-15');
        root.style.removeProperty('--color-primary-alpha-25');
        root.style.removeProperty('--color-primary-glow');
        root.style.removeProperty('--shadow-fab');
      }

      // Update iOS & browser theme-color meta tag
      const themeMeta = document.querySelector('meta[name="theme-color"]');
      if (themeMeta) {
        const computedBg = getComputedStyle(root).getPropertyValue('--color-background').trim();
        themeMeta.setAttribute('content', computedBg || (isDark ? '#0d0e11' : '#f5f5f5'));
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
  }, [themeMode, themePreset, customAccent]);

  const toggleTheme = useCallback(() => {
    setThemeModeState((prev) => {
      const next: ThemeMode = prev === 'light' ? 'dark' : prev === 'dark' ? 'system' : 'light';
      try {
        localStorage.setItem(STORAGE_KEY_THEME_MODE, next);
      } catch {}
      return next;
    });
  }, []);

  return {
    themeMode,
    themePreset,
    customAccent,
    resolvedMode,
    setThemeMode,
    setThemePreset,
    setCustomAccent,
    resetTheme,
    toggleTheme
  };
}
