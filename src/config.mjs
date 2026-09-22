import fs from 'node:fs';
import path from 'node:path';

export function loadDotEnv(file = '.env') {
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const split = line.indexOf('=');
    if (split < 1) continue;
    const key = line.slice(0, split).trim().replace(/^\uFEFF/, '');
    let value = line.slice(split + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function bool(name, fallback = false) {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function integer(name, fallback) {
  const value = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(value) ? value : fallback;
}

export function getConfig() {
  loadDotEnv();
  const artifactDir = path.resolve(process.env.AGENT_ARTIFACT_DIR || '.shadow-agent');
  return Object.freeze({
    adbPath: process.env.ADB_PATH || 'adb',
    scrcpyPath: process.env.SCRCPY_PATH || 'scrcpy',
    serial: process.env.ANDROID_SERIAL || '',
    displaySize: process.env.AGENT_DISPLAY_SIZE || '1080x2400',
    displayDpi: integer('AGENT_DISPLAY_DPI', 420),
    startComponent: process.env.AGENT_START_COMPONENT || '',
    appName: process.env.AGENT_APP_NAME || '',
    baseUrl: (process.env.PHONE_AGENT_BASE_URL || 'http://localhost:8000/v1').replace(/\/$/, ''),
    apiKey: process.env.PHONE_AGENT_API_KEY || 'EMPTY',
    model: process.env.PHONE_AGENT_MODEL || 'autoglm-phone-9b',
    maxSteps: integer('PHONE_AGENT_MAX_STEPS', 40),
    actionDelayMs: integer('AGENT_ACTION_DELAY_MS', 1200),
    allowMainDisplayCapture: bool('ALLOW_MAIN_DISPLAY_CAPTURE', false),
    observerAllowPackages: (process.env.HUMAN_OBSERVER_ALLOW_PACKAGES || '').split(',').map(item => item.trim()).filter(Boolean),
    artifactDir,
    demoApiUrl: (process.env.DEMO_API_URL || 'http://127.0.0.1:8787').replace(/\/$/, ''),
    demoApiToken: process.env.DEMO_API_TOKEN || 'demo-local-token'
  });
}

export function ensureArtifactDir(config) {
  fs.mkdirSync(config.artifactDir, { recursive: true });
}
