import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Lock,
  Check,
  ChevronDown,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Globe,
  KeyRound,
  ShieldCheck,
  Info
} from 'lucide-react';
import {
  AIConfig,
  AIProviderId,
  AI_PROVIDERS,
  maskApiKey
} from '../config/aiConfig';

interface AIConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  aiConfig: AIConfig;
  isAdmin?: boolean;
  onConnect: (config: AIConfig) => Promise<any> | void;
  onDisconnect: () => Promise<any> | void;
  onTestConnection: (config: AIConfig) => Promise<{ success: boolean; message: string; latencyMs?: number }>;
}

export const AIConnectModal: React.FC<AIConnectModalProps> = ({
  isOpen,
  onClose,
  aiConfig,
  isAdmin = false,
  onConnect,
  onDisconnect,
  onTestConnection
}) => {
  const [provider, setProvider] = useState<AIProviderId>(aiConfig.provider || 'openai');
  const [model, setModel] = useState(aiConfig.model || AI_PROVIDERS[aiConfig.provider || 'openai']?.defaultModel || 'gpt-4o-mini');
  const [apiKey, setApiKey] = useState(aiConfig.apiKey || '');
  const [customApiUrl, setCustomApiUrl] = useState(aiConfig.apiUrl || '');
  const [showKey, setShowKey] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [formError, setFormError] = useState('');

  // Sync state when modal opens or aiConfig changes
  useEffect(() => {
    if (isOpen) {
      const activeProvider = aiConfig.provider || 'openai';
      setProvider(activeProvider);
      setModel(aiConfig.model || AI_PROVIDERS[activeProvider]?.defaultModel || 'gpt-4o-mini');
      setApiKey(aiConfig.apiKey || '');
      setCustomApiUrl(aiConfig.apiUrl || '');
      setShowKey(false);
      setIsEditing(!aiConfig.isConnected);
      setTestResult(null);
      setFormError('');
      setIsConnecting(false);
      setIsTesting(false);
    }
  }, [isOpen, aiConfig]);

  if (!isOpen) return null;

  const currentProviderDef = AI_PROVIDERS[provider] || AI_PROVIDERS.openai;
  const connectedProviderDef = AI_PROVIDERS[aiConfig.provider] || AI_PROVIDERS.openai;
  const displayMaskedKey = aiConfig.maskedApiKey || maskApiKey(aiConfig.apiKey) || '••••••••••••••••••••••';

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value as AIProviderId;
    setProvider(selected);
    setModel(AI_PROVIDERS[selected]?.defaultModel || '');
    setFormError('');
    setTestResult(null);
  };

  const handleConnectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    setFormError('');
    setTestResult(null);

    const trimmedKey = apiKey.trim();
    const trimmedUrl = customApiUrl.trim();
    const trimmedModel = (model || '').trim() || currentProviderDef.defaultModel;

    if (provider !== 'custom' && !trimmedKey) {
      setFormError('Please enter your API key.');
      return;
    }

    if (provider === 'custom') {
      try {
        new URL(trimmedUrl.includes('://') ? trimmedUrl : `https://${trimmedUrl}`);
      } catch {
        setFormError('Please enter a valid API URL (e.g., https://api.together.xyz/v1).');
        return;
      }
    }

    const newConfig: AIConfig = {
      provider,
      model: trimmedModel,
      apiKey: trimmedKey,
      apiUrl: provider === 'custom' ? trimmedUrl : AI_PROVIDERS[provider].defaultApiUrl,
      isConnected: true,
      lastTestedAt: new Date().toISOString(),
      isAdmin: true
    };

    setIsConnecting(true);
    try {
      await onConnect(newConfig);
      setIsEditing(false);
      setShowKey(false);
      setApiKey('');
    } catch (err: any) {
      setFormError(err.message || 'Failed to test and connect AI provider.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const targetConfig: AIConfig = isEditing
        ? {
            provider,
            model: (model || '').trim() || currentProviderDef.defaultModel,
            apiKey: apiKey.trim(),
            apiUrl: provider === 'custom' ? customApiUrl.trim() : AI_PROVIDERS[provider].defaultApiUrl,
            isConnected: aiConfig.isConnected
          }
        : aiConfig;

      const result = await onTestConnection(targetConfig);
      setTestResult(result);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Connection test failed.'
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleClose = () => {
    setShowKey(false);
    setTestResult(null);
    setFormError('');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleClose} data-testid="ai-modal-overlay">
      <div
        className="modal-content ai-connect-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '440px', padding: '28px 26px' }}
      >
        {/* Modal Close Button */}
        <button
          className="modal-close ai-modal-close-btn"
          onClick={handleClose}
          aria-label="Close modal"
          title="Close"
        >
          <X size={18} />
        </button>

        {/* ==========================================================================
           NON-ADMIN VIEW: Read-Only Modal View
           ========================================================================== */}
        {!isAdmin ? (
          <div className="ai-connected-card-view">
            {aiConfig.isConnected ? (
              <>
                <div className="ai-modal-header" style={{ marginBottom: '16px' }}>
                  <div className="ai-header-sparkle-icon" aria-hidden="true">
                    <Sparkles size={22} />
                  </div>
                  <div className="ai-connected-title-row">
                    <span className="ai-connected-provider-name">{connectedProviderDef.name}</span>
                    <span className="ai-connected-dot">·</span>
                    <span className="ai-connected-badge">
                      {aiConfig.model || connectedProviderDef.defaultModel}
                    </span>
                    <span className="ai-connected-dot">·</span>
                    <span className="ai-connected-badge" style={{ color: '#059669' }}>
                      Connected <Check size={14} className="ai-check-icon" />
                    </span>
                  </div>
                  <p className="ai-modal-subtitle" style={{ marginTop: '4px' }}>
                    AI model is configured and securely managed by your administrator.
                  </p>
                </div>

                <div className="ai-connected-key-box" title="Configured API Key">
                  <div className="ai-connected-key-label">
                    <ShieldCheck size={13} style={{ color: '#059669' }} />
                    <span>Active Key (Managed by Admin)</span>
                  </div>
                  <div className="ai-masked-key-text">{displayMaskedKey}</div>
                </div>

                {aiConfig.provider === 'custom' && aiConfig.apiUrl && (
                  <div className="ai-connected-url-box" title="Custom Endpoint">
                    <div className="ai-connected-key-label">
                      <Globe size={13} style={{ color: 'var(--color-muted)' }} />
                      <span>Custom Endpoint</span>
                    </div>
                    <div className="ai-endpoint-url-text">{aiConfig.apiUrl}</div>
                  </div>
                )}

                <div className="ai-nonadmin-info-badge" style={{ marginTop: '16px' }}>
                  <Info size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>
                    Read-only view. AI capabilities (summaries, tagging, search) are active across your workspace.
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="ai-modal-header">
                  <div className="ai-header-sparkle-icon" aria-hidden="true">
                    <Sparkles size={24} />
                  </div>
                  <h2 className="ai-modal-title">AI Not Configured</h2>
                  <p className="ai-modal-subtitle">
                    AI features have not been enabled by an administrator yet.
                  </p>
                </div>
                <div className="ai-nonadmin-info-badge">
                  <Info size={15} style={{ flexShrink: 0 }} />
                  <span>
                    Please contact an administrator to connect an AI provider (OpenAI, Claude, Gemini, or Custom).
                  </span>
                </div>
              </>
            )}

            <div className="ai-modal-footer-note">
              <Lock size={13} className="ai-lock-icon" />
              <span>Secure & private</span>
            </div>
          </div>
        ) : aiConfig.isConnected && !isEditing ? (
          /* ==========================================================================
             ADMIN CONNECTED STATE VIEW
             ========================================================================== */
          <div className="ai-connected-card-view">
            <div className="ai-modal-header" style={{ marginBottom: '16px' }}>
              <div className="ai-header-sparkle-icon" aria-hidden="true">
                <Sparkles size={22} />
              </div>
              <div className="ai-connected-title-row">
                <span className="ai-connected-provider-name">{connectedProviderDef.name}</span>
                <span className="ai-connected-dot">·</span>
                <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--color-secondary)' }}>
                  {aiConfig.model || connectedProviderDef.defaultModel}
                </span>
                <span className="ai-connected-dot">·</span>
                <span className="ai-connected-badge">
                  Connected <Check size={14} className="ai-check-icon" />
                </span>
              </div>
              <p className="ai-modal-subtitle" style={{ marginTop: '4px' }}>
                Your AI model is securely saved in the database and active across all your devices.
              </p>
            </div>

            <div className="ai-connected-key-box" title="Stored API Key">
              <div className="ai-connected-key-label">
                <KeyRound size={13} style={{ color: 'var(--color-muted)' }} />
                <span>Encrypted API Key</span>
              </div>
              <div className="ai-masked-key-text">{displayMaskedKey}</div>
            </div>

            {aiConfig.provider === 'custom' && aiConfig.apiUrl && (
              <div className="ai-connected-url-box" title="Custom Endpoint">
                <div className="ai-connected-key-label">
                  <Globe size={13} style={{ color: 'var(--color-muted)' }} />
                  <span>Custom Endpoint</span>
                </div>
                <div className="ai-endpoint-url-text" title={aiConfig.apiUrl}>
                  {aiConfig.apiUrl}
                </div>
              </div>
            )}

            {testResult && (
              <div
                className={`ai-test-status-banner ${testResult.success ? 'success' : 'error'}`}
                style={{ marginTop: '12px' }}
              >
                {testResult.success ? (
                  <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
                ) : (
                  <AlertCircle size={15} style={{ flexShrink: 0 }} />
                )}
                <span>{testResult.message}</span>
              </div>
            )}

            <div className="ai-connected-actions-row">
              <button
                type="button"
                className="ai-action-link"
                onClick={() => {
                  setProvider(aiConfig.provider);
                  setModel(aiConfig.model || AI_PROVIDERS[aiConfig.provider]?.defaultModel || '');
                  setApiKey('');
                  setCustomApiUrl(aiConfig.apiUrl || '');
                  setIsEditing(true);
                  setTestResult(null);
                  setFormError('');
                }}
              >
                Change
              </button>

              <span className="ai-actions-separator">·</span>

              <button
                type="button"
                className="ai-action-link"
                onClick={handleTestConnection}
                disabled={isTesting}
              >
                {isTesting ? (
                  <>
                    <RefreshCw size={13} className="spin-animation" style={{ marginRight: '5px' }} />
                    Testing...
                  </>
                ) : (
                  'Test connection'
                )}
              </button>

              <span className="ai-actions-separator">·</span>

              <button
                type="button"
                className="ai-action-link ai-action-danger"
                onClick={async () => {
                  if (window.confirm('Disconnect AI provider and remove saved key from database?')) {
                    try {
                      await onDisconnect();
                      setApiKey('');
                      setCustomApiUrl('');
                      setIsEditing(true);
                      setTestResult(null);
                      setFormError('');
                    } catch (err: any) {
                      alert(err.message || 'Failed to disconnect AI provider');
                    }
                  }
                }}
                title="Disconnect provider"
              >
                Disconnect
              </button>
            </div>

            <div className="ai-modal-footer-note">
              <Lock size={13} className="ai-lock-icon" />
              <span>Secure & private</span>
            </div>
          </div>
        ) : (
          /* ==========================================================================
             ADMIN CONNECT / EDIT FORM STATE VIEW
             ========================================================================== */
          <div className="ai-connect-form-view">
            <div className="ai-modal-header">
              <div className="ai-header-sparkle-icon" aria-hidden="true">
                <Sparkles size={24} />
              </div>
              <h2 className="ai-modal-title">Connect your AI</h2>
              <p className="ai-modal-subtitle">Bring your own API key.</p>
            </div>

            {formError && (
              <div className="ai-form-error-banner">
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{formError}</span>
              </div>
            )}

            {testResult && (
              <div className={`ai-test-status-banner ${testResult.success ? 'success' : 'error'}`}>
                {testResult.success ? (
                  <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
                ) : (
                  <AlertCircle size={15} style={{ flexShrink: 0 }} />
                )}
                <span>{testResult.message}</span>
              </div>
            )}

            <form onSubmit={handleConnectSubmit} className="ai-connect-form">
              {/* PROVIDER SECTION */}
              <div className="ai-form-group">
                <label htmlFor="ai-provider-select" className="ai-section-label">
                  PROVIDER
                </label>
                <div className="ai-select-wrapper">
                  <select
                    id="ai-provider-select"
                    className="ai-select-input"
                    value={provider}
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

              {/* MODEL SECTION */}
              <div className="ai-form-group">
                <label htmlFor="ai-model-input" className="ai-section-label">
                  MODEL
                </label>
                <div className="ai-input-wrapper">
                  <input
                    id="ai-model-input"
                    type="text"
                    className="ai-text-input"
                    placeholder={currentProviderDef.modelPlaceholder}
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                  />
                </div>
                <p className="ai-micro-hint">
                  Default: <code>{currentProviderDef.defaultModel}</code>
                </p>
              </div>

              {/* CUSTOM API URL SECTION */}
              {provider === 'custom' && (
                <div className="ai-form-group">
                  <label htmlFor="ai-custom-url-input" className="ai-section-label">
                    API URL
                  </label>
                  <div className="ai-input-wrapper">
                    <Globe size={15} className="ai-input-left-icon" />
                    <input
                      id="ai-custom-url-input"
                      type="text"
                      className="ai-text-input has-left-icon"
                      placeholder="https://api.together.xyz/v1"
                      value={customApiUrl}
                      onChange={(e) => setCustomApiUrl(e.target.value)}
                      required={provider === 'custom'}
                      autoFocus={provider === 'custom' && !customApiUrl}
                    />
                  </div>
                  <p className="ai-micro-hint">
                    Saved automatically in database for custom provider.
                  </p>
                </div>
              )}

              {/* API KEY SECTION */}
              <div className="ai-form-group">
                <label htmlFor="ai-key-input" className="ai-section-label">
                  API KEY
                </label>
                <div className="ai-key-input-container">
                  <input
                    id="ai-key-input"
                    type={showKey ? 'text' : 'password'}
                    className="ai-key-input"
                    placeholder={
                      aiConfig.isConnected && !apiKey
                        ? 'Leave blank to keep existing key or enter new key'
                        : currentProviderDef.keyPlaceholder
                    }
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    required={provider !== 'custom' && !aiConfig.isConnected}
                    autoComplete="off"
                    spellCheck={false}
                    autoFocus={provider !== 'custom'}
                  />
                  <button
                    type="button"
                    className="ai-show-toggle-btn"
                    onClick={() => setShowKey(!showKey)}
                    aria-label={showKey ? 'Hide API key' : 'Show API key'}
                  >
                    {showKey ? 'HIDE' : 'SHOW'}
                  </button>
                </div>
                <p className="ai-micro-hint">
                  Your key is tested first, then encrypted (AES-256) and saved in database.
                </p>
              </div>

              {/* ACTION BUTTONS */}
              <div className="ai-form-buttons-group">
                <button
                  type="submit"
                  className="btn btn-primary ai-connect-btn"
                  disabled={isConnecting || isTesting}
                >
                  {isConnecting ? (
                    <>
                      <RefreshCw size={14} className="spin-animation" style={{ marginRight: '6px' }} />
                      Testing & Connecting...
                    </>
                  ) : (
                    'Connect'
                  )}
                </button>

                {aiConfig.isConnected && (
                  <button
                    type="button"
                    className="btn btn-secondary ai-cancel-edit-btn"
                    onClick={() => {
                      setIsEditing(false);
                      setFormError('');
                      setTestResult(null);
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>

              {/* FOOTER SECURITY NOTE */}
              <div className="ai-modal-footer-note">
                <Lock size={13} className="ai-lock-icon" />
                <span>Secure & private</span>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIConnectModal;
