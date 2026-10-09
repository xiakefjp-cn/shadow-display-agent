import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AgentRunner, scalePoint } from '../src/agent/runner.mjs';
import { SafetyPolicy } from '../src/safety/policy.mjs';

test('runner targets only the policy display', async () => {
  const calls = [];
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shadow-agent-test-'));
  const adb = {
    screenshot(display, target) { calls.push(['screenshot', display]); fs.writeFileSync(target, Buffer.from('fake')); },
    tap(display, x, y) { calls.push(['tap', display, x, y]); fs.writeFileSync(marker, 'ok'); }
  };
  let count = 0;
  const model = { async nextAction() { count += 1; return count === 1 ? 'do(action="Tap", element=[1,2])' : 'finish(message="done")'; } };
  const logger = {
    dir: root,
    screenshotPath(step) { return path.join(root, `${step}.png`); },
    event() {}
  };
  const runner = new AgentRunner({
    adb,
    model,
    policy: new SafetyPolicy({ agentDisplayId: 8 }),
    observer: null,
    logger,
    config: { maxSteps: 3, actionDelayMs: 0, displaySize: '1080x2400' },
    apps: {}
  });
  // A small local file is an independent verifier for this unit test.
  const marker = path.join(root, 'verified');
  const result = await runner.run({ instruction: 'test', verification: { type: 'file-exists', path: marker } });
  assert.equal(result.status, 'completed');
  assert.deepEqual(calls, [['screenshot', 8], ['tap', 8, 1, 5]]);
});

test('runner tells the model to change an ineffective repeated action', async () => {
  const histories = [];
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shadow-agent-repeat-test-'));
  const adb = {
    screenshot(_display, target) { fs.writeFileSync(target, Buffer.from('fake')); },
    tap() {}
  };
  let count = 0;
  const model = {
    async nextAction({ history }) {
      histories.push(structuredClone(history));
      count += 1;
      return count < 3 ? 'do(action="Tap", element=[274,207])' : 'finish(message="done")';
    }
  };
  const logger = {
    dir: root,
    screenshotPath(step) { return path.join(root, `${step}.png`); },
    event() {}
  };
  const runner = new AgentRunner({
    adb,
    model,
    policy: new SafetyPolicy({ agentDisplayId: 9 }),
    observer: null,
    logger,
    config: { maxSteps: 3, actionDelayMs: 0, displaySize: '1080x2400' },
    apps: {}
  });
  await assert.rejects(
    runner.run({ instruction: 'test', verification: { type: 'file-exists', path: path.join(root, 'missing') } }),
    /verification failed/
  );
  assert.match(histories[2].at(-1).content, /Do not repeat it/);
});

test('scales normalized model coordinates to virtual-display pixels', () => {
  assert.deepEqual(scalePoint([274, 205], '1080x2400'), [296, 492]);
  assert.deepEqual(scalePoint([0, 1000], '1080x2400'), [0, 2400]);
});
