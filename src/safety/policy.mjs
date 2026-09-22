const WRITE_ACTIONS = new Set(['Tap', 'Swipe', 'Long Press', 'Type', 'Back', 'Home', 'Launch']);

export class SafetyViolation extends Error {
  constructor(message) {
    super(message);
    this.name = 'SafetyViolation';
  }
}

export class SafetyPolicy {
  constructor({ agentDisplayId, risk = 'low' }) {
    this.agentDisplayId = Number(agentDisplayId);
    this.risk = risk;
    if (!Number.isInteger(this.agentDisplayId) || this.agentDisplayId <= 0) {
      throw new SafetyViolation(`Agent display must be a non-main display; got ${agentDisplayId}`);
    }
  }

  assertAction(action, displayId) {
    if (!action || typeof action.action !== 'string') {
      throw new SafetyViolation('Malformed action');
    }
    if (WRITE_ACTIONS.has(action.action) && Number(displayId) !== this.agentDisplayId) {
      throw new SafetyViolation(`Blocked ${action.action}: target display ${displayId} is not agent display ${this.agentDisplayId}`);
    }
    if (Number(displayId) === 0 && WRITE_ACTIONS.has(action.action)) {
      throw new SafetyViolation('Writing to Android main display (0) is forbidden');
    }
    if (['Submit', 'Pay', 'Purchase', 'Delete', 'Send'].includes(action.action)) {
      throw new SafetyViolation(`${action.action} requires an explicit confirmation flow`);
    }
    return true;
  }
}
