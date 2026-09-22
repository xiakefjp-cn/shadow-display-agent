import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';

export class CommandError extends Error {
  constructor(command, args, status, stderr, stdout) {
    super(`${command} ${args.join(' ')} failed (${status}): ${stderr || stdout}`.trim());
    this.name = 'CommandError';
    this.status = status;
    this.stderr = stderr;
    this.stdout = stdout;
  }
}

export function run(command, args = [], options = {}) {
  const result = spawnSync(command, args, {
    encoding: options.encoding ?? 'utf8',
    maxBuffer: options.maxBuffer ?? 16 * 1024 * 1024,
    windowsHide: true,
    ...options
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !options.allowFailure) {
    throw new CommandError(command, args, result.status, result.stderr?.toString().trim(), result.stdout?.toString().trim());
  }
  return result;
}

export function start(command, args = [], options = {}) {
  return spawn(command, args, {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options
  });
}

export function commandExists(command) {
  if ((command.includes('/') || command.includes('\\')) && fs.existsSync(command)) return true;
  const checker = process.platform === 'win32' ? 'where.exe' : 'which';
  return run(checker, [command], { allowFailure: true }).status === 0;
}

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
