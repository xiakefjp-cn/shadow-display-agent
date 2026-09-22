import fs from 'node:fs';

export async function verifyTask(verification, config) {
  if (!verification || verification.type === 'none') {
    return { verified: false, reason: 'No independent verifier configured' };
  }
  if (verification.type === 'demo-task') {
    const response = await fetch(`${config.demoApiUrl}/api/tasks`, {
      headers: { authorization: `Bearer ${config.demoApiToken}` },
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) return { verified: false, reason: `Demo API returned ${response.status}` };
    const tasks = await response.json();
    const match = tasks.find(task => task.title.includes(verification.titleContains));
    return match
      ? { verified: true, evidence: { id: match.id, title: match.title, createdAt: match.createdAt } }
      : { verified: false, reason: `No task title contains ${verification.titleContains}` };
  }
  if (verification.type === 'file-exists') {
    return fs.existsSync(verification.path)
      ? { verified: true, evidence: { path: verification.path } }
      : { verified: false, reason: `File does not exist: ${verification.path}` };
  }
  return { verified: false, reason: `Unknown verifier: ${verification.type}` };
}
