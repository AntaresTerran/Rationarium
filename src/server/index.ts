import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { spawn } from 'node:child_process';
import { StateManager } from './state-manager';
import { PipeClient } from './pipe-client';
import { ReplayEngine } from './mock-server';
import { SAMPLE_REPLAY, startWebServer } from './web-server';
import { startMockPipe } from './pipe-mock';
import type { Mode } from '../shared/types';

const args = process.argv.slice(1);
function option(name: string): string | undefined {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
}

const configDir = join(process.env.APPDATA || homedir(), 'Rationarium');
const configPath = join(configDir, 'settings.json');
let savedPort = 53117;
try {
  const parsed = JSON.parse(readFileSync(configPath, 'utf8')) as { port?: number };
  if (Number.isInteger(parsed.port) && Number(parsed.port) >= 1024 && Number(parsed.port) <= 65535) savedPort = Number(parsed.port);
} catch { /* Defaults are intentional on first launch. */ }

const port = Number(option('--port') || savedPort);
const host = option('--host') || '127.0.0.1';
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid port');
if (!['127.0.0.1', 'localhost', '0.0.0.0'].includes(host)) throw new Error('Invalid host');

const state = new StateManager();
const pipe = new PipeClient(state);
const replay = new ReplayEngine(state);

function setMode(mode: Mode): void {
  pipe.stop();
  replay.pause();
  state.setMode(mode);
  if (mode === 'live') pipe.start();
  else {
    replay.load(SAMPLE_REPLAY, 'Integrierte Demonstration');
    replay.play();
  }
}

function openBrowser(url: string): void {
  const platform = process.platform;
  const command = platform === 'win32' ? 'rundll32.exe' : platform === 'darwin' ? 'open' : 'xdg-open';
  const argv = platform === 'win32' ? ['url.dll,FileProtocolHandler', url] : [url];
  const child = spawn(command, argv, { detached: true, stdio: 'ignore', windowsHide: true });
  child.on('error', () => console.log(`Browser: ${url}`));
  child.unref();
}

async function main(): Promise<void> {
  if (args.includes('--mock-pipe')) {
    const mockPath = option('--mock-pipe');
    const source = mockPath && !mockPath.startsWith('--') ? readFileSync(mockPath, 'utf8') : SAMPLE_REPLAY;
    await startMockPipe(source);
    console.log('Named-Pipe-Mock gestartet');
  }
  await startWebServer(host, port, state, replay, {
    mode: setMode,
    getPort: () => port,
    savePort: (nextPort) => {
      mkdirSync(configDir, { recursive: true });
      writeFileSync(configPath, JSON.stringify({ port: nextPort }, null, 2));
    },
  });
  console.log(`Rationarium: http://localhost:${port}`);
  if (args.includes('--demo') || option('--replay')) {
    setMode('demo');
    const replayPath = option('--replay');
    if (replayPath) {
      replay.load(readFileSync(replayPath, 'utf8'), replayPath);
      replay.play();
    }
  } else setMode('live');
  if (!args.includes('--no-browser')) openBrowser(`http://localhost:${port}`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
