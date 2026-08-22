import React, { useState, useEffect } from 'react';
import {
  X,
  Palette,
  Sparkles,
  Database,
  Users,
  Key,
  LogOut,
  RefreshCw,
  Upload,
  Download,
  Check,
  Sun,
  Moon,
  Monitor,
  RotateCcw,
  Shield,
  Trash2,
  Copy,
  AlertCircle,
  ChevronDown,
  Globe,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { User, UserListItem } from '../types';
import { ThemeMode, ThemePreset, THEME_PRESETS } from '../config/themeConfig';
import { normalizeHex } from '../utils/themeUtils';
import { AIConfig, AIProviderId, AI_PROVIDERS, maskApiKey } from '../config/aiConfig';
import {
  fetchAdminUsers,
  createAdminUser,
  deleteAdminUser,
  fetchAPIKeys,
  createAPIKey,
  deleteAPIKey,
  APIKeyListItem
} from '../api';
import { copyToClipboard } from '../utils/clipboard';

export type SettingsTab = 'appearance' | 'ai' | 'keys' | 'data' | 'users';

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: SettingsTab;
  user: User | null;
  // Appearance props
  themeMode: ThemeMode;
  themePreset: ThemePreset;
  customAccent: string | null;
  onSelectMode: (mode: ThemeMode) => void;
  onSelectPreset: (preset: ThemePreset) => void;
  onSetCustomAccent: (accent: string | null) => void;
  onResetTheme: () => void;
  // Data / Sync props
  onImportClick: () => void;
  onRescrapeAllClick: () => void;
  isRescrapingAll: boolean;
  // AI props
  aiConfig: AIConfig;
  onConnectAI: (config: AIConfig) => Promise<any> | void;
  onDisconnectAI: () => Promise<any> | void;
  onTestAIConnection: (config: AIConfig) => Promise<{ success: boolean; message: string; latencyMs?: number }>;
  // Account actions
  onLogoutClick: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'appearance',
  user,
  themeMode,
  themePreset,
  customAccent,
  onSelectMode,
  onSelectPreset,
  onSetCustomAccent,
  onResetTheme,
  onImportClick,
  onRescrapeAllClick,
  isRescrapingAll,
  aiConfig,
  onConnectAI,
  onDisconnectAI,
  onTestAIConnection,
  onLogoutClick
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);

  // AI Tab State
  const [aiProvider, setAiProvider] = useState<AIProviderId>(aiConfig.provider || 'openai');
  const [aiModel, setAiModel] = useState(aiConfig.model || AI_PROVIDERS[aiConfig.provider || 'openai']?.defaultModel || 'gpt-4o-mini');
  const [aiApiKey, setAiApiKey] = useState(aiConfig.apiKey || '');
  const [aiCustomUrl, setAiCustomUrl] = useState(aiConfig.apiUrl || '');
  const [aiShowKey, setAiShowKey] = useState(false);
  const [aiIsEditing, setAiIsEditing] = useState(false);
  const [aiIsTesting, setAiIsTesting] = useState(false);
  const [aiIsConnecting, setAiIsConnecting] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [aiFormError, setAiFormError] = useState('');

  // API Keys Tab State
  const [apiKeys, setApiKeys] = useState<APIKeyListItem[]>([]);
  const [keyName, setKeyName] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [newlyGeneratedKey, setNewlyGeneratedKey] = useState<string | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);
  const [keyLoading, setKeyLoading] = useState(false);
  const [keyError, setKeyError] = useState('');
  const [keySuccess, setKeySuccess] = useState('');

  // Users Tab State (Admin only)
  const [usersList, setUsersList] = useState<UserListItem[]>([]);
  const [newUsername, setNewUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [userLoading, setUserLoading] = useState(false);
  const [userDeletingId, setUserDeletingId] = useState<number | null>(null);
  const [userError, setUserError] = useState('');
  const [userSuccess, setUserSuccess] = useState('');

  const isAdmin = Boolean(user?.isAdmin || user?.id === 1);

  // Sync on open or tab changes
  useEffect(() => {
    if (isOpen) {
      if (initialTab) setActiveTab(initialTab);
      // Reset AI form state
      const activeP = aiConfig.provider || 'openai';
      setAiProvider(activeP);
      setAiModel(aiConfig.model || AI_PROVIDERS[activeP]?.defaultModel || 'gpt-4o-mini');
      setAiApiKey(aiConfig.apiKey || '');
      setAiCustomUrl(aiConfig.apiUrl || '');
      setAiShowKey(false);
      setAiIsEditing(!aiConfig.isConnected);
      setAiTestResult(null);
      setAiFormError('');
      setAiIsConnecting(false);
      setAiIsTesting(false);

      // Load Keys
      loadKeys();

      // Load Users if Admin
      if (isAdmin) {
        loadUsers();
      }

      if (user) {
        setSelectedUserId(String(user.id));
      }
    }
  }, [isOpen, initialTab, aiConfig, user, isAdmin]);

  const loadKeys = async () => {
    try {
      const data = await fetchAPIKeys();
      setApiKeys(data);
    } catch {
      // Ignored
    }
  };

  const loadUsers = async () => {
    if (!isAdmin) return;
    try {
      const data = await fetchAdminUsers();
      setUsersList(data);
    } catch {
      // Ignored
    }
  };

  if (!isOpen) return null;

  // --- AI Handlers ---
  const currentProviderDef = AI_PROVIDERS[aiProvider] || AI_PROVIDERS.openai;
  const connectedProviderDef = AI_PROVIDERS[aiConfig.provider] || AI_PROVIDERS.openai;
  const displayMaskedKey = aiConfig.maskedApiKey || maskApiKey(aiConfig.apiKey) || '••••••••••••••••••••••';

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value as AIProviderId;
    setAiProvider(selected);
    setAiModel(AI_PROVIDERS[selected]?.defaultModel || '');
    setAiFormError('');
    setAiTestResult(null);
  };

  const handleConnectAISubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    setAiFormError('');
    setAiTestResult(null);

    const trimmedKey = aiApiKey.trim();
    const trimmedUrl = aiCustomUrl.trim();
    const trimmedModel = (aiModel || '').trim() || currentProviderDef.defaultModel;

    if (aiProvider !== 'custom' && !trimmedKey) {
      setAiFormError('Please enter your API key.');
      return;
    }

    if (aiProvider === 'custom') {
      try {
        new URL(trimmedUrl.includes('://') ? trimmedUrl : `https://${trimmedUrl}`);
      } catch {
        setAiFormError('Please enter a valid API URL (e.g., https://api.together.xyz/v1).');
        return;
      }
    }

    const newConfig: AIConfig = {
      provider: aiProvider,
      model: trimmedModel,
      apiKey: trimmedKey,
      apiUrl: aiProvider === 'custom' ? trimmedUrl : AI_PROVIDERS[aiProvider].defaultApiUrl,
      isConnected: true,
      lastTestedAt: new Date().toISOString(),
      isAdmin: true
    };

    setAiIsConnecting(true);
    try {
      await onConnectAI(newConfig);
      setAiIsEditing(false);
      setAiShowKey(false);
      setAiApiKey('');
    } catch (err: any) {
      setAiFormError(err.message || 'Failed to test and connect AI provider.');
    } finally {
      setAiIsConnecting(false);
    }
  };

  const handleTestAIConnection = async () => {
    setAiIsTesting(true);
    setAiTestResult(null);
    try {
      const targetConfig: AIConfig = aiIsEditing
        ? {
            provider: aiProvider,
            model: (aiModel || '').trim() || currentProviderDef.defaultModel,
            apiKey: aiApiKey.trim(),
            apiUrl: aiProvider === 'custom' ? aiCustomUrl.trim() : AI_PROVIDERS[aiProvider].defaultApiUrl,
            isConnected: aiConfig.isConnected
          }
        : aiConfig;

      const result = await onTestAIConnection(targetConfig);
      setAiTestResult(result);
    } catch (err: any) {
      setAiTestResult({
        success: false,
        message: err.message || 'Connection test failed.'
      });
    } finally {
      setAiIsTesting(false);
    }
  };

  // --- API Key Handlers ---
  const handleGenerateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setKeyLoading(true);
    setKeyError('');
    setKeySuccess('');
    setNewlyGeneratedKey(null);
    setKeyCopied(false);

    try {
      const targetUserId = selectedUserId ? Number(selectedUserId) : undefined;
      const res = await createAPIKey(keyName.trim() || 'API Key', targetUserId);
      setNewlyGeneratedKey(res.apiKey);
      setKeySuccess("API Key generated successfully! Copy it now.");
      setKeyName('');
      loadKeys();
    } catch (err: any) {
      setKeyError(err.message || 'Failed to generate API key');
    } finally {
      setKeyLoading(false);
    }
  };

  const handleRevokeKey = async (id: number, name: string) => {
    if (!window.confirm(`Revoke API key "${name}"? Apps using it will lose access immediately.`)) {
      return;
    }
    try {
      await deleteAPIKey(id);
      loadKeys();
    } catch (err: any) {
      setKeyError(err.message || 'Failed to revoke API key');
    }
  };

  const handleCopyKey = async () => {
    if (!newlyGeneratedKey) return;
    const success = await copyToClipboard(newlyGeneratedKey);
    if (success) {
      setKeyCopied(true);
      setTimeout(() => setKeyCopied(false), 2000);
    }
  };

  // --- User Management Handlers ---
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newUserPassword) return;

    setUserLoading(true);
    setUserError('');
    setUserSuccess('');

    try {
      const res = await createAdminUser(newUsername.trim(), newUserPassword);
      setUserSuccess(`User @${res.user.username} created!`);
      setNewUsername('');
      setNewUserPassword('');
      loadUsers();
      setTimeout(() => setUserSuccess(''), 3000);
    } catch (err: any) {
      setUserError(err.message || 'Failed to create user');
    } finally {
      setUserLoading(false);
    }
  };

  const handleDeleteUser = async (userRecord: UserListItem) => {
    if (userRecord.id === 1) return;
    const confirmMsg = `Are you sure you want to remove @${userRecord.username}?\n\nAccount data will be deleted, and a bookmark backup will download automatically.`;
    if (!window.confirm(confirmMsg)) return;

    setUserDeletingId(userRecord.id);
    setUserError('');
    setUserSuccess('');

    try {
      const res = await deleteAdminUser(userRecord.id);
      if (res.exportHtml) {
        const blob = new Blob([res.exportHtml], { type: 'text/html;charset=utf-8' });
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `backup_deleted_user_${userRecord.username}_bookmarks.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
      }
      setUserSuccess(`User @${userRecord.username} removed!`);
      loadUsers();
      loadKeys();
      setTimeout(() => setUserSuccess(''), 3000);
    } catch (err: any) {
      setUserError(err.message || 'Failed to delete user');
    } finally {
      setUserDeletingId(null);
    }
  };

  // --- Appearance Handlers ---
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
    <div className="modal-overlay" onClick={onClose} data-testid="settings-modal-overlay">
      <div
        className="modal-content settings-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header" style={{ marginBottom: '14px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <h2 className="modal-title" style={{ fontSize: '18px', fontWeight: 600 }}>Settings</h2>
            {user && (
              <span style={{ fontSize: '12px', color: 'var(--color-muted)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                (@{user.username})
              </span>
            )}
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close modal" title="Close">
            <X size={16} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="settings-tab-nav">
          <button
            type="button"
            className={`settings-nav-btn ${activeTab === 'appearance' ? 'active' : ''}`}
            onClick={() => setActiveTab('appearance')}
          >
            <Palette size={14} />
            <span>Appearance</span>
          </button>

          <button
            type="button"
            className={`settings-nav-btn ${activeTab === 'ai' ? 'active' : ''}`}
            onClick={() => setActiveTab('ai')}
          >
            <Sparkles size={14} />
            <span>AI & Models</span>
          </button>

          <button
            type="button"
            className={`settings-nav-btn ${activeTab === 'keys' ? 'active' : ''}`}
            onClick={() => setActiveTab('keys')}
          >
            <Key size={14} />
            <span>API Keys</span>
          </button>

          <button
            type="button"
            className={`settings-nav-btn ${activeTab === 'data' ? 'active' : ''}`}
            onClick={() => setActiveTab('data')}
          >
            <Database size={14} />
            <span>Data & Sync</span>
          </button>

          {isAdmin && (
            <button
              type="button"
              className={`settings-nav-btn ${activeTab === 'users' ? 'active' : ''}`}
              onClick={() => setActiveTab('users')}
            >
              <Users size={14} />
              <span>Users</span>
            </button>
          )}
        </div>

        {/* Tab Body Container */}
        <div className="settings-modal-body">
          {/* =========================================================================
             TAB 1: APPEARANCE
             ========================================================================= */}
          {activeTab === 'appearance' && (
            <div className="settings-section">
              {/* Color Mode Switcher */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
                  Color Mode
                </div>
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

              {/* Theme Presets List */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
                  Theme Preset
                </div>
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

              {/* Accent Color Swatches */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Accent Color
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

              <div>
                <button
                  type="button"
                  className="theme-mini-reset-btn"
                  onClick={onResetTheme}
                >
                  <RotateCcw size={13} />
                  <span>Reset appearance to defaults</span>
                </button>
              </div>
            </div>
          )}

          {/* =========================================================================
             TAB 2: DIRECT INLINE AI & MODELS
             ========================================================================= */}
          {activeTab === 'ai' && (
            <div className="settings-section">
              {aiFormError && (
                <div className="ai-form-error-banner" style={{ marginBottom: '12px' }}>
                  <AlertCircle size={15} style={{ flexShrink: 0 }} />
                  <span>{aiFormError}</span>
                </div>
              )}

              {aiTestResult && (
                <div
                  className={`ai-test-status-banner ${aiTestResult.success ? 'success' : 'error'}`}
                  style={{ marginBottom: '14px' }}
                >
                  {aiTestResult.success ? (
                    <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
                  ) : (
                    <AlertCircle size={15} style={{ flexShrink: 0 }} />
                  )}
                  <span>{aiTestResult.message}</span>
                </div>
              )}

              {!isAdmin ? (
                /* Non-admin read-only card */
                <div className="ai-connected-card-view">
                  {aiConfig.isConnected ? (
                    <>
                      <div className="ai-connected-key-box" style={{ marginTop: 0 }}>
                        <div className="ai-connected-key-label">
                          <ShieldCheck size={13} style={{ color: '#059669' }} />
                          <span>Connected ({connectedProviderDef.name} · {aiConfig.model || connectedProviderDef.defaultModel})</span>
                        </div>
                        <div className="ai-masked-key-text">{displayMaskedKey}</div>
                      </div>
                      <div className="ai-nonadmin-info-badge" style={{ marginTop: '12px' }}>
                        <span>Managed by system administrator. Semantic search and tagging are active.</span>
                      </div>
                    </>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-muted)', fontSize: '13px' }}>
                      AI capabilities have not been configured by an administrator yet.
                    </div>
                  )}
                </div>
              ) : aiConfig.isConnected && !aiIsEditing ? (
                /* Admin connected state */
                <div className="ai-connected-card-view" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div
                    style={{
                      padding: '14px 16px',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Sparkles size={16} style={{ color: 'var(--color-primary)' }} />
                        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-secondary)' }}>
                          {connectedProviderDef.name}
                        </span>
                        <span style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
                          ({aiConfig.model || connectedProviderDef.defaultModel})
                        </span>
                      </div>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        Active <Check size={13} />
                      </span>
                    </div>

                    <div style={{ fontSize: '12px', color: 'var(--color-muted)', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                      Key: {displayMaskedKey}
                    </div>

                    {aiConfig.provider === 'custom' && aiConfig.apiUrl && (
                      <div style={{ fontSize: '12px', color: 'var(--color-muted)', marginTop: '4px', wordBreak: 'break-all' }}>
                        URL: {aiConfig.apiUrl}
                      </div>
                    )}
                  </div>

                  <div className="settings-btn-group-responsive">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        setAiProvider(aiConfig.provider);
                        setAiModel(aiConfig.model || AI_PROVIDERS[aiConfig.provider]?.defaultModel || '');
                        setAiApiKey('');
                        setAiCustomUrl(aiConfig.apiUrl || '');
                        setAiIsEditing(true);
                        setAiTestResult(null);
                        setAiFormError('');
                      }}
                      style={{ fontSize: '13.5px', height: '40px', flex: 1 }}
                    >
                      Change Configuration
                    </button>

                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleTestAIConnection}
                      disabled={aiIsTesting}
                      style={{ fontSize: '13.5px', height: '40px', flex: 1 }}
                    >
                      {aiIsTesting ? (
                        <>
                          <RefreshCw size={14} className="spin-animation" />
                          <span>Testing...</span>
                        </>
                      ) : (
                        'Test Connection'
                      )}
                    </button>

                    <button
                      type="button"
                      className="btn btn-secondary btn-danger"
                      onClick={async () => {
                        if (window.confirm('Disconnect AI provider?')) {
                          try {
                            await onDisconnectAI();
                            setAiApiKey('');
                            setAiCustomUrl('');
                            setAiIsEditing(true);
                            setAiTestResult(null);
                            setAiFormError('');
                          } catch (err: any) {
                            alert(err.message || 'Failed to disconnect AI');
                          }
                        }
                      }}
                      style={{ fontSize: '13.5px', height: '40px' }}
                      title="Disconnect AI"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              ) : (
                /* Admin inline edit / connect form */
                <form onSubmit={handleConnectAISubmit} className="ai-connect-form">
                  <div className="ai-form-group">
                    <label htmlFor="ai-prov-select" className="ai-section-label">PROVIDER</label>
                    <div className="ai-select-wrapper">
                      <select
                        id="ai-prov-select"
                        className="ai-select-input"
                        value={aiProvider}
                        onChange={handleProviderChange}
                      >
                        <option value="openai">OpenAI</option>
                        <option value="claude">Claude</option>
                        <option value="gemini">Gemini</option>
                        <option value="custom">Custom</option>
                      </select>
                      <ChevronDown size={16} className="ai-select-arrow" />
                    </div>
                  </div>

                  <div className="ai-form-group">
                    <label htmlFor="ai-mod-input" className="ai-section-label">MODEL</label>
                    <div className="ai-input-wrapper">
                      <input
                        id="ai-mod-input"
                        type="text"
                        className="ai-text-input"
                        placeholder={currentProviderDef.modelPlaceholder}
                        value={aiModel}
                        onChange={(e) => setAiModel(e.target.value)}
                      />
                    </div>
                  </div>

                  {aiProvider === 'custom' && (
                    <div className="ai-form-group">
                      <label htmlFor="ai-url-input" className="ai-section-label">API URL</label>
                      <div className="ai-input-wrapper">
                        <Globe size={15} className="ai-input-left-icon" />
                        <input
                          id="ai-url-input"
                          type="text"
                          className="ai-text-input has-left-icon"
                          placeholder="https://api.together.xyz/v1"
                          value={aiCustomUrl}
                          onChange={(e) => setAiCustomUrl(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                  )}

                  <div className="ai-form-group">
                    <label htmlFor="ai-key-in" className="ai-section-label">API KEY</label>
                    <div className="ai-key-input-container">
                      <input
                        id="ai-key-in"
                        type={aiShowKey ? 'text' : 'password'}
                        className="ai-key-input"
                        placeholder={
                          aiConfig.isConnected && !aiApiKey
                            ? 'Leave blank to keep existing key'
                            : currentProviderDef.keyPlaceholder
                        }
                        value={aiApiKey}
                        onChange={(e) => setAiApiKey(e.target.value)}
                        required={aiProvider !== 'custom' && !aiConfig.isConnected}
                        autoComplete="off"
                        spellCheck={false}
                      />
                      <button
                        type="button"
                        className="ai-show-toggle-btn"
                        onClick={() => setAiShowKey(!aiShowKey)}
                        aria-label={aiShowKey ? 'Hide API key' : 'Show API key'}
                      >
                        {aiShowKey ? 'HIDE' : 'SHOW'}
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={aiIsConnecting || aiIsTesting}
                      style={{ flex: 1, fontSize: '14px', height: '40px' }}
                    >
                      {aiIsConnecting ? 'Saving & Testing...' : 'Save & Connect AI'}
                    </button>

                    {aiConfig.isConnected && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                          setAiIsEditing(false);
                          setAiFormError('');
                          setAiTestResult(null);
                        }}
                        style={{ fontSize: '14px', height: '40px' }}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              )}
            </div>
          )}

          {/* =========================================================================
             TAB 3: DIRECT INLINE API KEYS
             ========================================================================= */}
          {activeTab === 'keys' && (
            <div className="settings-section">
              {keyError && (
                <div style={{ color: 'var(--color-error)', fontSize: '13px', marginBottom: '12px', background: 'rgba(228, 43, 12, 0.08)', padding: '8px 12px', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle size={15} />
                  <span>{keyError}</span>
                </div>
              )}

              {keySuccess && (
                <div style={{ color: 'var(--color-primary)', fontSize: '13px', marginBottom: '12px', background: 'var(--color-tertiary)', padding: '8px 12px', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Check size={15} />
                  <span>{keySuccess}</span>
                </div>
              )}

              {/* Newly Generated Key Callout */}
              {newlyGeneratedKey && (
                <div style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-primary)',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '16px'
                }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-primary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    New Key (Copy Now — Won't Be Shown Again)
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <code style={{
                      flex: 1,
                      padding: '8px 10px',
                      background: 'var(--color-background)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-sm)',
                      fontFamily: 'monospace',
                      fontSize: '12.5px',
                      wordBreak: 'break-all',
                      color: 'var(--color-secondary)'
                    }}>
                      {newlyGeneratedKey}
                    </code>
                    <button
                      type="button"
                      className={`btn ${keyCopied ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={handleCopyKey}
                      style={{ padding: '0 12px', height: '36px' }}
                      title="Copy Key"
                    >
                      {keyCopied ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
              )}

              {/* Quick Generate Key Form */}
              <form onSubmit={handleGenerateKey} style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-muted)', marginBottom: '8px' }}>
                  Generate New API Key
                </div>
                <div className="settings-inline-form-row">
                  <input
                    type="text"
                    required
                    className="form-input"
                    style={{ flex: 1, height: '40px', fontSize: '14px', minWidth: '160px' }}
                    placeholder="Key label (e.g. Chrome, iOS)"
                    value={keyName}
                    onChange={(e) => setKeyName(e.target.value)}
                  />
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={keyLoading || !keyName.trim()}
                    style={{ height: '40px', fontSize: '14px', padding: '0 16px', flexShrink: 0 }}
                  >
                    {keyLoading ? 'Generating...' : 'Generate'}
                  </button>
                </div>
              </form>

              {/* Existing API Keys List */}
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-muted)', marginBottom: '8px' }}>
                  Active Keys ({apiKeys.length})
                </div>
                {apiKeys.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--color-muted)', fontSize: '13px', background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', border: '1px dotted var(--color-border)' }}>
                    No API keys generated yet.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                    {apiKeys.map((k) => (
                      <div
                        key={k.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          background: 'var(--color-surface)',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--color-border)',
                          gap: '8px'
                        }}
                      >
                        <div style={{ minWidth: 0, overflow: 'hidden' }}>
                          <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--color-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {k.name}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--color-muted)' }}>
                            Created {new Date(k.created_at).toLocaleDateString()}
                          </div>
                        </div>

                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '0 10px', height: '32px', color: 'var(--color-error)', flexShrink: 0 }}
                          onClick={() => handleRevokeKey(k.id, k.name)}
                          title="Revoke Key"
                        >
                          <Trash2 size={13} />
                          <span style={{ fontSize: '12px', marginLeft: '4px' }}>Revoke</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =========================================================================
             TAB 4: DATA & SYNC
             ========================================================================= */}
          {activeTab === 'data' && (
            <div className="settings-section">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {/* Global Re-scrape */}
                <div className="settings-action-card">
                  <div className="settings-action-card-text">
                    <div className="settings-action-card-title">
                      Global Sync & Re-scrape
                    </div>
                    <div className="settings-action-card-desc">
                      Refresh previews, favicons, and metadata for all bookmarks.
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={onRescrapeAllClick}
                    disabled={isRescrapingAll}
                    style={{ flexShrink: 0, height: '40px', fontSize: '13.5px' }}
                  >
                    <RefreshCw size={14} className={isRescrapingAll ? 'spin-animation' : ''} />
                    <span>{isRescrapingAll ? 'Syncing...' : 'Sync All'}</span>
                  </button>
                </div>

                {/* Import Bookmarks */}
                <div className="settings-action-card">
                  <div className="settings-action-card-text">
                    <div className="settings-action-card-title">
                      Import Bookmarks
                    </div>
                    <div className="settings-action-card-desc">
                      Import Netscape HTML from Chrome, Safari, Firefox, or Raindrop.
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      onClose();
                      onImportClick();
                    }}
                    style={{ flexShrink: 0, height: '40px', fontSize: '13.5px' }}
                  >
                    <Upload size={14} />
                    <span>Import</span>
                  </button>
                </div>

                {/* Export Bookmarks */}
                <div className="settings-action-card">
                  <div className="settings-action-card-text">
                    <div className="settings-action-card-title">
                      Export Bookmarks
                    </div>
                    <div className="settings-action-card-desc">
                      Download your archive as a standard Netscape HTML file.
                    </div>
                  </div>
                  <a
                    href="/api/io/export"
                    className="btn btn-secondary"
                    download
                    style={{ flexShrink: 0, height: '40px', fontSize: '13.5px', textDecoration: 'none' }}
                  >
                    <Download size={14} />
                    <span>Export</span>
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
             TAB 5: DIRECT INLINE USER MANAGEMENT (ADMIN ONLY)
             ========================================================================= */}
          {activeTab === 'users' && isAdmin && (
            <div className="settings-section">
              {userError && (
                <div style={{ color: 'var(--color-error)', fontSize: '13px', marginBottom: '12px', background: 'rgba(228, 43, 12, 0.08)', padding: '8px 12px', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle size={15} />
                  <span>{userError}</span>
                </div>
              )}

              {userSuccess && (
                <div style={{ color: 'var(--color-primary)', fontSize: '13px', marginBottom: '12px', background: 'var(--color-tertiary)', padding: '8px 12px', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Check size={15} />
                  <span>{userSuccess}</span>
                </div>
              )}

              {/* Add User Form */}
              <form onSubmit={handleCreateUser} style={{ marginBottom: '18px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-muted)', marginBottom: '8px' }}>
                  Create New User
                </div>
                <div className="settings-user-create-grid">
                  <input
                    type="text"
                    required
                    className="form-input"
                    style={{ height: '40px', fontSize: '14px' }}
                    placeholder="Username"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                  />
                  <input
                    type="password"
                    required
                    className="form-input"
                    style={{ height: '40px', fontSize: '14px' }}
                    placeholder="Password (8+ chars)"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                  />
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={userLoading || !newUsername.trim() || newUserPassword.length < 8}
                    style={{ height: '40px', fontSize: '14px', padding: '0 16px' }}
                  >
                    {userLoading ? 'Adding...' : 'Add'}
                  </button>
                </div>
              </form>

              {/* Users List */}
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-muted)', marginBottom: '8px' }}>
                  Existing Accounts ({usersList.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                  {usersList.map((u) => (
                    <div
                      key={u.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        background: 'var(--color-surface)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        gap: '8px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                        <div style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '50%',
                          background: u.id === 1 ? 'var(--color-primary)' : 'var(--color-tertiary)',
                          color: u.id === 1 ? '#ffffff' : 'var(--color-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '11px',
                          fontWeight: 600,
                          flexShrink: 0
                        }}>
                          {u.id === 1 ? <Shield size={13} /> : u.username.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <span style={{ fontSize: '13.5px', fontWeight: 500, color: 'var(--color-secondary)' }}>
                            @{u.username}
                          </span>{' '}
                          {u.id === 1 && <span style={{ fontSize: '10px', color: 'var(--color-primary)', fontWeight: 600 }}>[Admin]</span>}
                        </div>
                      </div>

                      {u.id !== 1 && (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '0 10px', height: '32px', color: 'var(--color-error)', flexShrink: 0 }}
                          onClick={() => handleDeleteUser(u)}
                          disabled={userDeletingId === u.id}
                          title="Remove user"
                        >
                          <Trash2 size={13} />
                          <span style={{ fontSize: '12px', marginLeft: '4px' }}>
                            {userDeletingId === u.id ? '...' : 'Remove'}
                          </span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer with quick logout and Done */}
        <div
          style={{
            display: 'flex',
            justifyContent: user ? 'space-between' : 'flex-end',
            alignItems: 'center',
            paddingTop: '14px',
            borderTop: '1px solid var(--color-border)',
            marginTop: '14px',
            flexShrink: 0
          }}
        >
          {user && (
            <button
              type="button"
              className="btn btn-secondary btn-danger"
              onClick={() => {
                onClose();
                onLogoutClick();
              }}
              style={{ height: '36px', padding: '0 14px', fontSize: '13px' }}
              title={`Log out (@${user.username})`}
            >
              <LogOut size={14} />
              <span>Log out</span>
            </button>
          )}

          <button
            type="button"
            className="btn btn-primary"
            style={{ padding: '0 24px', fontSize: '13.5px', borderRadius: 'var(--radius-md)', height: '36px' }}
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
