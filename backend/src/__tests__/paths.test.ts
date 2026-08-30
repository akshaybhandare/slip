import path from 'path';
import os from 'os';
import fs from 'fs';
import {
  getSlipDir,
  getResolvedDbPath,
  getResolvedCacheDir,
  getResolvedModelsDir,
  getResolvedFrontendDist,
  getSlipPidPath,
  getSlipLogDir,
  ensureDirSync
} from '../paths';

describe('Universal Paths Resolution & Precedence Architecture', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset env clones
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('1. getSlipDir', () => {
    it('returns custom directory when SLIP_DIR is set', () => {
      process.env.SLIP_DIR = '/custom/slip/folder';
      expect(getSlipDir()).toBe('/custom/slip/folder');
    });

    it('returns custom directory when SLIP_HOME is set', () => {
      delete process.env.SLIP_DIR;
      process.env.SLIP_HOME = '/opt/slip-home';
      expect(getSlipDir()).toBe('/opt/slip-home');
    });

    it('defaults to ~/.slip when no custom directory is set', () => {
      delete process.env.SLIP_DIR;
      delete process.env.SLIP_HOME;
      expect(getSlipDir()).toBe(path.join(os.homedir(), '.slip'));
    });
  });

  describe('2. getResolvedDbPath (Precedence & Zero-Regression on Docker/Unraid)', () => {
    it('returns :memory: in test mode by default', () => {
      process.env.NODE_ENV = 'test';
      delete process.env.TEST_DB_PATH;
      expect(getResolvedDbPath()).toBe(':memory:');
    });

    it('honors explicit DB_PATH (e.g. Unraid /config/bookmarks.db or Docker)', () => {
      process.env.NODE_ENV = 'production';
      process.env.DB_PATH = '/config/bookmarks.db';
      expect(getResolvedDbPath()).toBe('/config/bookmarks.db');
    });

    it('resolves relative DB_PATH against project root when explicitly provided', () => {
      process.env.NODE_ENV = 'production';
      process.env.DB_PATH = 'custom/test.db';
      const expected = path.resolve(__dirname, '../../..', 'custom/test.db');
      expect(getResolvedDbPath()).toBe(expected);
    });

    it('derives from SLIP_DIR when SLIP_DIR is provided and DB_PATH is not', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.DB_PATH;
      process.env.SLIP_DIR = '/var/lib/slip';
      expect(getResolvedDbPath()).toBe(path.join('/var/lib/slip', 'data', 'bookmarks.db'));
    });
  });

  describe('3. getResolvedCacheDir (Docker, Custom Dir, and Default)', () => {
    it('honors explicit CACHE_DIR (e.g. Unraid /config/cache or Docker)', () => {
      process.env.CACHE_DIR = '/config/cache';
      expect(getResolvedCacheDir()).toBe('/config/cache');
    });

    it('derives from SLIP_DIR when SLIP_DIR is provided and CACHE_DIR is not', () => {
      delete process.env.CACHE_DIR;
      process.env.SLIP_DIR = '/var/lib/slip';
      expect(getResolvedCacheDir()).toBe(path.join('/var/lib/slip', 'data', 'cache'));
    });
  });

  describe('3.5 getResolvedModelsDir (Default to <CACHE_DIR>/models)', () => {
    it('defaults to <CACHE_DIR>/models when MODELS_DIR is not set', () => {
      process.env.CACHE_DIR = '/config/cache';
      delete process.env.MODELS_DIR;
      expect(getResolvedModelsDir()).toBe('/config/cache/models');
    });

    it('honors explicit MODELS_DIR when set', () => {
      process.env.MODELS_DIR = '/custom/models/path';
      expect(getResolvedModelsDir()).toBe('/custom/models/path');
    });
  });

  describe('4. getResolvedFrontendDist (Docker vs Bundled vs Repo)', () => {
    it('honors explicit FRONTEND_DIST (e.g. /app/frontend/dist in Docker)', () => {
      process.env.FRONTEND_DIST = '/app/frontend/dist';
      expect(getResolvedFrontendDist()).toBe('/app/frontend/dist');
    });

    it('falls back gracefully to available dist directories', () => {
      delete process.env.FRONTEND_DIST;
      const resolved = getResolvedFrontendDist();
      expect(typeof resolved).toBe('string');
      expect(resolved.length).toBeGreaterThan(0);
    });
  });

  describe('5. getSlipPidPath and getSlipLogDir', () => {
    it('derives PID and log paths from SLIP_DIR', () => {
      process.env.SLIP_DIR = '/tmp/slip-test';
      expect(getSlipPidPath()).toBe(path.join('/tmp/slip-test', '.slip.pid'));
      expect(getSlipLogDir()).toBe(path.join('/tmp/slip-test', 'logs'));
    });
  });

  describe('6. ensureDirSync', () => {
    it('creates directory if it does not exist and ignores :memory:', () => {
      expect(() => ensureDirSync(':memory:')).not.toThrow();
      const testDir = path.join(os.tmpdir(), `slip-test-${Date.now()}`);
      expect(fs.existsSync(testDir)).toBe(false);
      ensureDirSync(testDir);
      expect(fs.existsSync(testDir)).toBe(true);
      // cleanup
      fs.rmdirSync(testDir);
    });
  });
});
