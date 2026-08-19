import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { AIConnectModal } from '../components/AIConnectModal';
import {
  AIConfig,
  AI_PROVIDERS,
  getSavedAIConfig,
  saveAIConfig,
  clearAIConfig,
  maskApiKey
} from '../config/aiConfig';
import App from '../App';
import * as api from '../api';

vi.mock('../api', () => ({
  fetchBookmarks: vi.fn(),
  searchBookmarks: vi.fn(),
  fetchTags: vi.fn(),
  createBookmark: vi.fn(),
  uploadImageBookmark: vi.fn(),
  uploadFileBookmark: vi.fn(),
  createNoteBookmark: vi.fn(),
  deleteBookmark: vi.fn(),
  logoutUser: vi.fn(),
  loginUser: vi.fn(),
  registerUser: vi.fn(),
  createAdminUser: vi.fn(),
  fetchAdminUsers: vi.fn(),
  deleteAdminUser: vi.fn(),
  shareBookmark: vi.fn(),
  revokeShareBookmark: vi.fn(),
  importBookmarksHtml: vi.fn(),
  getMe: vi.fn(),
  getAuthStatus: vi.fn(),
  updateBookmark: vi.fn(),
  rescrapeBookmark: vi.fn(),
  autoTagBookmark: vi.fn(),
  rescrapeAllBookmarks: vi.fn(),
  fetchAIConfig: vi.fn(),
  saveAIConfigApi: vi.fn(),
  testAIConnectionApi: vi.fn(),
  disconnectAIConfigApi: vi.fn()
}));

describe('AI Config Module & Helpers', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defines known providers with predefined API URLs and custom provider option', () => {
    expect(AI_PROVIDERS.openai.defaultApiUrl).toBe('https://api.openai.com/v1');
    expect(AI_PROVIDERS.claude.defaultApiUrl).toBe('https://api.anthropic.com/v1');
    expect(AI_PROVIDERS.gemini.defaultApiUrl).toBe('https://generativelanguage.googleapis.com/v1beta');
    expect(AI_PROVIDERS.custom.id).toBe('custom');
  });

  it('masks API keys showing leading bullets and the last 4 characters', () => {
    expect(maskApiKey('sk-proj-1234567890abcdef1234a82f')).toBe('••••••••••••••••••••••a82f');
    expect(maskApiKey('sk-ant-api03-1234abcd')).toBe('••••••••••••••••••••••abcd');
    expect(maskApiKey('1234')).toBe('••••••••••••••••••••••1234');
    expect(maskApiKey('••••••••••••••••••••••a82f')).toBe('••••••••••••••••••••••a82f');
    expect(maskApiKey('')).toBe('');
  });

  it('persists and retrieves AI configuration to/from localStorage', () => {
    const config: AIConfig = {
      provider: 'claude',
      apiKey: 'sk-ant-test-key-1234',
      apiUrl: 'https://api.anthropic.com/v1',
      isConnected: true
    };

    saveAIConfig(config);
    const retrieved = getSavedAIConfig();
    expect(retrieved.provider).toBe('claude');
    expect(retrieved.apiKey).toBe('sk-ant-test-key-1234');
    expect(retrieved.isConnected).toBe(true);

    clearAIConfig();
    expect(getSavedAIConfig().isConnected).toBe(false);
  });
});

describe('AIConnectModal UI Component', () => {
  const mockOnConnect = vi.fn();
  const mockOnDisconnect = vi.fn();
  const mockOnClose = vi.fn();
  const mockOnTestConnection = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders admin connect view with provider dropdown, API key input, SHOW toggle, and hints', () => {
    const initialConfig: AIConfig = {
      provider: 'openai',
      apiKey: '',
      apiUrl: '',
      isConnected: false
    };

    render(
      <AIConnectModal
        isOpen={true}
        onClose={mockOnClose}
        aiConfig={initialConfig}
        isAdmin={true}
        onConnect={mockOnConnect}
        onDisconnect={mockOnDisconnect}
        onTestConnection={mockOnTestConnection}
      />
    );

    expect(screen.getByText('Connect your AI')).toBeInTheDocument();
    expect(screen.getByText('Bring your own API key.')).toBeInTheDocument();
    expect(screen.getByText('PROVIDER')).toBeInTheDocument();
    expect(screen.getByText('MODEL')).toBeInTheDocument();
    expect(screen.getByText('API KEY')).toBeInTheDocument();
    expect(screen.getByText(/Your key is tested first/i)).toBeInTheDocument();
    expect(screen.getByText(/Secure & private/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Connect/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Show API key/i })).toBeInTheDocument();
  });

  it('allows customizing model input field and passes it on submit', () => {
    const initialConfig: AIConfig = {
      provider: 'openai',
      apiKey: '',
      apiUrl: '',
      isConnected: false
    };

    render(
      <AIConnectModal
        isOpen={true}
        onClose={mockOnClose}
        aiConfig={initialConfig}
        isAdmin={true}
        onConnect={mockOnConnect}
        onDisconnect={mockOnDisconnect}
        onTestConnection={mockOnTestConnection}
      />
    );

    const modelInput = screen.getByLabelText(/MODEL/i) as HTMLInputElement;
    expect(modelInput.value).toBe('gpt-4o-mini');

    fireEvent.change(modelInput, { target: { value: 'gpt-4o' } });

    const keyInput = screen.getByPlaceholderText(/sk-proj-/i);
    fireEvent.change(keyInput, { target: { value: 'sk-proj-test-key-1234' } });

    const connectBtn = screen.getByRole('button', { name: /Connect/i });
    fireEvent.click(connectBtn);

    expect(mockOnConnect).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'openai',
        model: 'gpt-4o',
        apiKey: 'sk-proj-test-key-1234',
        isConnected: true
      })
    );
  });

  it('toggles password visibility when SHOW / HIDE button is clicked', () => {
    const initialConfig: AIConfig = {
      provider: 'openai',
      apiKey: 'sk-test-1234',
      apiUrl: '',
      isConnected: false
    };

    render(
      <AIConnectModal
        isOpen={true}
        onClose={mockOnClose}
        aiConfig={initialConfig}
        isAdmin={true}
        onConnect={mockOnConnect}
        onDisconnect={mockOnDisconnect}
        onTestConnection={mockOnTestConnection}
      />
    );

    const keyInput = screen.getByPlaceholderText(/sk-proj-/i) as HTMLInputElement;
    expect(keyInput.type).toBe('password');

    const toggleBtn = screen.getByRole('button', { name: /Show API key/i });
    fireEvent.click(toggleBtn);

    expect(keyInput.type).toBe('text');
    expect(screen.getByText('HIDE')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Hide API key/i }));
    expect(keyInput.type).toBe('password');
    expect(screen.getByText('SHOW')).toBeInTheDocument();
  });

  it('reveals custom API URL input when "Custom" provider is selected', () => {
    const initialConfig: AIConfig = {
      provider: 'openai',
      apiKey: '',
      apiUrl: '',
      isConnected: false
    };

    render(
      <AIConnectModal
        isOpen={true}
        onClose={mockOnClose}
        aiConfig={initialConfig}
        isAdmin={true}
        onConnect={mockOnConnect}
        onDisconnect={mockOnDisconnect}
        onTestConnection={mockOnTestConnection}
      />
    );

    expect(screen.queryByLabelText(/API URL/i)).not.toBeInTheDocument();

    const providerSelect = screen.getByLabelText(/PROVIDER/i);
    fireEvent.change(providerSelect, { target: { value: 'custom' } });

    expect(screen.getByLabelText(/API URL/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('https://api.together.xyz/v1')).toBeInTheDocument();
  });

  it('submits form and calls onConnect with trimmed key and provider', () => {
    const initialConfig: AIConfig = {
      provider: 'openai',
      apiKey: '',
      apiUrl: '',
      isConnected: false
    };

    render(
      <AIConnectModal
        isOpen={true}
        onClose={mockOnClose}
        aiConfig={initialConfig}
        isAdmin={true}
        onConnect={mockOnConnect}
        onDisconnect={mockOnDisconnect}
        onTestConnection={mockOnTestConnection}
      />
    );

    const keyInput = screen.getByPlaceholderText(/sk-proj-/i);
    fireEvent.change(keyInput, { target: { value: 'sk-proj-abc1234567890a82f  ' } });

    const connectBtn = screen.getByRole('button', { name: /Connect/i });
    fireEvent.click(connectBtn);

    expect(mockOnConnect).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'openai',
        apiKey: 'sk-proj-abc1234567890a82f',
        isConnected: true
      })
    );
  });

  it('transforms card to Connected view for admin, displaying masked key and Change / Test connection actions', async () => {
    const connectedConfig: AIConfig = {
      provider: 'openai',
      apiKey: '',
      maskedApiKey: '••••••••••••••••••••••a82f',
      apiUrl: 'https://api.openai.com/v1',
      isConnected: true
    };

    render(
      <AIConnectModal
        isOpen={true}
        onClose={mockOnClose}
        aiConfig={connectedConfig}
        isAdmin={true}
        onConnect={mockOnConnect}
        onDisconnect={mockOnDisconnect}
        onTestConnection={mockOnTestConnection}
      />
    );

    expect(screen.getByText('OpenAI')).toBeInTheDocument();
    expect(screen.getByText(/Connected/i)).toBeInTheDocument();
    expect(screen.getByText('••••••••••••••••••••••a82f')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Change/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Test connection/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Disconnect/i })).toBeInTheDocument();
  });

  it('renders read-only card for non-admin users with masked key and no edit buttons', () => {
    const connectedConfig: AIConfig = {
      provider: 'openai',
      apiKey: '',
      maskedApiKey: '••••••••••••••••••••••a82f',
      apiUrl: 'https://api.openai.com/v1',
      isConnected: true
    };

    render(
      <AIConnectModal
        isOpen={true}
        onClose={mockOnClose}
        aiConfig={connectedConfig}
        isAdmin={false}
        onConnect={mockOnConnect}
        onDisconnect={mockOnDisconnect}
        onTestConnection={mockOnTestConnection}
      />
    );

    expect(screen.getByText('OpenAI')).toBeInTheDocument();
    expect(screen.getByText(/Connected/i)).toBeInTheDocument();
    expect(screen.getByText('••••••••••••••••••••••a82f')).toBeInTheDocument();
    expect(screen.getByText(/Read-only view/i)).toBeInTheDocument();

    // No edit or test action buttons for regular users
    expect(screen.queryByRole('button', { name: /Change/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Test connection/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Disconnect/i })).not.toBeInTheDocument();
  });

  it('renders read-only unconfigured notice for non-admin users when AI is not configured', () => {
    const unconfiguredConfig: AIConfig = {
      provider: 'openai',
      apiKey: '',
      maskedApiKey: '',
      apiUrl: '',
      isConnected: false
    };

    render(
      <AIConnectModal
        isOpen={true}
        onClose={mockOnClose}
        aiConfig={unconfiguredConfig}
        isAdmin={false}
        onConnect={mockOnConnect}
        onDisconnect={mockOnDisconnect}
        onTestConnection={mockOnTestConnection}
      />
    );

    expect(screen.getByText('AI Not Configured')).toBeInTheDocument();
    expect(screen.getByText(/Please contact an administrator to connect an AI provider/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Connect/i })).not.toBeInTheDocument();
  });
});

describe('Navbar and App AI Integration', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(api.getMe).mockResolvedValue({ user: { id: 1, username: 'adminuser', isAdmin: true } });
    vi.mocked(api.getAuthStatus).mockResolvedValue({ initialized: true });
    vi.mocked(api.fetchBookmarks).mockResolvedValue([]);
    vi.mocked(api.fetchTags).mockResolvedValue([]);
    vi.mocked(api.fetchAIConfig).mockResolvedValue({
      isConnected: true,
      provider: 'openai',
      maskedApiKey: '••••••••••••••••••••••a82f',
      apiUrl: 'https://api.openai.com/v1',
      lastTestedAt: new Date().toISOString(),
      isAdmin: true
    });
  });

  it('renders AI button in desktop toolbar and opens modal on click', async () => {
    render(<App />);

    const aiButton = screen.getByRole('button', { name: /Connect AI/i });
    expect(aiButton).toBeInTheDocument();

    fireEvent.click(aiButton);

    await waitFor(() => {
      expect(screen.getByText('OpenAI')).toBeInTheDocument();
      expect(screen.getByText('••••••••••••••••••••••a82f')).toBeInTheDocument();
    });
  });

  it('renders AI option in mobile overflow menu', async () => {
    render(<App />);

    const moreBtn = screen.getByTitle('More actions');
    fireEvent.click(moreBtn);

    await waitFor(() => {
      expect(screen.getByText(/AI/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/AI/i));

    await waitFor(() => {
      expect(screen.getByText('OpenAI')).toBeInTheDocument();
    });
  });
});

describe('BookmarkCard AI Auto-Tag Action', () => {
  it('renders "Auto-tag with AI" in card dropdown menu and invokes onAutoTag on click', async () => {
    const mockBookmark = {
      id: 42,
      user_id: 1,
      url: 'https://example.com/3d-printer',
      title: 'Bambu Lab X1-Carbon',
      description: 'High-speed 3D printing guide',
      content_type: 'website' as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tags: []
    };

    const mockOnAutoTag = vi.fn().mockResolvedValue(undefined);
    const { BookmarkCard } = await import('../components/BookmarkCard');

    render(
      <BookmarkCard
        bookmark={mockBookmark}
        onOpenReader={vi.fn()}
        onShare={vi.fn()}
        onEdit={vi.fn()}
        onRescrape={vi.fn()}
        onAutoTag={mockOnAutoTag}
        onDelete={vi.fn()}
        onTagClick={vi.fn()}
      />
    );

    // Click More actions button
    const moreBtn = screen.getByRole('button', { name: /More actions/i });
    fireEvent.click(moreBtn);

    // Look for Auto-tag with AI button
    const autoTagBtn = screen.getByText('Auto-tag with AI');
    expect(autoTagBtn).toBeInTheDocument();

    fireEvent.click(autoTagBtn);
    expect(mockOnAutoTag).toHaveBeenCalledWith(42);
  });
});
