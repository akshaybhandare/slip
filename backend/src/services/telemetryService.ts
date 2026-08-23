import axios from 'axios';
import os from 'os';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { getDb } from '../db';
import { getInstanceId } from '../config';

function getDbSetting(key: string): string | null {
  try {
    const db = getDb();
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    return row ? row.value : null;
  } catch (err) {
    console.error(`[Telemetry] Failed to query setting '${key}' from database:`, err);
    return null;
  }
}

function isTelemetryDisabled(): boolean {
  if (process.env.DISABLE_TELEMETRY === 'true') {
    return true;
  }
  const dbSetting = getDbSetting('disable_telemetry');
  if (dbSetting === 'true') {
    return true;
  }
  return false;
}

function getAppVersion(): string {
  try {
    const packageJsonPath = path.resolve(__dirname, '../../package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      return packageJson.version || '1.1.0';
    }
  } catch (err) {
    console.error('[Telemetry] Failed to read package.json version:', err);
  }
  return '1.1.0';
}

const DEFAULT_SUPABASE_URL = 'https://aofeprsbrwuphmdhagud.supabase.co';
const DEFAULT_SUPABASE_KEY = 'sb_publishable_OT7XIHQtnkcaWSIa_bqGIQ_mNCovKwI';

export async function sendHeartbeat(): Promise<void> {
  if (isTelemetryDisabled()) {
    console.log('[Telemetry] Telemetry is opted-out/disabled.');
    return;
  }

  try {
    const instanceId = getInstanceId();
    const version = getAppVersion();
    const osType = os.platform();

    // Hash the instance_id locally for pseudonymous privacy
    const hashedId = crypto.createHash('sha256').update(instanceId).digest('hex');

    let url = process.env.SUPABASE_URL || getDbSetting('supabase_url') || DEFAULT_SUPABASE_URL;
    const key = process.env.SUPABASE_KEY || getDbSetting('supabase_key') || DEFAULT_SUPABASE_KEY;

    if (!url || !key) {
      console.log('[Telemetry] Supabase URL or Key not configured. Skipping heartbeat.');
      return;
    }

    // Strip trailing slash if present
    url = url.replace(/\/$/, '');

    // Direct Supabase PostgREST table endpoint
    const endpoint = `${url}/rest/v1/telemetry_pings`;

    console.log(`[Telemetry] Sending heartbeat ping to ${endpoint}...`);

    const response = await axios.post(
      endpoint,
      {
        instance_id: hashedId,
        version: version,
        os_type: osType,
        last_ping_at: new Date().toISOString()
      },
      {
        headers: {
          'Authorization': `Bearer ${key}`,
          'apikey': key,
          'Content-Type': 'application/json',
          // resolution=merge-duplicates does UPSERT on primary key (instance_id)
          // return=minimal avoids returning the updated row (removes the need for SELECT permissions)
          'Prefer': 'resolution=merge-duplicates, return=minimal'
        },
        timeout: 5000,
      }
    );

    console.log(`[Telemetry] Heartbeat successfully registered with Supabase (HTTP ${response.status}).`);
  } catch (error: any) {
    const errorDetails = error?.response
      ? { status: error.response.status, statusText: error.response.statusText, data: error.response.data }
      : (error?.message || error);
    console.error('[Telemetry] Failed to send heartbeat to Supabase:', errorDetails);
  }
}

function scheduleNextHeartbeat() {
  const baseInterval = 24 * 60 * 60 * 1000; // 24 hours
  const jitterRange = 30 * 60 * 1000; // 30 minutes
  const randomJitter = (Math.random() * 2 - 1) * jitterRange;
  const delay = Math.max(0, baseInterval + randomJitter);

  setTimeout(async () => {
    try {
      await sendHeartbeat();
    } catch (err) {
      console.error('[Telemetry] Error in scheduled heartbeat:', err);
    }
    scheduleNextHeartbeat();
  }, delay);
}

export function startTelemetry(): void {
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  // Trigger once at startup
  sendHeartbeat().catch((err) => {
    console.error('[Telemetry] Initial startup heartbeat failed:', err);
  });

  // Schedule every 24 hours with random jitter
  scheduleNextHeartbeat();
}
