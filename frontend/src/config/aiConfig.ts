export type AIProviderId = 'openai' | 'claude' | 'gemini' | 'custom';

export interface AIProviderDefinition {
  id: AIProviderId;
  name: string;
  defaultApiUrl: string;
  defaultModel: string;
  modelPlaceholder: string;
  keyPlaceholder: string;
  description: string;
}

export const AI_PROVIDERS: Record<AIProviderId, AIProviderDefinition> = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    defaultApiUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    modelPlaceholder: 'e.g. gpt-4o-mini, gpt-4o, gpt-3.5-turbo',
    keyPlaceholder: 'sk-proj-...',
    description: 'GPT-4o, GPT-4, and OpenAI compatible models'
  },
  claude: {
    id: 'claude',
    name: 'Claude',
    defaultApiUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-5-haiku-20241022',
    modelPlaceholder: 'e.g. claude-3-5-haiku-20241022, claude-3-5-sonnet-20241022',
    keyPlaceholder: 'sk-ant-...',
    description: 'Claude 3.5 Sonnet, Claude 3 Opus, and Anthropic models'
  },
  gemini: {
    id: 'gemini',
    name: 'Gemini',
    defaultApiUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: 'gemini-2.5-flash',
    modelPlaceholder: 'e.g. gemini-2.5-flash, gemini-2.0-flash, gemini-1.5-flash',
    keyPlaceholder: 'AIzaSy...',
    description: 'Gemini 2.5 Flash, 2.0 Flash, and Google AI models'
  },
  custom: {
    id: 'custom',
    name: 'Custom',
    defaultApiUrl: '',
    defaultModel: 'default',
    modelPlaceholder: 'e.g. llama3, mistral, gpt-4o, etc.',
    keyPlaceholder: 'Enter your API key (if required)',
    description: 'Ollama, LocalAI, Together AI, Groq, or self-hosted endpoint'
  }
};

export interface AIConfig {
  provider: AIProviderId;
  model?: string;
  apiKey: string;
  maskedApiKey?: string;
  apiUrl?: string;
  isConnected: boolean;
  lastTestedAt?: string;
  isAdmin?: boolean;
}

export const STORAGE_KEY_AI_CONFIG = 'slip_ai_config';

export function getSavedAIConfig(): AIConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_AI_CONFIG);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && parsed.provider) {
        const provider: AIProviderId = parsed.provider in AI_PROVIDERS ? parsed.provider : 'openai';
        return {
          provider,
          model: parsed.model || AI_PROVIDERS[provider].defaultModel,
          apiKey: parsed.apiKey || '',
          maskedApiKey: parsed.maskedApiKey || '',
          apiUrl: parsed.apiUrl || '',
          isConnected: Boolean(parsed.isConnected),
          lastTestedAt: parsed.lastTestedAt,
          isAdmin: parsed.isAdmin
        };
      }
    }
  } catch {
    // Ignore localStorage errors
  }
  return {
    provider: 'openai',
    model: 'gpt-4o-mini',
    apiKey: '',
    maskedApiKey: '',
    apiUrl: '',
    isConnected: false
  };
}

export function saveAIConfig(config: AIConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY_AI_CONFIG, JSON.stringify(config));
  } catch {
    // Ignore localStorage errors
  }
}

export function clearAIConfig(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_AI_CONFIG);
  } catch {
    // Ignore localStorage errors
  }
}

export function maskApiKey(apiKey: string): string {
  if (!apiKey) return '';
  const trimmed = apiKey.trim();
  if (trimmed.includes('••••')) return trimmed;
  return '••••••••••••••••••••••' + trimmed.slice(-4);
}

