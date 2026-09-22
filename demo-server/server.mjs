import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const port = Number(process.env.DEMO_SERVER_PORT || 8787);
const token = process.env.DEMO_API_TOKEN || 'demo-local-token';
const dataDir = path.resolve('.shadow-agent/demo-server');
const dataFile = path.join(dataDir, 'tasks.json');
fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(dataFile)) fs.writeFileSync(dataFile, '[]');

const readTasks = () => JSON.parse(fs.readFileSync(dataFile, 'utf8'));
const writeTasks = tasks => fs.writeFileSync(dataFile, JSON.stringify(tasks, null, 2));
const send = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' });
  res.end(JSON.stringify(body));
};

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') return send(res, 200, { ok: true });
  if (req.headers.authorization !== `Bearer ${token}`) return send(res, 401, { error: 'unauthorized' });
  if (req.method === 'GET' && req.url === '/api/tasks') return send(res, 200, readTasks());
  if (req.method === 'POST' && req.url === '/api/tasks') {
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => {
      try {
        const input = JSON.parse(raw || '{}');
        if (!input.title || typeof input.title !== 'string') return send(res, 400, { error: 'title is required' });
        const tasks = readTasks();
        const existing = input.idempotencyKey && tasks.find(item => item.idempotencyKey === input.idempotencyKey);
        if (existing) return send(res, 200, existing);
        const task = {
          id: randomUUID(),
          title: input.title.slice(0, 200),
          dueAt: input.dueAt || null,
          idempotencyKey: input.idempotencyKey || null,
          createdAt: new Date().toISOString()
        };
        tasks.push(task);
        writeTasks(tasks);
        return send(res, 201, task);
      } catch (error) {
        return send(res, 400, { error: error.message });
      }
    });
    return;
  }
  return send(res, 404, { error: 'not found' });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Shadow Tasks demo API listening on http://0.0.0.0:${port}`);
});
