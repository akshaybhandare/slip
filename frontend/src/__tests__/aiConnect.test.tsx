import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { SettingsModal } from '../components/SettingsModal';
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
  smartSearchBookmarks: vi.fn(),
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
  disconnectAIConfigApi: vi.fn(),
  fetchPinConfig: vi.fn().mockResolvedValue({ maxPinnedSlips: 5 }),
  togglePinBookmark: vi.fn(),
  fetchRecycleClip: vi.fn().mockResolvedValue([]),
  fetchRecycleClips: vi.fn().mockResolvedValue([])
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

describe('SettingsModal AI Tab UI Component', () => {
  const mockOnClose = vi.fn();
  const mockOnConnect = vi.fn();
  const mockOnDisconnect = vi.fn();
  const mockOnTestConnection = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderSettingsAI = (config: AIConfig, userObj: any = { id: 1, username: 'admin', isAdmin: true }) => {
    return render(
      <SettingsModal
        isOpen={true}
        onClose={mockOnClose}
        initialTab="ai"
        user={userObj}
        themeMode="system"
        themePreset="default"
        customAccent={null}
        onSelectMode={vi.fn()}
        onSelectPreset={vi.fn()}
        onSetCustomAccent={vi.fn()}
        onResetTheme={vi.fn()}
        onImportClick={vi.fn()}
        onRescrapeAllClick={vi.fn()}
        isRescrapingAll={false}
        aiConfig={config}
        onConnectAI={mockOnConnect}
        onDisconnectAI={mockOnDisconnect}
        onTestAIConnection={mockOnTestConnection}
        onLogoutClick={vi.fn()}
      />
    );
  };

  it('renders admin connect view with provider dropdown, API key input, SHOW toggle, and hints', () => {
    const initialConfig: AIConfig = {
      provider: 'openai',
      apiKey: '',
      apiUrl: '',
      isConnected: false
    };

    renderSettingsAI(initialConfig);

    expect(screen.getByText('PROVIDER')).toBeInTheDocument();
    expect(screen.getByText('MODEL')).toBeInTheDocument();
    expect(screen.getByText('API KEY')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save & Connect AI/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Show API key/i })).toBeInTheDocument();
  });

  it('allows customizing model input field and passes it on submit', () => {
    const initialConfig: AIConfig = {
      provider: 'openai',
      apiKey: '',
      apiUrl: '',
      isConnected: false
    };

    renderSettingsAI(initialConfig);

    const modelInput = screen.getByLabelText(/MODEL/i) as HTMLInputElement;
    expect(modelInput.value).toBe('gpt-4o-mini');

    fireEvent.change(modelInput, { target: { value: 'gpt-4o' } });

    const keyInput = screen.getByPlaceholderText(/sk-proj-/i);
    fireEvent.change(keyInput, { target: { value: 'sk-proj-test-key-1234' } });

    const connectBtn = screen.getByRole('button', { name: /Save & Connect AI/i });
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

    renderSettingsAI(initialConfig);

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

    renderSettingsAI(initialConfig);

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

    renderSettingsAI(initialConfig);

    const keyInput = screen.getByPlaceholderText(/sk-proj-/i);
    fireEvent.change(keyInput, { target: { value: 'sk-proj-abc1234567890a82f  ' } });

    const connectBtn = screen.getByRole('button', { name: /Save & Connect AI/i });
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

    renderSettingsAI(connectedConfig);

    expect(screen.getByText('OpenAI')).toBeInTheDocument();
    expect(screen.getByText(/Active/i)).toBeInTheDocument();
    expect(screen.getByText(/Key: ••••••••••••••••••••••a82f/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Change Configuration/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Test Connection/i })).toBeInTheDocument();
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

    renderSettingsAI(connectedConfig, { id: 2, username: 'regularuser', isAdmin: false });

    expect(screen.getByText(/Connected \(OpenAI/i)).toBeInTheDocument();
    expect(screen.getByText('••••••••••••••••••••••a82f')).toBeInTheDocument();
    expect(screen.getByText(/Managed by system administrator/i)).toBeInTheDocument();

    // No edit or test action buttons for regular users
    expect(screen.queryByRole('button', { name: /Change Configuration/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Test Connection/i })).not.toBeInTheDocument();
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

    renderSettingsAI(unconfiguredConfig, { id: 2, username: 'regularuser', isAdmin: false });

    expect(screen.getByText(/AI capabilities have not been configured by an administrator yet/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Save & Connect AI/i })).not.toBeInTheDocument();
  });
});

describe('Settings and App AI Integration', () => {
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

  it('opens AI configuration directly inside consolidated Settings modal', async () => {
    render(<App />);

    const settingsBtn = await waitFor(() => screen.getByRole('button', { name: 'Settings' }));
    expect(settingsBtn).toBeInTheDocument();

    fireEvent.click(settingsBtn);

    const aiTab = screen.getByRole('button', { name: /AI & Models/i });
    fireEvent.click(aiTab);

    await waitFor(() => {
      expect(screen.getByText('OpenAI')).toBeInTheDocument();
      expect(screen.getByText(/••••••••••••••••••••••a82f/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Change Configuration/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Test Connection/i })).toBeInTheDocument();
    });
  });

  it('opens Settings modal from mobile menu and accesses AI tab', async () => {
    render(<App />);

    const moreBtn = screen.getByTitle('More actions');
    fireEvent.click(moreBtn);

    const settingsBtns = await waitFor(() => screen.getAllByRole('button', { name: /Settings/i }));
    expect(settingsBtns.length).toBeGreaterThan(0);

    fireEvent.click(settingsBtns[settingsBtns.length - 1]);

    const aiTab = screen.getByRole('button', { name: /AI & Models/i });
    fireEvent.click(aiTab);

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

describe('AI Smart Search UI & Interactions', () => {
  it('renders Smart Search toggle button in Navbar and toggles placeholder text', async () => {
    const { Navbar } = await import('../components/Navbar');
    const onSearchChange = vi.fn();
    const onToggleSmartSearch = vi.fn();

    const { rerender } = render(
      <Navbar
        searchQuery=""
        onSearchChange={onSearchChange}
        isSmartSearch={false}
        onToggleSmartSearch={onToggleSmartSearch}
        onAddClick={vi.fn()}
        onImportClick={vi.fn()}
        onRescrapeAllClick={vi.fn()}
        isRescrapingAll={false}
        onLogoutClick={vi.fn()}
        isAIConnected={true}
        user={{ id: 1, username: 'admin' }}
      />
    );

    // Standard search placeholder
    const input = screen.getByPlaceholderText('Search your archive & tags...');
    expect(input).toBeInTheDocument();

    const smartBtn = screen.getByRole('button', { name: /Toggle Smart Search/i });
    expect(smartBtn).toBeInTheDocument();
    expect(smartBtn).not.toHaveClass('active');

    fireEvent.click(smartBtn);
    expect(onToggleSmartSearch).toHaveBeenCalledTimes(1);

    // Rerender in active Smart Search mode
    rerender(
      <Navbar
        searchQuery=""
        onSearchChange={onSearchChange}
        isSmartSearch={true}
        onToggleSmartSearch={onToggleSmartSearch}
        onAddClick={vi.fn()}
        onImportClick={vi.fn()}
        onRescrapeAllClick={vi.fn()}
        isRescrapingAll={false}
        onLogoutClick={vi.fn()}
        isAIConnected={true}
        user={{ id: 1, username: 'admin' }}
      />
    );

    expect(screen.getByPlaceholderText(/Describe what you're looking for/i)).toBeInTheDocument();
    const activeSmartBtn = screen.getByRole('button', { name: /Toggle Smart Search/i });
    expect(activeSmartBtn).toHaveClass('active');
  });

  it('triggers onSearchSubmit when hitting Enter or clicking search button in Smart Search mode', async () => {
    const { Navbar } = await import('../components/Navbar');
    const onSearchChange = vi.fn();
    const onSearchSubmit = vi.fn();

    render(
      <Navbar
        searchQuery="article about Bambu printers clogging"
        onSearchChange={onSearchChange}
        onSearchSubmit={onSearchSubmit}
        isSmartSearch={true}
        onToggleSmartSearch={vi.fn()}
        onAddClick={vi.fn()}
        onImportClick={vi.fn()}
        onRescrapeAllClick={vi.fn()}
        isRescrapingAll={false}
        onLogoutClick={vi.fn()}
        isAIConnected={true}
        user={{ id: 1, username: 'admin' }}
      />
    );

    const input = screen.getByDisplayValue('article about Bambu printers clogging');
    
    // 1. Hit Enter key in input
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    expect(onSearchSubmit).toHaveBeenCalledTimes(1);

    // 2. Click the Search button
    const submitBtn = screen.getByRole('button', { name: /Search with AI/i });
    expect(submitBtn).toBeInTheDocument();
    fireEvent.click(submitBtn);
    expect(onSearchSubmit).toHaveBeenCalledTimes(2);
  });

  it('renders AI semantic match reason badge and score on BookmarkCard', async () => {
    const mockBookmark = {
      id: 99,
      user_id: 1,
      url: 'https://wiki.bambulab.com/en/x1/troubleshooting/nozzle-clog',
      title: 'Bambu Lab Extruder Jam & Hotend Maintenance Guide',
      description: 'Step-by-step troubleshooting guide for clearing filament clogs',
      content_type: 'article' as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      matchScore: 96,
      matchReason: 'Specifically covers troubleshooting Bambu Lab nozzle jams and filament clogging.'
    };

    const { BookmarkCard } = await import('../components/BookmarkCard');

    render(
      <BookmarkCard
        bookmark={mockBookmark}
        onOpenReader={vi.fn()}
        onShare={vi.fn()}
        onEdit={vi.fn()}
        onRescrape={vi.fn()}
        onDelete={vi.fn()}
        onTagClick={vi.fn()}
      />
    );

    const badge = screen.getByText('Specifically covers troubleshooting Bambu Lab nozzle jams and filament clogging.').closest('.card-ai-match-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).not.toHaveClass('ai-match-expanded');

    // Click to expand
    fireEvent.click(badge!);
    expect(badge).toHaveClass('ai-match-expanded');

    // Click again to collapse
    fireEvent.click(badge!);
    expect(badge).not.toHaveClass('ai-match-expanded');
  });

  it('hides Smart Search toggle button and enter search button when AI is disconnected', async () => {
    const { Navbar } = await import('../components/Navbar');

    render(
      <Navbar
        searchQuery="testing search"
        onSearchChange={vi.fn()}
        onSearchSubmit={vi.fn()}
        isSmartSearch={false}
        onToggleSmartSearch={vi.fn()}
        onAddClick={vi.fn()}
        onImportClick={vi.fn()}
        onRescrapeAllClick={vi.fn()}
        isRescrapingAll={false}
        onLogoutClick={vi.fn()}
        isAIConnected={false}
        user={{ id: 1, username: 'admin' }}
      />
    );

    // Smart search toggle button must NOT exist
    expect(screen.queryByRole('button', { name: /Toggle Smart Search/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Search with AI/i })).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search your archive & tags...')).toBeInTheDocument();
  });

  it('hides "Auto-tag with AI" option in BookmarkCard dropdown menu when isAIConnected is false', async () => {
    const mockBookmark = {
      id: 50,
      user_id: 1,
      url: 'https://example.com/item',
      title: 'Sample Item',
      description: 'Sample description',
      content_type: 'website' as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tags: []
    };

    const { BookmarkCard } = await import('../components/BookmarkCard');

    render(
      <BookmarkCard
        bookmark={mockBookmark}
        onOpenReader={vi.fn()}
        onShare={vi.fn()}
        onEdit={vi.fn()}
        onRescrape={vi.fn()}
        onAutoTag={vi.fn()}
        isAIConnected={false}
        onDelete={vi.fn()}
        onTagClick={vi.fn()}
      />
    );

    const moreBtn = screen.getByRole('button', { name: /More actions/i });
    fireEvent.click(moreBtn);

    // Auto-tag with AI should NOT be in the document
    expect(screen.queryByText(/Auto-tag with AI/i)).not.toBeInTheDocument();
  });


});
