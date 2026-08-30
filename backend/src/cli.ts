#!/usr/bin/env node
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import {
  getSlipDir,
  getSlipPidPath,
  getSlipLogDir,
  getResolvedDbPath,
  ensureDirSync
} from './paths';
import { getAppVersion } from './config';

const slipDir = getSlipDir();
const pidFile = getSlipPidPath();
const logDir = getSlipLogDir();
const logFile = path.join(logDir, 'slip.log');

ensureDirSync(slipDir);
ensureDirSync(logDir);

const args = process.argv.slice(2);
const command = args[0] || 'start';

function getRunningPid(): number | null {
  if (fs.existsSync(pidFile)) {
    try {
      const pidStr = fs.readFileSync(pidFile, 'utf-8').trim();
      const pid = parseInt(pidStr, 10);
      if (!isNaN(pid)) {
        // Check if process is alive
        process.kill(pid, 0);
        return pid;
      }
    } catch {
      // Process is not alive, clean stale pid file
      try { fs.unlinkSync(pidFile); } catch {}
    }
  }
  return null;
}

function printHelp() {
  console.log(`
Slip CLI — A lightning-fast, self-hosted visual bookmark archive

Usage:
  slip [command] [options]

Commands:
  start        Start Slip server (foreground or background with -d)
  stop         Gracefully stop the running Slip background process
  restart      Restart Slip server
  status       Show current running status, port, and PID
  logs         Tail live server logs
  uninstall    Uninstall Slip application (with data preservation prompt)
  version      Display Slip version
  help         Show this help message

Options:
  -d, --daemon Run in background daemon mode
  -p, --port   Specify custom port (default: 3000 or SLIP_PORT)
  --dir        Specify custom installation directory
`);
}

function startServer(daemon = false, port?: string) {
  const existingPid = getRunningPid();
  if (existingPid) {
    console.log(`[Slip] Already running (PID: ${existingPid})`);
    return;
  }

  const serverEntry = path.join(__dirname, 'server.js');
  const env = { ...process.env };
  if (port) env.PORT = port;
  env.SLIP_DIR = slipDir;

  if (daemon) {
    const out = fs.openSync(logFile, 'a');
    const err = fs.openSync(logFile, 'a');

    const child = spawn(process.execPath, [serverEntry], {
      detached: true,
      stdio: ['ignore', out, err],
      env,
      cwd: slipDir
    });

    child.unref();
    fs.writeFileSync(pidFile, child.pid?.toString() || '');
    console.log(`[Slip] Started background daemon (PID: ${child.pid})`);
    console.log(`[Slip] Logs: ${logFile}`);
    console.log(`[Slip] Data: ${getResolvedDbPath()}`);
  } else {
    // Run in foreground
    require('./server');
  }
}

function stopServer(): Promise<boolean> {
  return new Promise((resolve) => {
    const pid = getRunningPid();
    if (!pid) {
      console.log('[Slip] Is not running.');
      resolve(true);
      return;
    }

    console.log(`[Slip] Stopping process (PID: ${pid})...`);
    try {
      process.kill(pid, 'SIGTERM');
      let checks = 0;
      const interval = setInterval(() => {
        checks++;
        try {
          process.kill(pid, 0);
          if (checks > 25) {
            // Force kill if graceful shutdown didn't finish
            process.kill(pid, 'SIGKILL');
            clearInterval(interval);
            try { fs.unlinkSync(pidFile); } catch {}
            console.log('[Slip] Stopped (force killed).');
            resolve(true);
          }
        } catch {
          // Process exited
          clearInterval(interval);
          try { fs.unlinkSync(pidFile); } catch {}
          console.log('[Slip] Stopped gracefully.');
          resolve(true);
        }
      }, 200);
    } catch (err: any) {
      console.log(`[Slip] Failed to stop process: ${err.message}`);
      resolve(false);
    }
  });
}

function showStatus() {
  const pid = getRunningPid();
  const version = getAppVersion();
  console.log(`\nSlip Status (v${version}):`);
  console.log(`  State:       ${pid ? `\x1b[32mRunning\x1b[0m (PID: ${pid})` : '\x1b[31mStopped\x1b[0m'}`);
  console.log(`  Directory:   ${slipDir}`);
  console.log(`  Database:    ${getResolvedDbPath()}`);
  console.log(`  Logs:        ${logFile}\n`);
}

function tailLogs() {
  if (!fs.existsSync(logFile)) {
    console.log(`[Slip] No log file found at ${logFile}`);
    return;
  }
  const tail = spawn('tail', ['-f', '-n', '50', logFile], { stdio: 'inherit' });
  process.on('SIGINT', () => {
    tail.kill();
    process.exit(0);
  });
}

async function handleUninstall() {
  await stopServer();
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  
  const isPurge = args.includes('--purge');
  if (isPurge) {
    console.log(`[Slip] Purging entire directory: ${slipDir}`);
    fs.rmSync(slipDir, { recursive: true, force: true });
    console.log('\x1b[32m[Slip] Completely uninstalled.\x1b[0m');
    process.exit(0);
  }

  rl.question(`Do you want to KEEP your database and bookmarks (${path.join(slipDir, 'data')})? [Y/n]: `, (answer) => {
    rl.close();
    const keep = !answer.trim().toLowerCase().startsWith('n');
    if (keep) {
      console.log('[Slip] Preserving database. Removing bin, logs, and config...');
      ['bin', 'logs', 'slip.env', '.slip.pid'].forEach((f) => {
        fs.rmSync(path.join(slipDir, f), { recursive: true, force: true });
      });
      console.log(`\x1b[32m[Slip] Application removed. Database preserved at ${path.join(slipDir, 'data')}\x1b[0m`);
    } else {
      console.log(`[Slip] Removing entire directory: ${slipDir}`);
      fs.rmSync(slipDir, { recursive: true, force: true });
      console.log('\x1b[32m[Slip] Completely uninstalled.\x1b[0m');
    }
  });
}

// Command dispatcher
async function main() {
  const daemonFlag = args.includes('-d') || args.includes('--daemon');
  const portIdx = args.findIndex((a) => a === '-p' || a === '--port');
  const customPort = portIdx !== -1 && args[portIdx + 1] ? args[portIdx + 1] : undefined;

  switch (command) {
    case 'start':
      startServer(daemonFlag, customPort);
      break;
    case 'stop':
      await stopServer();
      break;
    case 'restart':
      await stopServer();
      startServer(true, customPort);
      break;
    case 'status':
      showStatus();
      break;
    case 'logs':
      tailLogs();
      break;
    case 'uninstall':
      await handleUninstall();
      break;
    case 'version':
    case '-v':
    case '--version':
      console.log(`Slip v${getAppVersion()}`);
      break;
    case 'help':
    case '--help':
    case '-h':
      printHelp();
      break;
    default:
      console.log(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

if (require.main === module) {
  main();
}
