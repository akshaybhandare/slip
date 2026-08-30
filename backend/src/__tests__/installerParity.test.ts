import fs from 'fs';
import path from 'path';

describe('Installer & Uninstaller Cross-Platform Parity Contract', () => {
  const projectRoot = path.resolve(__dirname, '../../..');

  const installShPath = path.join(projectRoot, 'install.sh');
  const installPs1Path = path.join(projectRoot, 'install.ps1');
  const uninstallShPath = path.join(projectRoot, 'uninstall.sh');
  const uninstallPs1Path = path.join(projectRoot, 'uninstall.ps1');

  let installSh: string;
  let installPs1: string;
  let uninstallSh: string;
  let uninstallPs1: string;

  beforeAll(() => {
    expect(fs.existsSync(installShPath)).toBe(true);
    expect(fs.existsSync(installPs1Path)).toBe(true);
    expect(fs.existsSync(uninstallShPath)).toBe(true);
    expect(fs.existsSync(uninstallPs1Path)).toBe(true);

    installSh = fs.readFileSync(installShPath, 'utf-8');
    installPs1 = fs.readFileSync(installPs1Path, 'utf-8');
    uninstallSh = fs.readFileSync(uninstallShPath, 'utf-8');
    uninstallPs1 = fs.readFileSync(uninstallPs1Path, 'utf-8');
  });

  describe('1. Installers Parity (install.sh vs install.ps1)', () => {
    it('both use identical default port (3000)', () => {
      expect(installSh).toContain('DEFAULT_PORT="3000"');
      expect(installPs1).toContain('$DefaultPort = "3000"');
    });

    it('both use identical default base folder (.slip)', () => {
      expect(installSh).toMatch(/DEFAULT_DIR=.*\.slip/);
      expect(installPs1).toMatch(/\$DefaultDir =.*\.slip/);
    });

    it('both support custom SLIP_DIR environment variable', () => {
      expect(installSh).toContain('SLIP_DIR');
      expect(installPs1).toContain('$env:SLIP_DIR');
    });

    it('both support custom PORT environment variable', () => {
      expect(installSh).toContain('PORT');
      expect(installPs1).toContain('$env:PORT');
    });

    it('both create identical directory structure (bin, data/cache, logs)', () => {
      ['bin', 'data', 'cache', 'logs'].forEach((folder) => {
        expect(installSh).toContain(folder);
        expect(installPs1).toContain(folder);
      });
    });

    it('both generate identical slip.env configuration keys', () => {
      const expectedKeys = ['SLIP_DIR', 'PORT', 'HOST', 'DB_PATH', 'CACHE_DIR', 'SESSION_SECRET', 'NODE_ENV'];
      expectedKeys.forEach((key) => {
        expect(installSh).toContain(`${key}=`);
        expect(installPs1).toContain(`${key}=`);
      });
    });

    it('both support two-stage npm build and devDependency pruning in source fallback', () => {
      expect(installSh).toContain('--legacy-peer-deps');
      expect(installPs1).toContain('--legacy-peer-deps');
      expect(installSh).toContain('npm prune --omit=dev');
      expect(installPs1).toContain('npm prune --omit=dev');
    });

    it('both present identical CLI commands in help summary', () => {
      const expectedCommands = ['slip status', 'slip stop', 'slip start -d', 'slip logs', 'slip uninstall'];
      expectedCommands.forEach((cmd) => {
        expect(installSh).toContain(cmd);
        expect(installPs1).toContain(cmd);
      });
    });
  });

  describe('2. Uninstallers Parity (uninstall.sh vs uninstall.ps1)', () => {
    it('both support purge mode to completely eradicate data', () => {
      expect(uninstallSh).toContain('--purge');
      expect(uninstallPs1).toContain('Purge');
    });

    it('both prompt to preserve database and bookmarks by default', () => {
      expect(uninstallSh).toContain('KEEP your database');
      expect(uninstallPs1).toContain('KEEP your database');
    });

    it('both clean up identical files during non-purge uninstall', () => {
      const removedItems = ['bin', 'source', 'logs', 'slip.env', '.slip.pid'];
      removedItems.forEach((item) => {
        expect(uninstallSh).toContain(item);
        expect(uninstallPs1).toContain(item);
      });
    });
  });
});
