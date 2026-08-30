import path from 'path';
import os from 'os';
import fs from 'fs';
import dotenv from 'dotenv';

// Project root directory (backend's parent in repo structure)
const projectRoot = path.resolve(__dirname, '../..');

/**
 * 1. Base Installation Directory:
 * - process.env.SLIP_DIR / process.env.SLIP_HOME takes highest precedence.
 * - Otherwise defaults to ~/.slip (or %USERPROFILE%\.slip on Windows).
 */
export function getSlipDir(): string {
  const custom = process.env.SLIP_DIR || process.env.SLIP_HOME;
  if (custom && custom.trim() !== '') {
    return path.isAbsolute(custom) ? custom : path.resolve(process.cwd(), custom);
  }
  return path.join(os.homedir(), '.slip');
}

/**
 * 2. Load environment configuration:
 * - Checks local repo .env
 * - Checks <SLIP_DIR>/slip.env or <SLIP_DIR>/.env
 */
export function loadSlipEnv(): void {
  const repoEnv = path.resolve(projectRoot, '.env');
  if (fs.existsSync(repoEnv)) {
    dotenv.config({ path: repoEnv });
  }

  const slipDir = getSlipDir();
  const slipCustomEnv = path.join(slipDir, 'slip.env');
  const slipDotEnv = path.join(slipDir, '.env');

  if (fs.existsSync(slipCustomEnv)) {
    dotenv.config({ path: slipCustomEnv });
  } else if (fs.existsSync(slipDotEnv)) {
    dotenv.config({ path: slipDotEnv });
  }
}

// Automatically load env on import
loadSlipEnv();

/**
 * 3. Database Path Resolution:
 * Precedence:
 *  1. In-memory if test environment (:memory:)
 *  2. Explicit process.env.DB_PATH (e.g. /config/bookmarks.db in Docker/Unraid)
 *  3. Explicit SLIP_DIR set -> <SLIP_DIR>/data/bookmarks.db
 *  4. In repo development fallback -> <projectRoot>/backend/db/bookmarks.db or <projectRoot>/bookmarks.db
 *  5. Default standalone -> ~/.slip/data/bookmarks.db
 */
export function getResolvedDbPath(): string {
  if (process.env.NODE_ENV === 'test' && !process.env.TEST_DB_PATH) {
    return ':memory:';
  }

  if (process.env.DB_PATH && process.env.DB_PATH.trim() !== '') {
    const raw = process.env.DB_PATH;
    return path.isAbsolute(raw) ? raw : path.resolve(projectRoot, raw);
  }

  if (process.env.SLIP_DIR || process.env.SLIP_HOME) {
    return path.join(getSlipDir(), 'data', 'bookmarks.db');
  }

  // If running directly inside development repository
  const repoDbCandidate = path.resolve(projectRoot, 'backend/db/bookmarks.db');
  const rootDbCandidate = path.resolve(projectRoot, 'bookmarks.db');
  if (fs.existsSync(repoDbCandidate)) return repoDbCandidate;
  if (fs.existsSync(rootDbCandidate)) return rootDbCandidate;

  // Standalone default
  return path.join(getSlipDir(), 'data', 'bookmarks.db');
}

/**
 * 4. Thumbnail & Scraper Cache Directory Resolution:
 * Precedence:
 *  1. Explicit process.env.CACHE_DIR (e.g. /config/cache in Docker/Unraid)
 *  2. Explicit SLIP_DIR set -> <SLIP_DIR>/data/cache
 *  3. In repo development fallback -> <projectRoot>/backend/data/cache
 *  4. Default standalone -> ~/.slip/data/cache
 */
export function getResolvedCacheDir(): string {
  if (process.env.CACHE_DIR && process.env.CACHE_DIR.trim() !== '') {
    const raw = process.env.CACHE_DIR;
    return path.isAbsolute(raw) ? raw : path.resolve(projectRoot, raw);
  }

  if (process.env.SLIP_DIR || process.env.SLIP_HOME) {
    return path.join(getSlipDir(), 'data', 'cache');
  }

  // If in repo
  const repoCacheCandidate = path.resolve(projectRoot, 'backend/data/cache');
  if (fs.existsSync(path.dirname(repoCacheCandidate))) {
    return repoCacheCandidate;
  }

  return path.join(getSlipDir(), 'data', 'cache');
}

/**
 * 4.5 Embedding Models Directory Resolution:
 * Precedence:
 *  1. Explicit process.env.MODELS_DIR (e.g. /app/models or /config/cache/models)
 *  2. Default: <CACHE_DIR>/models
 */
export function getResolvedModelsDir(): string {
  if (process.env.MODELS_DIR && process.env.MODELS_DIR.trim() !== '') {
    const raw = process.env.MODELS_DIR;
    return path.isAbsolute(raw) ? raw : path.resolve(projectRoot, raw);
  }
  return path.join(getResolvedCacheDir(), 'models');
}

/**
 * 5. Frontend Static Dist Directory Resolution:
 * Precedence:
 *  1. Explicit process.env.FRONTEND_DIST (e.g. /app/frontend/dist in Docker)
 *  2. Bundled relative to binary / package (e.g. ./frontend/dist or ../frontend/dist)
 *  3. Repo fallback -> <projectRoot>/frontend/dist
 */
export function getResolvedFrontendDist(): string {
  if (process.env.FRONTEND_DIST && process.env.FRONTEND_DIST.trim() !== '') {
    const raw = process.env.FRONTEND_DIST;
    return path.isAbsolute(raw) ? raw : path.resolve(projectRoot, raw);
  }

  const candidates = [
    path.resolve(__dirname, '../../frontend/dist'),
    path.resolve(__dirname, '../frontend/dist'),
    path.resolve(projectRoot, 'frontend/dist'),
    path.resolve(getSlipDir(), 'frontend/dist'),
    path.resolve(process.cwd(), 'frontend/dist')
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.existsSync(path.join(candidate, 'index.html'))) {
      return candidate;
    }
  }

  return path.resolve(projectRoot, 'frontend/dist');
}

/**
 * 6. PID and Log file paths
 */
export function getSlipPidPath(): string {
  return process.env.SLIP_PID_FILE || path.join(getSlipDir(), '.slip.pid');
}

export function getSlipLogDir(): string {
  return process.env.SLIP_LOG_DIR || path.join(getSlipDir(), 'logs');
}

/**
 * Ensure directory exists safely
 */
export function ensureDirSync(dirPath: string): void {
  if (dirPath && dirPath !== ':memory:' && !fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}
