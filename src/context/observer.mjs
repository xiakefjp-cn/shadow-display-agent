export class MainDisplayObserver {
  constructor({ adb, config, logger }) {
    this.adb = adb;
    this.config = config;
    this.logger = logger;
    this.sequence = 0;
  }

  snapshot() {
    const context = {
      sequence: ++this.sequence,
      focus: this.adb.currentFocus(),
      screenshot: null
    };
    const captureAllowed = this.config.allowMainDisplayCapture &&
      this.config.observerAllowPackages.some(packageName => context.focus.includes(packageName));
    if (captureAllowed) {
      const target = this.logger.screenshotPath(this.sequence, 'human-main-readonly');
      context.screenshot = this.adb.screenshot(0, target);
    }
    this.logger.event('human_context', context);
    return context;
  }
}
