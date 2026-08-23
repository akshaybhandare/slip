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
  } catch {
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
  } catch {
    // Fail silently
  }
  return '1.1.0';
}

export async function sendHeartbeat(): Promise<void> {
  if (isTelemetryDisabled()) {
    return;
  }

  try {
    const instanceId = getInstanceId();
    const version = getAppVersion();
    const osType = os.platform();

    // Hash the instance_id locally for pseudonymous privacy
    const hashedId = crypto.createHash('sha256').update(instanceId).digest('hex');

    let url = process.env.SUPABASE_URL || getDbSetting('supabase_url');
    const key = process.env.SUPABASE_KEY || getDbSetting('supabase_key');

    if (!url || !key) {
      return; // Fail silently if not configured
    }

    // Strip trailing slash if present
    url = url.replace(/\/$/, '');

    // Direct Supabase PostgREST table endpoint
    const endpoint = `${url}/rest/v1/telemetry_pings`;

    await axios.post(
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
  } catch (error) {
    // Fail completely silently without blocking the main application
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
    } catch {
      // Fail silently
    }
    scheduleNextHeartbeat();
  }, delay);
}

export function startTelemetry(): void {
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  // Trigger once at startup
  sendHeartbeat().catch(() => {});

  // Schedule every 24 hours with random jitter
  scheduleNextHeartbeat();
}
