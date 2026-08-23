import axios from 'axios';
import { sendHeartbeat, startTelemetry } from '../services/telemetryService';

jest.mock('axios', () => ({ post: jest.fn() }));

let mockSlipsCount = 0;
let mockClipsCount = 0;
const mockSettings = new Map<string, string>();

jest.mock('../db', () => ({
  getDb: () => ({
    prepare: (sql: string) => ({
      get: (key?: string) => {
        if (sql.includes('FROM bookmarks')) {
          return { count: mockSlipsCount };
        }
        if (sql.includes('FROM clips')) {
          return { count: mockClipsCount };
        }
        if (sql.startsWith('SELECT') && key && mockSettings.has(key)) {
          return { value: mockSettings.get(key) };
        }
        return undefined;
      },
      run: (key: string, value?: string) => {
        if (sql.startsWith('DELETE')) mockSettings.delete(key);
        else if (value !== undefined) mockSettings.set(key, value);
      },
    }),
  }),
  closeDb: jest.fn(),
}));

const mockedPost = axios.post as jest.MockedFunction<typeof axios.post>;

describe('telemetry heartbeat safeguards', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    delete process.env.DISABLE_TELEMETRY;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_KEY;
    mockSettings.clear();
    mockSlipsCount = 0;
    mockClipsCount = 0;
    mockedPost.mockReset();
  });

  afterEach(() => {
    mockSettings.clear();
  });

  test('does not send when disabled by environment', async () => {
    process.env.DISABLE_TELEMETRY = 'true';

    await expect(sendHeartbeat()).resolves.toBeUndefined();
    expect(mockedPost).not.toHaveBeenCalled();
  });

  test('does not send when disabled in database settings', async () => {
    mockSettings.set('disable_telemetry', 'true');

    await expect(sendHeartbeat()).resolves.toBeUndefined();
    expect(mockedPost).not.toHaveBeenCalled();
  });

  test('swallows heartbeat network failures', async () => {
    mockedPost.mockRejectedValueOnce(new Error('network unavailable'));

    await expect(sendHeartbeat()).resolves.toBeUndefined();
  });

  test('sends heartbeat with slips, clips, and AI usage metrics', async () => {
    mockSlipsCount = 42;
    mockClipsCount = 7;
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_KEY = 'test-key';
    mockSettings.set(
      'ai_config',
      JSON.stringify({ is_connected: true, encrypted_api_key: 'encrypted:secret' })
    );

    mockedPost.mockResolvedValueOnce({ status: 201 });

    await sendHeartbeat();

    expect(mockedPost).toHaveBeenCalledTimes(1);
    const [endpoint, payload, config] = mockedPost.mock.calls[0];
    expect(endpoint).toBe('https://test.supabase.co/rest/v1/telemetry_pings');
    expect(payload).toMatchObject({
      slips_count: 42,
      clips_count: 7,
      is_ai_enabled: true,
      version: expect.any(String),
      os_type: expect.any(String),
      instance_id: expect.any(String),
      last_ping_at: expect.any(String),
    });
    expect(config?.headers).toHaveProperty('Authorization', 'Bearer test-key');
    expect(config?.headers).toHaveProperty('apikey', 'test-key');
  });

  test('sends is_ai_enabled as false when AI is not connected', async () => {
    mockSlipsCount = 10;
    mockClipsCount = 2;
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_KEY = 'test-key';
    // AI config missing or not connected
    mockSettings.set('ai_config', JSON.stringify({ is_connected: false }));

    mockedPost.mockResolvedValueOnce({ status: 201 });

    await sendHeartbeat();

    expect(mockedPost).toHaveBeenCalledTimes(1);
    const [, payload] = mockedPost.mock.calls[0];
    expect(payload).toMatchObject({
      slips_count: 10,
      clips_count: 2,
      is_ai_enabled: false,
    });
  });

  test('does not schedule timers in test mode', () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

    startTelemetry();

    expect(setTimeoutSpy).not.toHaveBeenCalled();
    setTimeoutSpy.mockRestore();
  });
});
