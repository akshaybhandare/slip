import React from 'react';
import {
  X,
  Sun,
  Moon,
  Monitor,
  Check,
  RotateCcw
} from 'lucide-react';
import {
  ThemeMode,
  ThemePreset,
  THEME_PRESETS
} from '../config/themeConfig';
import { normalizeHex } from '../utils/themeUtils';

interface ThemeModalProps {
  isOpen: boolean;
  onClose: () => void;
  themeMode: ThemeMode;
  themePreset: ThemePreset;
  customAccent: string | null;
  onSelectMode: (mode: ThemeMode) => void;
  onSelectPreset: (preset: ThemePreset) => void;
  onSetCustomAccent: (accent: string | null) => void;
  onResetTheme: () => void;
}

export const ThemeModal: React.FC<ThemeModalProps> = ({
  isOpen,
  onClose,
  themeMode,
  themePreset,
  customAccent,
  onSelectMode,
  onSelectPreset,
  onSetCustomAccent,
  onResetTheme
}) => {
  if (!isOpen) return null;

  const currentPresetDef = THEME_PRESETS[themePreset] || THEME_PRESETS.default;
  const activeColor = customAccent || currentPresetDef.defaultAccent;

  const modeOptions: { id: ThemeMode; label: string; icon: React.ReactNode }[] = [
    { id: 'light', label: 'Light', icon: <Sun size={14} /> },
    { id: 'dark', label: 'Dark', icon: <Moon size={14} /> },
    { id: 'system', label: 'System', icon: <Monitor size={14} /> }
  ];

  const handleColorPickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = normalizeHex(e.target.value);
    if (val) onSetCustomAccent(val);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: '420px', padding: '24px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Minimalist Clean Header */}
        <div className="modal-header" style={{ marginBottom: '20px' }}>
          <h2 className="modal-title" style={{ fontSize: '17px', fontWeight: 600 }}>Appearance</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close modal">
            <X size={16} />
          </button>
        </div>

        {/* 1. Segmented Mode Switcher */}
        <div style={{ marginBottom: '22px' }}>
          <div className="modal-tab-bar" style={{ marginBottom: 0 }}>
            {modeOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`modal-tab-btn ${themeMode === opt.id ? 'active' : ''}`}
                onClick={() => onSelectMode(opt.id)}
              >
                {opt.icon}
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 2. Minimal Theme Presets List */}
        <div style={{ marginBottom: '22px' }}>
          <div className="theme-mini-presets-list">
            {(Object.keys(THEME_PRESETS) as ThemePreset[]).map((key) => {
              const preset = THEME_PRESETS[key];
              const isSelected = themePreset === key;
              return (
                <button
                  key={key}
                  type="button"
                  className={`theme-mini-row ${isSelected ? 'active' : ''}`}
                  onClick={() => onSelectPreset(key)}
                >
                  <div className="theme-mini-left">
                    <span
                      className="theme-mini-dot"
                      style={{ backgroundColor: preset.defaultAccent }}
                    />
                    <span className="theme-mini-name">{preset.name}</span>
                  </div>
                  <div className="theme-mini-right">
                    <span className="theme-mini-tag">{preset.tagline}</span>
                    {isSelected && <Check size={14} className="theme-mini-check" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Minimal Accent Row */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Accent
            </span>
            {customAccent && (
              <button
                type="button"
                className="theme-mini-reset-accent"
                onClick={() => onSetCustomAccent(null)}
              >
                Reset to preset
              </button>
            )}
          </div>

          <div className="theme-mini-swatches">
            {currentPresetDef.accentSwatches.map((color) => {
              const isSwatchActive = activeColor.toLowerCase() === color.toLowerCase();
              return (
                <button
                  key={color}
                  type="button"
                  className={`theme-mini-swatch ${isSwatchActive ? 'active' : ''}`}
                  style={{ backgroundColor: color }}
                  onClick={() => onSetCustomAccent(color === currentPresetDef.defaultAccent ? null : color)}
                  aria-label={`Color swatch ${color}`}
                >
                  {isSwatchActive && <Check size={12} style={{ color: '#ffffff', filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.5))' }} />}
                </button>
              );
            })}

            {/* Subtle native color picker */}
            <div className="theme-mini-picker-wrap" title="Custom color">
              <input
                type="color"
                className="theme-mini-native-picker"
                value={activeColor}
                onChange={handleColorPickerChange}
                aria-label="Pick custom primary color"
              />
              <span className="theme-mini-picker-plus">+</span>
            </div>
          </div>
        </div>

        {/* 4. Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px', borderTop: '1px solid var(--color-border)' }}>
          <button
            type="button"
            className="theme-mini-reset-btn"
            onClick={onResetTheme}
          >
            <RotateCcw size={13} />
            <span>Reset All</span>
          </button>

          <button
            type="button"
            className="btn btn-primary"
            style={{ padding: '6px 18px', fontSize: '13px', borderRadius: 'var(--radius-sm)' }}
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
