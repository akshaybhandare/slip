import axios from 'axios';
import { sendHeartbeat, startTelemetry } from '../services/telemetryService';

jest.mock('axios', () => ({ post: jest.fn() }));

const mockSettings = new Map<string, string>();
jest.mock('../db', () => ({
  getDb: () => ({
    prepare: (sql: string) => ({
      get: (key: string) => sql.startsWith('SELECT') && mockSettings.has(key)
        ? { value: mockSettings.get(key) }
        : undefined,
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

  test('does not schedule timers in test mode', () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

    startTelemetry();

    expect(setTimeoutSpy).not.toHaveBeenCalled();
    setTimeoutSpy.mockRestore();
  });
});
