import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDisplayIds, parseSurfaceFlingerVirtualDisplayIds } from '../src/device/adb.mjs';
import { appendAndParse, scrcpyEnvironment } from '../src/device/scrcpy-session.mjs';

test('extracts logical display ids from dumpsys variants', () => {
  const input = 'Display 0:\nDisplayViewport{displayId=12}\nmDisplayId=7';
  assert.deepEqual(parseDisplayIds(input), [0, 7, 12]);
});

test('extracts SurfaceFlinger virtual display ids used by Android 16 screencap', () => {
  const input = [
    'Display 4630947082089526659 (HWC display 0): port=131',
    'Display 11529215047713160202 (Virtual display): displayName="scrcpy"'
  ].join('\n');
  assert.deepEqual(parseSurfaceFlingerVirtualDisplayIds(input), ['11529215047713160202']);
});

test('extracts scrcpy new display id from streamed logs', () => {
  const state = { output: '', displayId: null };
  appendAndParse(state, Buffer.from('INFO: New display: 1080x2400/420 '));
  appendAndParse(state, Buffer.from('(id=11)\n'));
  assert.equal(state.displayId, 11);
});

test('does not pass an empty Android serial to scrcpy', () => {
  const env = scrcpyEnvironment('', { ANDROID_SERIAL: '', KEEP_ME: 'yes' });
  assert.equal(env.ANDROID_SERIAL, undefined);
  assert.equal(env.KEEP_ME, 'yes');
});

test('preserves a configured Android serial for scrcpy', () => {
  const env = scrcpyEnvironment('fdc2cbd9', { ANDROID_SERIAL: 'fdc2cbd9' });
  assert.equal(env.ANDROID_SERIAL, 'fdc2cbd9');
});
