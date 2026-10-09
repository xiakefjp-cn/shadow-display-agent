import fs from 'node:fs';
import { run } from '../infra/process.mjs';

function parseDisplayIds(text) {
  const ids = new Set([0]);
  const patterns = [
    /\bdisplayId[=: ]+(\d+)/gi,
    /\bmDisplayId[=: ]+(\d+)/gi,
    /\bDisplay\s+(\d+):/gi,
    /\bDisplay Id[=: ]+(\d+)/gi
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) ids.add(Number(match[1]));
  }
  return [...ids].filter(Number.isInteger).sort((a, b) => a - b);
}

function shellText(text) {
  // Android `input text` uses %s for spaces and is not Unicode safe.
  if (!/^[\x20-\x7E]*$/.test(text)) {
    throw new Error('Shell text injection only supports printable ASCII. Use an app-specific input adapter for Unicode.');
  }
  return text.replace(/%/g, '%25').replace(/ /g, '%s');
}

function parseSurfaceFlingerVirtualDisplayIds(text) {
  return [...text.matchAll(/\bDisplay\s+(\d+)\s+\(Virtual display\)/gi)]
    .map(match => match[1]);
}

export class AdbDevice {
  constructor({ adbPath = 'adb', serial = '' } = {}) {
    this.adbPath = adbPath;
    this.serial = serial;
  }

  args(args) {
    return this.serial ? ['-s', this.serial, ...args] : args;
  }

  exec(args, options = {}) {
    return run(this.adbPath, this.args(args), options);
  }

  shell(args, options = {}) {
    return this.exec(['shell', ...args.map(String)], options);
  }

  listDevices() {
    const output = this.exec(['devices', '-l']).stdout;
    return output.split(/\r?\n/).slice(1).filter(line => /\bdevice\b/.test(line)).map(line => line.trim());
  }

  getDisplayIds() {
    const direct = this.shell(['cmd', 'display', 'get-displays', '-i'], { allowFailure: true });
    if (direct.status === 0) {
      const ids = direct.stdout
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => /^\d+$/.test(line))
        .map(Number);
      if (ids.length) return [...new Set(ids)].sort((a, b) => a - b);
    }
    const output = this.shell(['dumpsys', 'display']).stdout;
    return parseDisplayIds(output);
  }

  currentFocus() {
    const output = this.shell(['dumpsys', 'window', 'windows'], { allowFailure: true }).stdout || '';
    const line = output.split(/\r?\n/).find(item => /mCurrentFocus|mFocusedApp/.test(item));
    return line?.trim() || 'unknown';
  }

  screenshot(displayId, targetPath) {
    const id = Number(displayId);
    if (!Number.isInteger(id) || id < 0) throw new Error(`Invalid display id: ${displayId}`);
    const captureIds = [String(id)];
    if (id > 0) {
      const surfaceFlinger = this.shell(
        ['dumpsys', 'SurfaceFlinger', '--display-id'],
        { allowFailure: true }
      );
      const virtualIds = parseSurfaceFlingerVirtualDisplayIds(surfaceFlinger.stdout || '');
      // scrcpy owns the newest virtual display during an agent run.
      if (virtualIds.length) captureIds.unshift(virtualIds.at(-1));
    }
    const attempts = [
      ...captureIds.map(captureId => ['exec-out', 'screencap', '-p', '-d', captureId]),
      ['exec-out', 'screencap', '-p', '--display-id', String(id)]
    ];
    let last;
    for (const args of attempts) {
      const result = this.exec(args, { encoding: null, allowFailure: true });
      const data = result.stdout;
      if (result.status === 0 && Buffer.isBuffer(data) && data.length > 8 && data.subarray(1, 4).toString('ascii') === 'PNG') {
        fs.writeFileSync(targetPath, data);
        return targetPath;
      }
      last = result.stderr?.toString() || 'screencap returned no PNG';
    }
    throw new Error(`Unable to capture display ${id}: ${last}`);
  }

  tap(displayId, x, y) {
    return this.shell(['input', '-d', displayId, 'tap', Math.round(x), Math.round(y)]);
  }

  swipe(displayId, x1, y1, x2, y2, duration = 500) {
    return this.shell(['input', '-d', displayId, 'swipe', Math.round(x1), Math.round(y1), Math.round(x2), Math.round(y2), duration]);
  }

  key(displayId, keyCode) {
    return this.shell(['input', '-d', displayId, 'keyevent', keyCode]);
  }

  inputText(displayId, text) {
    return this.shell(['input', '-d', displayId, 'text', shellText(text)]);
  }

  startActivityWithText(displayId, component, extraName, text) {
    return this.shell([
      'am', 'start', '--display', displayId, '--activity-single-top',
      '-n', component, '--es', extraName, text
    ]);
  }

  resolveActivity(packageName) {
    const result = this.shell(['cmd', 'package', 'resolve-activity', '--brief', packageName], { allowFailure: true });
    return result.status === 0 ? result.stdout.trim().split(/\r?\n/).at(-1) : '';
  }

  startActivity(displayId, componentOrPackage) {
    const component = componentOrPackage.includes('/') ? componentOrPackage : this.resolveActivity(componentOrPackage);
    if (!component) throw new Error(`Could not resolve activity for ${componentOrPackage}`);
    return this.shell(['am', 'start', '--display', displayId, '-n', component]);
  }

  forceStop(packageName) {
    return this.shell(['am', 'force-stop', packageName], { allowFailure: true });
  }
}

export { parseDisplayIds, parseSurfaceFlingerVirtualDisplayIds };
