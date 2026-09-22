import test from 'node:test';
import assert from 'node:assert/strict';
import { MainDisplayObserver } from '../src/context/observer.mjs';

test('main screen capture requires both opt-in and package allowlist', () => {
  const screenshots = [];
  const adb = {
    currentFocus() { return 'Window{ com.private.chat/.MainActivity }'; },
    screenshot(display) { screenshots.push(display); return 'main.png'; }
  };
  const logger = { screenshotPath() { return 'main.png'; }, event() {} };
  const blocked = new MainDisplayObserver({
    adb,
    logger,
    config: { allowMainDisplayCapture: true, observerAllowPackages: ['com.shadowtasks.user'] }
  });
  assert.equal(blocked.snapshot().screenshot, null);
  assert.deepEqual(screenshots, []);

  const allowed = new MainDisplayObserver({
    adb: { ...adb, currentFocus() { return 'Window{ com.shadowtasks.user/com.shadowtasks.MainActivity }'; } },
    logger,
    config: { allowMainDisplayCapture: true, observerAllowPackages: ['com.shadowtasks.user'] }
  });
  assert.equal(allowed.snapshot().screenshot, 'main.png');
  assert.deepEqual(screenshots, [0]);
});
