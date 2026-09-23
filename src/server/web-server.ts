import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import QRCode from 'qrcode';
import { WebSocketServer, WebSocket } from 'ws';
import { EMBEDDED_FILES, GUID_MAP_DE, GUID_MAP_EN, SAMPLE_REPLAY, REAL_REPLAY } from './embedded.generated';
import type { Mode } from '../shared/types';
import { StateManager } from './state-manager';
import { ReplayEngine } from './mock-server';
import { lanAddresses } from './network';

export { SAMPLE_REPLAY };

export interface Controls {
  mode(mode: Mode): void;
  config(): { port: number; tablet: boolean; configError: string | null };
  configure(port: number, tablet: boolean): void;
  openBrowser(): void;
  shutdown(): void;
}

export interface WebServerHandle {
  close(): Promise<void>;
}

function sameOrigin(request: IncomingMessage): boolean {
  const origin = request.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === request.headers.host; } catch { return false; }
}

function localRequest(request: IncomingMessage): boolean {
  return ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(request.socket.remoteAddress || '');
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

export function startWebServer(host: string, port: number, state: StateManager, replay: ReplayEngine, controls: Controls): Promise<WebServerHandle> {
  const server = createServer(async (request, response) => {
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    const path = url.pathname;
    try {
      if (path.startsWith('/api/') && !sameOrigin(request)) return json(response, 403, { error: 'Origin mismatch' });
      if (request.method === 'GET' && path === '/api/state') return json(response, 200, state.snapshot());
      if (request.method === 'GET' && path === '/api/mappings') return json(response, 200, { de: GUID_MAP_DE, en: GUID_MAP_EN });
      if (request.method === 'GET' && path === '/api/config') return json(response, 200, { ...controls.config(), host });
      if (path.startsWith('/api/widget') || path === '/api/browser' || path === '/api/shutdown' || (request.method === 'POST' && path === '/api/config')) {
        if (!localRequest(request)) return json(response, 403, { error: 'Local access required' });
      }
      if (request.method === 'GET' && path === '/api/widget') {
        const snapshot = state.snapshot();
        const config = controls.config();
        return json(response, 200, {
          running: true, mode: snapshot.mode, connection: snapshot.connection,
          islands: snapshot.islands.length, error: snapshot.error,
          ...config, addresses: config.tablet ? lanAddresses(config.port) : [],
        });
      }
      if (request.method === 'GET' && path === '/api/widget/qr') {
        const config = controls.config();
        const address = url.searchParams.get('address');
        const selected = config.tablet && lanAddresses(config.port).find((item) => item.address === address);
        if (!selected) return json(response, 404, { error: 'LAN address unavailable' });
        const png = await QRCode.toBuffer(selected.url, {
          errorCorrectionLevel: 'M', margin: 2, width: 220,
          color: { dark: '#2b2730', light: '#fffaf1' },
        });
        response.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' });
        response.end(png);
        return;
      }
      if (request.method === 'POST' && path === '/api/browser') {
        controls.openBrowser();
        return json(response, 200, { opened: true });
      }
      if (request.method === 'POST' && path === '/api/shutdown') {
        json(response, 200, { stopping: true });
        setTimeout(() => controls.shutdown(), 50);
        return;
      }
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
        const input = await body(request) as { port?: number; tablet?: boolean };
        const current = controls.config();
        const nextPort = input.port === undefined ? current.port : Number(input.port);
        const nextTablet = input.tablet === undefined ? current.tablet : input.tablet;
        if (!Number.isInteger(nextPort) || nextPort < 1024 || nextPort > 65535) throw new Error('Port must be 1024–65535');
        if (typeof nextTablet !== 'boolean') throw new Error('Invalid tablet mode');
        if (nextPort === current.port && nextTablet === current.tablet) return json(response, 200, { ...current, applying: false });
        json(response, 202, { port: nextPort, tablet: nextTablet, applying: true });
        setTimeout(() => controls.configure(nextPort, nextTablet), 50);
        return;
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
  const publish = (snapshot: ReturnType<StateManager['snapshot']>) => {
    const payload = JSON.stringify(snapshot);
    for (const client of wss.clients) if (client.readyState === WebSocket.OPEN) client.send(payload);
  };
  state.on('change', publish);
  return new Promise((resolve, reject) => {
    const onListenError = (error: Error) => { state.off('change', publish); reject(error); };
    server.once('error', onListenError);
    server.listen(port, host, () => {
      server.off('error', onListenError);
      resolve({
        close: () => new Promise<void>((done) => {
          state.off('change', publish);
          for (const client of wss.clients) client.terminate();
          wss.close();
          server.close(() => done());
          server.closeAllConnections();
        }),
      });
    });
  });
}
