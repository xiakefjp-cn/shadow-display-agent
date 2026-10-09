#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { getConfig, ensureArtifactDir } from './config.mjs';
import { AdbDevice } from './device/adb.mjs';
import { ScrcpyVirtualDisplay } from './device/scrcpy-session.mjs';
import { SafetyPolicy } from './safety/policy.mjs';
import { ModelClient } from './agent/model-client.mjs';
import { AgentRunner, readTask } from './agent/runner.mjs';
import { MainDisplayObserver } from './context/observer.mjs';
import { RunLogger } from './util/logger.mjs';
import { runDoctor } from './doctor.mjs';
import { sleep } from './infra/process.mjs';

function option(name, fallback = '') {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function loadApps() {
  const candidate = option('--apps', 'config/apps.json');
  const fallback = 'config/apps.example.json';
  const file = fs.existsSync(candidate) ? candidate : fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function printDoctor(results) {
  for (const item of results) console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}: ${item.detail}`);
  const failed = results.filter(item => !item.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  return failed === 0 ? 0 : 1;
}

async function main() {
  const command = process.argv[2] || 'help';
  const config = getConfig();
  ensureArtifactDir(config);
  const adb = new AdbDevice(config);

  if (command === 'doctor') {
    process.exitCode = printDoctor(runDoctor(config, adb));
    return;
  }

  if (command === 'observe') {
    const logger = new RunLogger(config.artifactDir, 'observer');
    const observer = new MainDisplayObserver({ adb, config, logger });
    console.log('Read-only observer started. No input commands will be sent to display 0. Press Ctrl+C to stop.');
    let previous = '';
    while (true) {
      const context = observer.snapshot();
      if (context.focus !== previous) console.log(new Date().toISOString(), context.focus);
      previous = context.focus;
      await sleep(1000);
    }
  }

  if (command === 'run') {
    const requestedTitle = option('--title');
    const task = requestedTitle
      ? {
          instruction: `在 Shadow Tasks 中创建任务，标题为 ${requestedTitle}。看到任务出现在列表后结束。`,
          startApp: 'Shadow Tasks',
          risk: 'low',
          verification: { type: 'demo-task', titleContains: requestedTitle }
        }
      : readTask(path.resolve(option('--task', 'config/task.example.json')));
    const apps = loadApps();
    const logger = new RunLogger(config.artifactDir);
    const session = new ScrcpyVirtualDisplay({
      scrcpyPath: config.scrcpyPath,
      serial: config.serial,
      size: config.displaySize,
      dpi: config.displayDpi,
      startComponent: '',
      adb
    });
    let shuttingDown = false;
    const cleanup = async () => {
      if (shuttingDown) return;
      shuttingDown = true;
      await session.close();
    };
    process.once('SIGINT', async () => { await cleanup(); process.exit(130); });
    process.once('SIGTERM', async () => { await cleanup(); process.exit(143); });

    try {
      const displayId = await session.open();
      console.log(`Agent virtual display created: ${displayId}`);
      const policy = new SafetyPolicy({ agentDisplayId: displayId, risk: task.risk || 'low' });
      const observer = new MainDisplayObserver({ adb, config, logger });
      const model = new ModelClient(config);
      if (task.startApp) {
        const target = apps[task.startApp]?.component || apps[task.startApp]?.package || task.startApp;
        adb.startActivity(displayId, target);
        await sleep(config.actionDelayMs);
      }
      const runner = new AgentRunner({ adb, model, policy, observer, logger, config, apps });
      const result = await runner.run(task);
      console.log(JSON.stringify(result, null, 2));
    } finally {
      await cleanup();
    }
    return;
  }

  console.log(`Shadow Display Agent\n\nCommands:\n  npm run doctor\n  node src/cli.mjs observe\n  node src/cli.mjs run --title "Prepare111"\n  node src/cli.mjs run --task config/task.example.json [--apps config/apps.json]`);
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
