import fs from 'node:fs';
import { sleep } from '../infra/process.mjs';
import { parseAction } from './action-parser.mjs';
import { verifyTask } from '../tasks/verifiers.mjs';

function displayDimensions(size) {
  const match = String(size || '').match(/^(\d+)x(\d+)$/i);
  if (!match) throw new Error(`Invalid agent display size: ${size}`);
  return [Number(match[1]), Number(match[2])];
}

function scalePoint(point, size) {
  if (!Array.isArray(point) || point.length !== 2) throw new Error('Action requires a coordinate pair');
  const [width, height] = displayDimensions(size);
  const x = Math.round(Math.max(0, Math.min(1000, point[0])) * width / 1000);
  const y = Math.round(Math.max(0, Math.min(1000, point[1])) * height / 1000);
  return [x, y];
}

export class AgentRunner {
  constructor({ adb, model, policy, observer, logger, config, apps = {} }) {
    this.adb = adb;
    this.model = model;
    this.policy = policy;
    this.observer = observer;
    this.logger = logger;
    this.config = config;
    this.apps = apps;
  }

  execute(action) {
    const display = this.policy.agentDisplayId;
    this.policy.assertAction(action, display);
    switch (action.action) {
      case 'Tap': return this.adb.tap(display, ...scalePoint(action.element, this.config.displaySize));
      case 'Swipe': return this.adb.swipe(
        display,
        ...scalePoint(action.start, this.config.displaySize),
        ...scalePoint(action.end, this.config.displaySize)
      );
      case 'Long Press': {
        const point = scalePoint(action.element, this.config.displaySize);
        return this.adb.swipe(display, ...point, ...point, 900);
      }
      case 'Type': {
        if (this.config.agentTextInputExtra && this.config.startComponent) {
          return this.adb.startActivityWithText(
            display,
            this.config.startComponent,
            this.config.agentTextInputExtra,
            action.text
          );
        }
        return this.adb.inputText(display, action.text);
      }
      case 'Back': return this.adb.key(display, 4);
      case 'Home': return this.adb.key(display, 3);
      case 'Launch': {
        const target = this.apps[action.app]?.component || this.apps[action.app]?.package;
        if (!target) throw new Error(`App '${action.app}' is not in config/apps.json`);
        return this.adb.startActivity(display, target);
      }
      case 'Wait': return;
      default: throw new Error(`Unsupported action: ${action.action}`);
    }
  }

  async run(task) {
    const history = [];
    let previousActionKey = null;
    let repeatedActionCount = 0;
    let textInputPrepared = false;
    let humanContext = this.observer?.snapshot();
    if (humanContext) humanContext = await this.model.describeHumanContext(humanContext);
    this.logger.event('task_started', { instruction: task.instruction, displayId: this.policy.agentDisplayId });

    const existing = await verifyTask(task.verification, this.config);
    if (existing.verified) {
      this.logger.event('task_verification', existing);
      return { status: 'completed', message: 'Task was already satisfied', verification: existing, runDir: this.logger.dir };
    }

    for (let step = 1; step <= this.config.maxSteps; step += 1) {
      const screenshot = this.logger.screenshotPath(step);
      this.adb.screenshot(this.policy.agentDisplayId, screenshot);
      const response = await this.model.nextAction({ instruction: task.instruction, screenshot, step, humanContext, history });
      const action = parseAction(response);
      this.logger.event('agent_step', { step, action, response, screenshot });

      history.push({ role: 'assistant', content: response });
      const actionKey = JSON.stringify(action);
      if (actionKey === previousActionKey) repeatedActionCount += 1;
      else repeatedActionCount = 1;
      previousActionKey = actionKey;

      if (repeatedActionCount >= 2) {
        history.push({
          role: 'user',
          content: 'The previous action did not advance the UI. Do not repeat it. Reassess the current screenshot, locate the correct control, and choose a different next action.'
        });
      }
      if (history.length > 12) history.splice(0, history.length - 12);

      if (action.action === 'Finish') {
        const verification = await verifyTask(task.verification, this.config);
        this.logger.event('task_verification', verification);
        if (!verification.verified) {
          throw new Error(`Model reported completion but verification failed: ${verification.reason}`);
        }
        return { status: 'completed', message: action.message, verification, runDir: this.logger.dir };
      }

      if (action.action === 'Type' && !this.config.agentTextInputExtra && this.config.switchImeToEnglishBeforeType && !textInputPrepared) {
        // KEYCODE_LANGUAGE_SWITCH changes the focused virtual-display IME from
        // Chinese composition to direct Latin input without touching display 0.
        this.adb.key(this.policy.agentDisplayId, 204);
        await sleep(300);
        textInputPrepared = true;
      }

      this.execute(action);
      await sleep(this.config.actionDelayMs);

      const verification = await verifyTask(task.verification, this.config);
      if (verification.verified) {
        this.logger.event('task_verification', verification);
        return {
          status: 'completed',
          message: 'Verified outcome after action',
          verification,
          runDir: this.logger.dir
        };
      }

      if (step % 3 === 0 && this.observer) {
        humanContext = await this.model.describeHumanContext(this.observer.snapshot());
      }
    }
    throw new Error(`Task exceeded ${this.config.maxSteps} steps`);
  }
}

export function readTask(file) {
  const task = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!task.instruction) throw new Error('Task file must include instruction');
  return task;
}

export { scalePoint };
