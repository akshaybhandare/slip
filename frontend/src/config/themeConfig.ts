export type ThemeMode = 'light' | 'dark' | 'system';
export type ThemePreset = 'default' | 'cyberpunk' | 'nord' | 'monokai' | 'minimal';

export interface ThemePresetDefinition {
  id: ThemePreset;
  name: string;
  tagline: string;
  description: string;
  defaultAccent: string;
  accentSwatches: string[];
  previewColors: {
    bgLight: string;
    bgDark: string;
    accent: string;
    border: string;
  };
}

export const THEME_PRESETS: Record<ThemePreset, ThemePresetDefinition> = {
  default: {
    id: 'default',
    name: 'Default (OG)',
    tagline: 'Orderful & Modern',
    description: 'The original Slip aesthetic. Balanced clean neutrals with vivid signature red accents.',
    defaultAccent: '#e42b0c',
    accentSwatches: ['#e42b0c', '#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'],
    previewColors: {
      bgLight: '#f5f5f5',
      bgDark: '#0d0e11',
      accent: '#e42b0c',
      border: '#e9e9e9'
    }
  },
  cyberpunk: {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    tagline: 'Neon & High-Tech',
    description: 'Sharp angular borders, hyper-saturated neon highlights, and deep matrix contrast.',
    defaultAccent: '#00f0ff',
    accentSwatches: ['#00f0ff', '#ffe600', '#ff0055', '#39ff14', '#9d00ff', '#00ffcc'],
    previewColors: {
      bgLight: '#f0f3f8',
      bgDark: '#090a0f',
      accent: '#00f0ff',
      border: '#00f0ff'
    }
  },
  nord: {
    id: 'nord',
    name: 'Nord / Frost',
    tagline: 'Arctic & Calm',
    description: 'Soft glacial slates, gentle curvature, and serene Scandinavian polar hues.',
    defaultAccent: '#88c0d0',
    accentSwatches: ['#88c0d0', '#81a1c1', '#5e81ac', '#a3be8c', '#ebcb8b', '#b48ead'],
    previewColors: {
      bgLight: '#eceff4',
      bgDark: '#242933',
      accent: '#88c0d0',
      border: '#d8dee9'
    }
  },
  monokai: {
    id: 'monokai',
    name: 'Monokai / Retro',
    tagline: 'Warm & Solarized',
    description: 'Cozy espresso darks, vintage parchment lights, and radiant amber-gold accents.',
    defaultAccent: '#fd971f',
    accentSwatches: ['#fd971f', '#f92672', '#a6e22e', '#66d9ef', '#ae81ff', '#e6db74'],
    previewColors: {
      bgLight: '#fbf7ee',
      bgDark: '#1e1f1c',
      accent: '#fd971f',
      border: '#e4dccb'
    }
  },
  minimal: {
    id: 'minimal',
    name: 'Minimal / Mono',
    tagline: 'Pure & Editorial',
    description: 'Brutalist monochrome discipline, high legibility typography, and subtle industrial grays.',
    defaultAccent: '#18181b',
    accentSwatches: ['#18181b', '#3f3f46', '#71717a', '#0284c7', '#059669', '#d97706'],
    previewColors: {
      bgLight: '#ffffff',
      bgDark: '#0a0a0a',
      accent: '#18181b',
      border: '#e4e4e7'
    }
  }
};

export const STORAGE_KEY_THEME_MODE = 'slip_theme';
export const STORAGE_KEY_THEME_PRESET = 'slip_theme_preset';
export const STORAGE_KEY_CUSTOM_ACCENT = 'slip_custom_accent';
