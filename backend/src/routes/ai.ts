import { Router, Response } from 'express';
import { getDb } from '../db';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { encryptSecret, maskApiKey } from '../services/aiCrypto';
import { testProviderConnection, AIProviderId, KNOWN_AI_PROVIDERS, getActiveAIConfig } from '../services/aiService';

const router = Router();
const SETTINGS_KEY_AI_CONFIG = 'ai_config';

interface StoredAIConfig {
  provider: AIProviderId;
  encrypted_api_key: string;
  masked_api_key: string;
  api_url: string;
  model?: string;
  is_connected: boolean;
  last_tested_at: string;
}

// 1. GET /api/ai/config - Fetch active AI status (available to all authenticated users)
router.get('/config', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const isAdmin = user.id === 1;

  try {
    const db = getDb();
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(SETTINGS_KEY_AI_CONFIG) as { value: string } | undefined;

    if (!row || !row.value) {
      return res.status(200).json({
        isConnected: false,
        provider: 'openai',
        model: 'gpt-4o-mini',
        maskedApiKey: '',
        apiUrl: '',
        lastTestedAt: null,
        isAdmin
      });
    }

    const parsed: StoredAIConfig = JSON.parse(row.value);
    const provider: AIProviderId = (parsed.provider && parsed.provider in KNOWN_AI_PROVIDERS)
      ? (parsed.provider as AIProviderId)
      : 'openai';
    return res.status(200).json({
      isConnected: Boolean(parsed.is_connected),
      provider,
      model: parsed.model || KNOWN_AI_PROVIDERS[provider]?.defaultModel || 'gpt-4o-mini',
      maskedApiKey: parsed.masked_api_key || '',
      apiUrl: parsed.api_url || '',
      lastTestedAt: parsed.last_tested_at || null,
      isAdmin
    });
  } catch (err: any) {
    console.error('Failed to get AI config:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// 2. POST /api/ai/test - Test connection (Admin only)
router.post('/test', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  if (user.id !== 1) {
    return res.status(403).json({ message: 'Forbidden: Only administrators can configure AI settings' });
  }

  let { provider, apiKey, apiUrl, model } = req.body;
  const providerId: AIProviderId = (provider && provider in KNOWN_AI_PROVIDERS) ? (provider as AIProviderId) : 'openai';

  // If apiKey is omitted or placeholder, use stored active key
  if (!apiKey || apiKey.includes('••••')) {
    apiKey = getActiveAIConfig()?.apiKey || '';
  }

  const result = await testProviderConnection({
    provider: providerId,
    apiKey: apiKey || '',
    apiUrl: apiUrl || '',
    model: model || ''
  });

  return res.status(result.success ? 200 : 400).json(result);
});

// 3. POST /api/ai/config - Connect and safely store active API key in DB (Admin only, after connection test passes)
router.post('/config', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  if (user.id !== 1) {
    return res.status(403).json({ message: 'Forbidden: Only administrators can configure AI settings' });
  }

  let { provider, apiKey, apiUrl, model } = req.body;
  const providerId: AIProviderId = (provider && provider in KNOWN_AI_PROVIDERS) ? (provider as AIProviderId) : 'openai';
  const trimmedKey = (apiKey || '').trim();
  const trimmedUrl = (apiUrl || '').trim();
  const trimmedModel = (model || '').trim() || KNOWN_AI_PROVIDERS[providerId]?.defaultModel || 'default';

  // If key wasn't modified, reuse existing stored key
  let actualKeyToSave = trimmedKey;
  if (!actualKeyToSave || actualKeyToSave.includes('••••')) {
    actualKeyToSave = getActiveAIConfig()?.apiKey || '';
  }

  if (providerId !== 'custom' && !actualKeyToSave) {
    return res.status(400).json({ message: 'API key is required.' });
  }

  if (providerId === 'custom' && !trimmedUrl) {
    return res.status(400).json({ message: 'Custom API URL is required.' });
  }

  // Enforce rule: Test connection FIRST before saving!
  const testResult = await testProviderConnection({
    provider: providerId,
    apiKey: actualKeyToSave,
    apiUrl: trimmedUrl,
    model: trimmedModel
  });

  if (!testResult.success) {
    return res.status(400).json({
      message: `Connection test failed: ${testResult.message}. Configuration not saved.`
    });
  }

  try {
    const db = getDb();
    const encryptedKey = encryptSecret(actualKeyToSave);
    const maskedKey = maskApiKey(actualKeyToSave);
    const now = new Date().toISOString();

    const storedData: StoredAIConfig = {
      provider: providerId,
      encrypted_api_key: encryptedKey,
      masked_api_key: maskedKey,
      api_url: providerId === 'custom' ? trimmedUrl : (KNOWN_AI_PROVIDERS[providerId]?.defaultUrl || ''),
      model: trimmedModel,
      is_connected: true,
      last_tested_at: now
    };

    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
      SETTINGS_KEY_AI_CONFIG,
      JSON.stringify(storedData)
    );

    return res.status(200).json({
      message: 'AI provider connected and securely saved in database',
      config: {
        isConnected: true,
        provider: providerId,
        model: trimmedModel,
        maskedApiKey: maskedKey,
        apiUrl: storedData.api_url,
        lastTestedAt: now,
        isAdmin: true
      },
      testResult
    });
  } catch (err: any) {
    console.error('Failed to save AI configuration:', err);
    return res.status(500).json({ message: 'Failed to securely store AI configuration in database' });
  }
});

// 4. DELETE /api/ai/config - Disconnect AI and remove saved key (Admin only)
router.delete('/config', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  if (user.id !== 1) {
    return res.status(403).json({ message: 'Forbidden: Only administrators can disconnect AI settings' });
  }

  try {
    const db = getDb();
    db.prepare('DELETE FROM settings WHERE key = ?').run(SETTINGS_KEY_AI_CONFIG);

    return res.status(200).json({
      message: 'AI provider disconnected and active key removed successfully',
      config: {
        isConnected: false,
        provider: 'openai',
        model: 'gpt-4o-mini',
        maskedApiKey: '',
        apiUrl: '',
        lastTestedAt: null,
        isAdmin: true
      }
    });
  } catch (err: any) {
    console.error('Failed to delete AI configuration:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
