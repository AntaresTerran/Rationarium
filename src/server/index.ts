import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { spawn } from 'node:child_process';
import { deflateRawSync } from 'node:zlib';
import { StateManager } from './state-manager';
import { PipeClient } from './pipe-client';
import { ReplayEngine } from './mock-server';
import { SAMPLE_REPLAY, startWebServer, type Controls, type WebServerHandle } from './web-server';
import { WIDGET_SCRIPT } from './embedded.generated';
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
let savedTablet = false;
try {
  const parsed = JSON.parse(readFileSync(configPath, 'utf8')) as { port?: number; tablet?: boolean };
  if (Number.isInteger(parsed.port) && Number(parsed.port) >= 1024 && Number(parsed.port) <= 65535) savedPort = Number(parsed.port);
  if (typeof parsed.tablet === 'boolean') savedTablet = parsed.tablet;
} catch { /* Defaults are intentional on first launch. */ }

let currentPort = Number(option('--port') || savedPort);
const initialHost = option('--host') || (savedTablet ? '0.0.0.0' : '127.0.0.1');
if (!Number.isInteger(currentPort) || currentPort < 1024 || currentPort > 65535) throw new Error('Invalid port');
if (!['127.0.0.1', 'localhost', '0.0.0.0'].includes(initialHost)) throw new Error('Invalid host');
let currentTablet = initialHost === '0.0.0.0';
let currentHost = initialHost;
let configError: string | null = null;
let web: WebServerHandle | null = null;
let rebindQueue = Promise.resolve();
let shuttingDown = false;

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

const controls: Controls = {
  mode: setMode,
  config: () => ({ port: currentPort, tablet: currentTablet, configError }),
  configure: (port, tablet) => {
    rebindQueue = rebindQueue.then(() => applyConfig(port, tablet)).catch((error) => {
      configError = (error as Error).message;
      console.error('Konfiguration:', error);
    });
  },
  openBrowser: () => openBrowser(`http://localhost:${currentPort}`),
  shutdown: () => { void shutdown(); },
};

async function applyConfig(port: number, tablet: boolean): Promise<void> {
  if (shuttingDown || (port === currentPort && tablet === currentTablet)) return;
  const previous = web;
  if (!previous) throw new Error('Web server is not running');
  const previousHost = currentHost;
  const previousPort = currentPort;
  const nextHost = tablet ? '0.0.0.0' : '127.0.0.1';
  const samePort = port === previousPort;
  try {
    if (samePort) { await previous.close(); web = null; }
    const next = await startWebServer(nextHost, port, state, replay, controls);
    if (!samePort) await previous.close();
    web = next;
    currentPort = port;
    currentTablet = tablet;
    currentHost = nextHost;
    configError = null;
    try {
      mkdirSync(configDir, { recursive: true });
      writeFileSync(configPath, JSON.stringify({ port, tablet }, null, 2));
    } catch (error) {
      configError = `Einstellung aktiv, aber nicht gespeichert: ${(error as Error).message}`;
    }
    console.log(`Rationarium: http://localhost:${port} (${tablet ? 'Tablet-Modus' : 'lokal'})`);
  } catch (error) {
    if (samePort) {
      web = await startWebServer(previousHost, previousPort, state, replay, controls);
    }
    configError = `Umstellung fehlgeschlagen: ${(error as Error).message}`;
    console.error(configError);
  }
}

async function shutdown(): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  pipe.stop();
  replay.pause();
  if (web) await web.close();
  process.exit(0);
}

function openWidget(): void {
  if (process.platform !== 'win32' || args.includes('--no-widget')) return;
  // Keep the embedded script below Windows' command-line length limit.
  const packed = deflateRawSync(Buffer.from(WIDGET_SCRIPT, 'utf8')).toString('base64');
  const command = `$RationariumPort=${currentPort};$RationariumParentPid=${process.pid};` +
    `$bytes=[Convert]::FromBase64String('${packed}');` +
    `$memory=[IO.MemoryStream]::new($bytes);` +
    `$zip=[IO.Compression.DeflateStream]::new($memory,[IO.Compression.CompressionMode]::Decompress);` +
    `$reader=[IO.StreamReader]::new($zip,[Text.Encoding]::UTF8);` +
    `$source=$reader.ReadToEnd();$reader.Dispose();$zip.Dispose();$memory.Dispose();` +
    `. ([ScriptBlock]::Create($source));`;
  const encoded = Buffer.from(command, 'utf16le').toString('base64');
  const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Sta', '-EncodedCommand', encoded], {
    windowsHide: false, stdio: 'ignore', detached: false,
  });
  child.on('error', (error) => console.error('Steuerfenster:', error));
  child.unref();
}

async function main(): Promise<void> {
  if (args.includes('--mock-pipe')) {
    const mockPath = option('--mock-pipe');
    const source = mockPath && !mockPath.startsWith('--') ? readFileSync(mockPath, 'utf8') : SAMPLE_REPLAY;
    await startMockPipe(source);
    console.log('Named-Pipe-Mock gestartet');
  }
  web = await startWebServer(currentHost, currentPort, state, replay, controls);
  console.log(`Rationarium: http://localhost:${currentPort}`);
  if (args.includes('--demo') || option('--replay')) {
    setMode('demo');
    const replayPath = option('--replay');
    if (replayPath) {
      replay.load(readFileSync(replayPath, 'utf8'), replayPath);
      replay.play();
    }
  } else setMode('live');
  openWidget();
  if (!args.includes('--no-browser')) controls.openBrowser();
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
