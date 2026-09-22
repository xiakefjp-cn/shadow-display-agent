import test from 'node:test';
import assert from 'node:assert/strict';
import { SafetyPolicy, SafetyViolation } from '../src/safety/policy.mjs';

test('agent display must never be display zero', () => {
  assert.throws(() => new SafetyPolicy({ agentDisplayId: 0 }), SafetyViolation);
});

test('allows writes only to the bound virtual display', () => {
  const policy = new SafetyPolicy({ agentDisplayId: 12 });
  assert.equal(policy.assertAction({ action: 'Tap' }, 12), true);
  assert.throws(() => policy.assertAction({ action: 'Tap' }, 0), /Blocked|forbidden/);
  assert.throws(() => policy.assertAction({ action: 'Type' }, 9), /Blocked/);
});

test('blocks unconfirmed high-risk operations', () => {
  const policy = new SafetyPolicy({ agentDisplayId: 2 });
  assert.throws(() => policy.assertAction({ action: 'Pay' }, 2), /confirmation/);
});
