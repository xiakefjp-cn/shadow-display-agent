import { start, sleep } from '../infra/process.mjs';

function appendAndParse(state, chunk) {
  state.output += chunk.toString();
  const matches = [...state.output.matchAll(/(?:New display:.*?\(id=|display(?:Id| id)?[=: ]+)(\d+)/gi)];
  if (matches.length) state.displayId = Number(matches.at(-1)[1]);
}

export class ScrcpyVirtualDisplay {
  constructor({ scrcpyPath, serial, size, dpi, startComponent, adb }) {
    this.scrcpyPath = scrcpyPath;
    this.serial = serial;
    this.size = size;
    this.dpi = dpi;
    this.startComponent = startComponent;
    this.adb = adb;
    this.child = null;
    this.displayId = null;
    this.log = '';
  }

  async open(timeoutMs = 15000) {
    const before = new Set(this.adb.getDisplayIds());
    const args = [
      `--new-display=${this.size}/${this.dpi}`,
      '--display-ime-policy=local',
      '--no-clipboard-autosync',
      '--no-audio',
      '--no-playback',
      '--window-title=Shadow Agent Display'
    ];
    if (this.serial) args.unshift('--serial', this.serial);
    if (this.startComponent) args.push('--start-app', this.startComponent);

    const state = { output: '', displayId: null };
    this.child = start(this.scrcpyPath, args);
    this.child.stdout.on('data', chunk => appendAndParse(state, chunk));
    this.child.stderr.on('data', chunk => appendAndParse(state, chunk));

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (this.child.exitCode !== null) {
        throw new Error(`scrcpy exited before creating a virtual display:\n${state.output}`);
      }
      if (state.displayId > 0) break;
      const created = this.adb.getDisplayIds().filter(id => id > 0 && !before.has(id));
      if (created.length === 1) state.displayId = created[0];
      if (state.displayId > 0) break;
      await sleep(250);
    }
    this.log = state.output;
    if (!(state.displayId > 0)) {
      await this.close();
      throw new Error(`Timed out waiting for scrcpy virtual display id. Output:\n${state.output}`);
    }
    this.displayId = state.displayId;
    return this.displayId;
  }

  async close() {
    if (!this.child || this.child.exitCode !== null) return;
    this.child.kill();
    await Promise.race([
      new Promise(resolve => this.child.once('exit', resolve)),
      sleep(2000)
    ]);
    if (this.child.exitCode === null) this.child.kill('SIGKILL');
  }
}

export { appendAndParse };
