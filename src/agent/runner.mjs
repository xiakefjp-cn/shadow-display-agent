import fs from 'node:fs';
import { sleep } from '../infra/process.mjs';
import { parseAction } from './action-parser.mjs';
import { verifyTask } from '../tasks/verifiers.mjs';

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
      case 'Tap': return this.adb.tap(display, ...action.element);
      case 'Swipe': return this.adb.swipe(display, ...action.start, ...action.end);
      case 'Long Press': return this.adb.swipe(display, ...action.element, ...action.element, 900);
      case 'Type': return this.adb.inputText(display, action.text);
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
    let humanContext = this.observer?.snapshot();
    if (humanContext) humanContext = await this.model.describeHumanContext(humanContext);
    this.logger.event('task_started', { instruction: task.instruction, displayId: this.policy.agentDisplayId });

    for (let step = 1; step <= this.config.maxSteps; step += 1) {
      const screenshot = this.logger.screenshotPath(step);
      this.adb.screenshot(this.policy.agentDisplayId, screenshot);
      const response = await this.model.nextAction({ instruction: task.instruction, screenshot, step, humanContext, history });
      const action = parseAction(response);
      this.logger.event('agent_step', { step, action, screenshot });

      history.push({ role: 'assistant', content: response });
      if (history.length > 12) history.splice(0, 2);

      if (action.action === 'Finish') {
        const verification = await verifyTask(task.verification, this.config);
        this.logger.event('task_verification', verification);
        if (!verification.verified) {
          throw new Error(`Model reported completion but verification failed: ${verification.reason}`);
        }
        return { status: 'completed', message: action.message, verification, runDir: this.logger.dir };
      }

      this.execute(action);
      await sleep(this.config.actionDelayMs);
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
