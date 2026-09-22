import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAction } from '../src/agent/action-parser.mjs';

test('parses tagged tap action', () => {
  assert.deepEqual(
    parseAction('<think>button</think><answer>do(action="Tap", element=[120, 340])</answer>'),
    { action: 'Tap', element: [120, 340] }
  );
});

test('parses wrappers seen in VLM responses', () => {
  assert.deepEqual(
    parseAction('<|begin_of_box|>do(action="Type", text="Project review")<|end_of_box|>'),
    { action: 'Type', text: 'Project review' }
  );
});

test('parses finish action', () => {
  assert.deepEqual(parseAction('finish(message="done")'), { action: 'Finish', message: 'done' });
});

test('rejects response without an action', () => {
  assert.throws(() => parseAction('I think it is complete'), /No action command/);
});
