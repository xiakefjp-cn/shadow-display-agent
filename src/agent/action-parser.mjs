function numberPair(text) {
  const values = text.split(',').map(value => Number(value.trim()));
  if (values.length !== 2 || values.some(value => !Number.isFinite(value))) throw new Error(`Invalid coordinate pair: ${text}`);
  return values;
}

function quotedArg(source, name) {
  const match = source.match(new RegExp(`${name}\\s*=\\s*(["'])(.*?)\\1`, 's'));
  return match?.[2];
}

export function parseAction(response) {
  if (response && typeof response === 'object' && typeof response.action === 'string') return response;
  const raw = String(response ?? '').replace(/<\|(?:begin|end)_of_box\|>/g, '').trim();
  const answer = raw.match(/<answer>\s*([\s\S]*?)\s*<\/answer>/i)?.[1] || raw;
  const command = answer.match(/\b(?:do|finish)\s*\([\s\S]*?\)/i)?.[0];
  if (!command) throw new Error(`No action command found in model response: ${raw.slice(0, 240)}`);

  if (/^finish\s*\(/i.test(command)) {
    return { action: 'Finish', message: quotedArg(command, 'message') || 'Task completed' };
  }

  const action = quotedArg(command, 'action');
  if (!action) throw new Error(`Missing action name: ${command}`);
  const parsed = { action };
  const element = command.match(/element\s*=\s*\[([^\]]+)\]/i);
  const start = command.match(/start\s*=\s*\[([^\]]+)\]/i);
  const end = command.match(/end\s*=\s*\[([^\]]+)\]/i);
  if (element) parsed.element = numberPair(element[1]);
  if (start) parsed.start = numberPair(start[1]);
  if (end) parsed.end = numberPair(end[1]);
  for (const key of ['text', 'app', 'message']) {
    const value = quotedArg(command, key);
    if (value !== undefined) parsed[key] = value;
  }
  return parsed;
}
