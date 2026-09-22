import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDisplayIds } from '../src/device/adb.mjs';
import { appendAndParse } from '../src/device/scrcpy-session.mjs';

test('extracts logical display ids from dumpsys variants', () => {
  const input = 'Display 0:\nDisplayViewport{displayId=12}\nmDisplayId=7';
  assert.deepEqual(parseDisplayIds(input), [0, 7, 12]);
});

test('extracts scrcpy new display id from streamed logs', () => {
  const state = { output: '', displayId: null };
  appendAndParse(state, Buffer.from('INFO: New display: 1080x2400/420 '));
  appendAndParse(state, Buffer.from('(id=11)\n'));
  assert.equal(state.displayId, 11);
});
