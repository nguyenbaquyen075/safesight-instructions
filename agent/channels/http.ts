// SPDX-License-Identifier: MIT
import http from 'node:http';
import { env } from '../lib/env';
import { capabilities } from '../lib/capabilities';

export interface HttpHooks { drain: () => void; lastSweepAt: () => Date | null }

function authorised(req: http.IncomingMessage): boolean {
  if (!env.bridgeSecret) return false; // thiếu secret = từ chối, không mở
  return req.headers.authorization === `Bearer ${env.bridgeSecret}`;
}

export function startHttp(hooks: HttpHooks): http.Server {
  const server = http.createServer(async (req, res) => {
    const url = req.url ?? '/';
    if (req.method === 'GET' && url === '/health') {
      const body = JSON.stringify({ ok: true, capabilities: await capabilities(), lastSweepAt: hooks.lastSweepAt() });
      res.writeHead(200, { 'content-type': 'application/json' }); res.end(body); return;
    }
    if (req.method === 'POST' && (url === '/internal/dispatch' || url === '/internal/ask')) {
      if (!authorised(req)) { res.writeHead(401); res.end('Unauthorized'); return; }
      hooks.drain(); // row đã nằm trong DB; chỉ đánh thức vòng lặp sớm
      res.writeHead(202); res.end(); return;
    }
    res.writeHead(404); res.end();
  });
  server.listen(env.agentPort, '127.0.0.1', () => console.log(`✅ Agent HTTP nội bộ: http://127.0.0.1:${env.agentPort}`));
  return server;
}
