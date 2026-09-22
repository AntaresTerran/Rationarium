import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { EMBEDDED_FILES, GUID_MAP_DE, GUID_MAP_EN, SAMPLE_REPLAY, REAL_REPLAY } from './embedded.generated';
import type { Mode } from '../shared/types';
import { StateManager } from './state-manager';
import { ReplayEngine } from './mock-server';

export { SAMPLE_REPLAY };

export interface Controls {
  mode(mode: Mode): void;
  getPort(): number;
  savePort(port: number): void;
}

function sameOrigin(request: IncomingMessage): boolean {
  const origin = request.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === request.headers.host; } catch { return false; }
}

async function body(request: IncomingMessage): Promise<unknown> {
  let text = '';
  for await (const chunk of request) {
    text += chunk.toString();
    if (text.length > 10 * 1024 * 1024) throw new Error('Request too large');
  }
  return JSON.parse(text || '{}');
}

function json(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(value));
}

export function startWebServer(host: string, port: number, state: StateManager, replay: ReplayEngine, controls: Controls): Promise<void> {
  const server = createServer(async (request, response) => {
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    const path = url.pathname;
    try {
      if (path.startsWith('/api/') && !sameOrigin(request)) return json(response, 403, { error: 'Origin mismatch' });
      if (request.method === 'GET' && path === '/api/state') return json(response, 200, state.snapshot());
      if (request.method === 'GET' && path === '/api/mappings') return json(response, 200, { de: GUID_MAP_DE, en: GUID_MAP_EN });
      if (request.method === 'GET' && path === '/api/config') return json(response, 200, { port: controls.getPort(), host });
      if (request.method === 'POST' && path === '/api/mode') {
        const input = await body(request) as { mode?: Mode };
        if (input.mode !== 'live' && input.mode !== 'demo') throw new Error('Invalid mode');
        controls.mode(input.mode);
        return json(response, 200, state.snapshot());
      }
      if (request.method === 'POST' && path === '/api/replay/sample') {
        controls.mode('demo');
        replay.load(SAMPLE_REPLAY, 'Integrierte Demonstration');
        replay.play();
        return json(response, 200, state.snapshot());
      }
      if (request.method === 'POST' && path === '/api/replay/real') {
        controls.mode('demo');
        replay.load(REAL_REPLAY, 'Community-Mitschnitt');
        replay.play();
        return json(response, 200, state.snapshot());
      }
      if (request.method === 'POST' && path === '/api/replay/upload') {
        const input = await body(request) as { text?: string; name?: string };
        if (typeof input.text !== 'string' || input.text.length > 10 * 1024 * 1024) throw new Error('Invalid replay file');
        controls.mode('demo');
        replay.load(input.text, String(input.name || 'Eigenes Replay').slice(0, 100));
        replay.play();
        return json(response, 200, state.snapshot());
      }
      if (request.method === 'POST' && path === '/api/replay/control') {
        const input = await body(request) as { action?: string; intervalMs?: number };
        if (state.snapshot().mode !== 'demo') throw new Error('Simulation is not active');
        if (input.action === 'play') replay.play();
        else if (input.action === 'pause') replay.pause();
        else if (input.action === 'step') replay.step();
        else if (input.action === 'speed') replay.speed(Number(input.intervalMs));
        else throw new Error('Invalid replay action');
        return json(response, 200, state.snapshot());
      }
      if (request.method === 'POST' && path === '/api/config') {
        const input = await body(request) as { port?: number };
        const nextPort = Number(input.port);
        if (!Number.isInteger(nextPort) || nextPort < 1024 || nextPort > 65535) throw new Error('Port must be 1024–65535');
        controls.savePort(nextPort);
        return json(response, 200, { port: nextPort, restartRequired: true });
      }
      if (request.method !== 'GET' && request.method !== 'HEAD') return json(response, 405, { error: 'Method not allowed' });
      const file = EMBEDDED_FILES[path === '/' ? '/index.html' : path];
      if (!file) return json(response, 404, { error: 'Not found' });
      response.writeHead(200, { 'Content-Type': file.type, 'Cache-Control': path === '/' ? 'no-cache' : 'public, max-age=86400' });
      response.end(request.method === 'HEAD' ? undefined : Buffer.from(file.base64, 'base64'));
    } catch (error) {
      json(response, 400, { error: (error as Error).message });
    }
  });
  const wss = new WebSocketServer({ noServer: true });
  server.on('upgrade', (request, socket, head) => {
    if (request.url !== '/ws' || !sameOrigin(request)) { socket.destroy(); return; }
    wss.handleUpgrade(request, socket, head, (client) => {
      wss.emit('connection', client, request);
    });
  });
  wss.on('connection', (client) => client.send(JSON.stringify(state.snapshot())));
  state.on('change', (snapshot) => {
    const payload = JSON.stringify(snapshot);
    for (const client of wss.clients) if (client.readyState === WebSocket.OPEN) client.send(payload);
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve();
    });
  });
}
