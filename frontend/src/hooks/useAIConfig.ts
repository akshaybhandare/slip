import { useState, useEffect, useCallback } from 'react';
import {
  AIConfig,
  getSavedAIConfig,
  saveAIConfig,
  clearAIConfig
} from '../config/aiConfig';
import {
  fetchAIConfig,
  saveAIConfigApi,
  disconnectAIConfigApi,
  testAIConnectionApi
} from '../api';

export function useAIConfig(user?: { id: number; username: string; isAdmin?: boolean } | null) {
  const [aiConfig, setAiConfig] = useState<AIConfig>(getSavedAIConfig);
  const [loading, setLoading] = useState(false);

  // Sync from backend DB on mount / when user logs in
  useEffect(() => {
    let isMounted = true;
    if (user) {
      setLoading(true);
      fetchAIConfig()
        .then((remote) => {
          if (isMounted) {
            const updated: AIConfig = {
              provider: remote.provider,
              model: remote.model,
              apiKey: '', // Plaintext key is securely stored only in server DB, never stored in client localStorage
              maskedApiKey: remote.maskedApiKey,
              apiUrl: remote.apiUrl,
              isConnected: remote.isConnected,
              lastTestedAt: remote.lastTestedAt || undefined,
              isAdmin: remote.isAdmin
            };
            setAiConfig(updated);
            saveAIConfig(updated);
          }
        })
        .catch(() => {
          // If unauthenticated or backend error, retain local cached state
        })
        .finally(() => {
          if (isMounted) setLoading(false);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [user]);

  const updateConfig = useCallback((newConfig: Partial<AIConfig>) => {
    setAiConfig((prev) => {
      const updated = { ...prev, ...newConfig };
      saveAIConfig(updated);
      return updated;
    });
  }, []);

  const connect = useCallback(async (config: AIConfig): Promise<AIConfig> => {
    try {
      // Send to backend API where connection is tested FIRST before saving encrypted in DB
      const res = await saveAIConfigApi({
        provider: config.provider,
        apiKey: config.apiKey,
        apiUrl: config.apiUrl,
        model: config.model
      });

      const updated: AIConfig = {
        provider: res.config.provider,
        model: res.config.model,
        apiKey: '',
        maskedApiKey: res.config.maskedApiKey,
        apiUrl: res.config.apiUrl,
        isConnected: res.config.isConnected,
        lastTestedAt: res.config.lastTestedAt || new Date().toISOString(),
        isAdmin: true
      };

      setAiConfig(updated);
      saveAIConfig(updated);
      return updated;
    } catch (err: any) {
      // If error (e.g. connection test failed or network error), rethrow so UI displays banner
      throw err;
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      await disconnectAIConfigApi();
    } catch {
      // Fallback
    }
    const resetConfig: AIConfig = {
      provider: 'openai',
      model: 'gpt-4o-mini',
      apiKey: '',
      maskedApiKey: '',
      apiUrl: '',
      isConnected: false,
      isAdmin: user?.isAdmin || user?.id === 1
    };
    setAiConfig(resetConfig);
    clearAIConfig();
  }, [user]);

  const handleTestConnection = useCallback(async (config: AIConfig) => {
    try {
      return await testAIConnectionApi({
        provider: config.provider,
        apiKey: config.apiKey,
        apiUrl: config.apiUrl,
        model: config.model
      });
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Connection test failed.'
      };
    }
  }, []);

  return {
    aiConfig,
    loading,
    setAiConfig,
    updateConfig,
    connect,
    disconnect,
    testConnection: handleTestConnection
  };
}
