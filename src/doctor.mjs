import { commandExists, run } from './infra/process.mjs';

function check(name, ok, detail) {
  return { name, ok: Boolean(ok), detail };
}

export function runDoctor(config, adb) {
  const results = [];
  const adbExists = commandExists(config.adbPath);
  const scrcpyExists = commandExists(config.scrcpyPath);
  results.push(check('adb executable', adbExists, config.adbPath));
  results.push(check('scrcpy executable', scrcpyExists, config.scrcpyPath));

  if (adbExists) {
    const version = run(config.adbPath, ['version'], { allowFailure: true }).stdout.trim().split(/\r?\n/)[0];
    results.push(check('adb version', Boolean(version), version || 'unavailable'));
    const devices = adb.listDevices();
    results.push(check('authorized Android device', devices.length > 0, devices.join('; ') || 'none'));
    if (devices.length) {
      const inputHelp = adb.shell(['input', '--help'], { allowFailure: true });
      const inputText = `${inputHelp.stdout}\n${inputHelp.stderr}`;
      results.push(check('display-targeted input', /-d\s+DISPLAY_ID|--display/i.test(inputText), 'Android shell input must support -d DISPLAY_ID'));
      const displays = adb.getDisplayIds();
      results.push(check('display discovery', displays.includes(0), `found: ${displays.join(', ')}`));
    }
  }
  if (scrcpyExists) {
    const version = run(config.scrcpyPath, ['--version'], { allowFailure: true }).stdout.trim().split(/\r?\n/)[0];
    results.push(check('scrcpy version', Boolean(version), version || 'unavailable'));
    const help = run(config.scrcpyPath, ['--help'], { allowFailure: true });
    const helpText = `${help.stdout}\n${help.stderr}`;
    results.push(check('scrcpy virtual display', helpText.includes('--new-display'), '--new-display'));
    results.push(check('local virtual-display IME', helpText.includes('--display-ime-policy'), '--display-ime-policy=local'));
    results.push(check('clipboard isolation', helpText.includes('--no-clipboard-autosync'), '--no-clipboard-autosync'));
  }
  return results;
}
