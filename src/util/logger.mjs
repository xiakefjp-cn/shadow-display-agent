import fs from 'node:fs';
import path from 'node:path';

function sanitize(value) {
  if (typeof value === 'string') {
    return value
      .replace(/(api[_-]?key|authorization|token)[=: ]+[^\s,}]+/gi, '$1=[REDACTED]')
      .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]');
  }
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, /key|token|secret|password/i.test(key) ? '[REDACTED]' : sanitize(item)]));
  }
  return value;
}

export class RunLogger {
  constructor(artifactDir, runId = `run-${new Date().toISOString().replace(/[:.]/g, '-')}`) {
    this.runId = runId;
    this.dir = path.join(artifactDir, runId);
    fs.mkdirSync(this.dir, { recursive: true });
    this.eventsFile = path.join(this.dir, 'events.jsonl');
  }

  event(type, data = {}) {
    const record = sanitize({ timestamp: new Date().toISOString(), type, ...data });
    fs.appendFileSync(this.eventsFile, `${JSON.stringify(record)}\n`);
    return record;
  }

  screenshotPath(step, scope = 'agent') {
    return path.join(this.dir, `${String(step).padStart(3, '0')}-${scope}.png`);
  }
}
