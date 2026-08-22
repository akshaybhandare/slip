import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react';
import { useTheme } from '../hooks/useTheme';
import { ThemeModal } from '../components/ThemeModal';
import { Navbar } from '../components/Navbar';
import { THEME_PRESETS } from '../config/themeConfig';
import {
  normalizeHex,
  hexToRgb,
  getRelativeLuminance,
  getContrastRatio,
  getContrastingTextColor,
  getAlphaColor,
  getHoverColor
} from '../utils/themeUtils';

describe('Theme Color & Contrast Utilities', () => {
  it('normalizes hex values with or without hash, and 3-char shorthand', () => {
    expect(normalizeHex('e42b0c')).toBe('#e42b0c');
    expect(normalizeHex('#E42B0C')).toBe('#e42b0c');
    expect(normalizeHex('#fff')).toBe('#ffffff');
    expect(normalizeHex('000')).toBe('#000000');
    expect(normalizeHex('invalid')).toBeNull();
  });

  it('converts hex to RGB numbers accurately', () => {
    expect(hexToRgb('#ffffff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
    expect(hexToRgb('#e42b0c')).toEqual({ r: 228, g: 43, b: 12 });
  });

  it('calculates WCAG 2.1 relative luminance and contrast ratio', () => {
    const whiteLum = getRelativeLuminance({ r: 255, g: 255, b: 255 });
    const blackLum = getRelativeLuminance({ r: 0, g: 0, b: 0 });
    expect(whiteLum).toBe(1.0);
    expect(blackLum).toBe(0.0);

    const maxContrast = getContrastRatio(whiteLum, blackLum);
    expect(maxContrast).toBe(21);
  });

  it('returns high-contrast text color complying with WCAG AA standards', () => {
    // Dark colors need white text
    expect(getContrastingTextColor('#000000')).toBe('#ffffff');
    expect(getContrastingTextColor('#e42b0c')).toBe('#ffffff');
    expect(getContrastingTextColor('#18181b')).toBe('#ffffff');

    // Bright/light colors need dark text
    expect(getContrastingTextColor('#ffffff')).toBe('#0f172a');
    expect(getContrastingTextColor('#00f0ff')).toBe('#0f172a'); // Cyberpunk cyan
    expect(getContrastingTextColor('#ffe600')).toBe('#0f172a'); // Bright yellow
  });

  it('produces valid RGBA alpha strings and responsive hover colors', () => {
    expect(getAlphaColor('#e42b0c', 0.5)).toBe('rgba(228, 43, 12, 0.5)');
    const hoverDark = getHoverColor('#e42b0c', true);
    expect(hoverDark).toBeTruthy();
    expect(hoverDark.startsWith('#')).toBe(true);
  });
});

describe('useTheme Hook State & DOM Sync', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-preset');
    document.documentElement.removeAttribute('style');
  });

  it('initializes with default system mode and default OG preset', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.themeMode).toBe('system');
    expect(result.current.themePreset).toBe('default');
    expect(result.current.customAccent).toBeNull();
    expect(document.documentElement.getAttribute('data-theme')).toBeTruthy();
    expect(document.documentElement.getAttribute('data-preset')).toBe('default');
  });

  it('toggles mode through light, dark, and system', () => {
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.toggleTheme();
    });
    expect(result.current.themeMode).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    act(() => {
      result.current.toggleTheme();
    });
    expect(result.current.themeMode).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    act(() => {
      result.current.toggleTheme();
    });
    expect(result.current.themeMode).toBe('system');
  });

  it('switches theme presets and updates data-preset attribute', () => {
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setThemePreset('cyberpunk');
    });
    expect(result.current.themePreset).toBe('cyberpunk');
    expect(document.documentElement.getAttribute('data-preset')).toBe('cyberpunk');

    act(() => {
      result.current.setThemePreset('nord');
    });
    expect(result.current.themePreset).toBe('nord');
    expect(document.documentElement.getAttribute('data-preset')).toBe('nord');
  });

  it('applies custom primary accent color with derived CSS variables', () => {
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setCustomAccent('#00f0ff');
    });

    expect(result.current.customAccent).toBe('#00f0ff');
    expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe('#00f0ff');
    expect(document.documentElement.style.getPropertyValue('--color-primary-contrast')).toBe('#0f172a');
    expect(document.documentElement.style.getPropertyValue('--color-primary-alpha-10')).toContain('rgba');

    // Resetting accent removes style overrides
    act(() => {
      result.current.setCustomAccent(null);
    });
    expect(result.current.customAccent).toBeNull();
    expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe('');
  });

  it('resets all theme settings back to defaults', () => {
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setThemeMode('dark');
      result.current.setThemePreset('monokai');
      result.current.setCustomAccent('#10b981');
    });

    act(() => {
      result.current.resetTheme();
    });

    expect(result.current.themeMode).toBe('system');
    expect(result.current.themePreset).toBe('default');
    expect(result.current.customAccent).toBeNull();
  });
});

describe('ThemeModal UI Component', () => {
  it('renders presets, mode buttons, swatches, and handles interactions', () => {
    const onSelectMode = vi.fn();
    const onSelectPreset = vi.fn();
    const onSetCustomAccent = vi.fn();
    const onResetTheme = vi.fn();
    const onClose = vi.fn();

    render(
      <ThemeModal
        isOpen={true}
        onClose={onClose}
        themeMode="system"
        themePreset="default"
        customAccent={null}
        onSelectMode={onSelectMode}
        onSelectPreset={onSelectPreset}
        onSetCustomAccent={onSetCustomAccent}
        onResetTheme={onResetTheme}
      />
    );

    expect(screen.getByText('Appearance')).toBeInTheDocument();

    // Select Dark mode
    const darkBtn = screen.getByRole('button', { name: /Dark/i });
    fireEvent.click(darkBtn);
    expect(onSelectMode).toHaveBeenCalledWith('dark');

    // Select Cyberpunk preset
    const cyberpunkBtn = screen.getByRole('button', { name: /Cyberpunk/i });
    fireEvent.click(cyberpunkBtn);
    expect(onSelectPreset).toHaveBeenCalledWith('cyberpunk');

    // Click on a color swatch
    const defaultAccentSwatch = screen.getByLabelText(`Color swatch ${THEME_PRESETS.default.accentSwatches[1]}`);
    fireEvent.click(defaultAccentSwatch);
    expect(onSetCustomAccent).toHaveBeenCalled();

    // Click Reset All
    const resetBtn = screen.getByRole('button', { name: /Reset All/i });
    fireEvent.click(resetBtn);
    expect(onResetTheme).toHaveBeenCalled();

    // Close button
    const doneBtn = screen.getByRole('button', { name: /Done/i });
    fireEvent.click(doneBtn);
    expect(onClose).toHaveBeenCalled();
  });
});

describe('Navbar Theme Controls', () => {
  it('renders unified theme button and opens Appearance modal on click', () => {
    const onOpenThemeModal = vi.fn();

    render(
      <Navbar
        searchQuery=""
        onSearchChange={vi.fn()}
        onAddClick={vi.fn()}
        onImportClick={vi.fn()}
        onRescrapeAllClick={vi.fn()}
        isRescrapingAll={false}
        onLogoutClick={vi.fn()}
        user={null}
        themeMode="light"
        onOpenThemeModal={onOpenThemeModal}
      />
    );

    const themeBtn = screen.getByLabelText(/Theme & Appearance settings/i);
    fireEvent.click(themeBtn);
    expect(onOpenThemeModal).toHaveBeenCalledTimes(1);
  });
});
