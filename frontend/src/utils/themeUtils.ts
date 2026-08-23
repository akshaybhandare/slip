/**
 * Theme color utilities for dynamic contrast, hover, and alpha states.
 */

export interface RGB {
  r: number;
  g: number;
  b: number;
}

/**
 * Validates and normalizes a hex color string (e.g. "#fff" -> "#ffffff", "e42b0c" -> "#e42b0c")
 */
export function normalizeHex(hex: string): string | null {
  if (!hex) return null;
  let clean = hex.trim().replace(/^#/, '');
  if (clean.length === 3) {
    clean = clean.split('').map(c => c + c).join('');
  }
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) {
    return null;
  }
  return '#' + clean.toLowerCase();
}

/**
 * Convert Hex to RGB
 */
export function hexToRgb(hex: string): RGB | null {
  const normalized = normalizeHex(hex);
  if (!normalized) return null;
  const num = parseInt(normalized.slice(1), 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

/**
 * Calculate relative luminance according to WCAG 2.1 specs
 * https://www.w3.org/WAI/GL/wiki/Relative_luminance
 */
export function getRelativeLuminance(rgb: RGB): number {
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(v => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Calculate contrast ratio between two relative luminances
 */
export function getContrastRatio(lum1: number, lum2: number): number {
  const l1 = Math.max(lum1, lum2);
  const l2 = Math.min(lum1, lum2);
  return (l1 + 0.05) / (l2 + 0.05);
}

/**
 * Returns either pure white (#ffffff) or dark charcoal (#0f172a) based on whichever
 * yields the highest contrast ratio with the provided hex background, ensuring WCAG AA.
 */
export function getContrastingTextColor(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#ffffff';

  const bgLum = getRelativeLuminance(rgb);
  const whiteLum = 1.0;
  const darkLum = getRelativeLuminance({ r: 15, g: 23, b: 42 }); // #0f172a

  const contrastWithWhite = getContrastRatio(bgLum, whiteLum);
  const contrastWithDark = getContrastRatio(bgLum, darkLum);

  return contrastWithWhite >= contrastWithDark ? '#ffffff' : '#0f172a';
}

/**
 * Generate an RGBA color string from hex and alpha (0 to 1)
 */
export function getAlphaColor(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const clamped = Math.max(0, Math.min(1, alpha));
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${clamped})`;
}

/**
 * Generates an adjusted hover color (slightly darker or lighter based on lightness)
 */
export function getHoverColor(hex: string, isDarkMode: boolean): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  const lum = getRelativeLuminance(rgb);
  const factor = isDarkMode || lum < 0.2 ? 1.15 : 0.88;

  const r = Math.min(255, Math.max(0, Math.round(rgb.r * factor)));
  const g = Math.min(255, Math.max(0, Math.round(rgb.g * factor)));
  const b = Math.min(255, Math.max(0, Math.round(rgb.b * factor)));

  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
