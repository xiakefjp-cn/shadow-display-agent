import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AgentRunner } from '../src/agent/runner.mjs';
import { SafetyPolicy } from '../src/safety/policy.mjs';

test('runner targets only the policy display', async () => {
  const calls = [];
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shadow-agent-test-'));
  const adb = {
    screenshot(display, target) { calls.push(['screenshot', display]); fs.writeFileSync(target, Buffer.from('fake')); },
    tap(display, x, y) { calls.push(['tap', display, x, y]); }
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
    config: { maxSteps: 3, actionDelayMs: 0 },
    apps: {}
  });
  // A small local file is an independent verifier for this unit test.
  const marker = path.join(root, 'verified');
  fs.writeFileSync(marker, 'ok');
  const result = await runner.run({ instruction: 'test', verification: { type: 'file-exists', path: marker } });
  assert.equal(result.status, 'completed');
  assert.deepEqual(calls, [['screenshot', 8], ['tap', 8, 1, 2], ['screenshot', 8]]);
});
