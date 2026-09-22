import { connect, type Socket } from 'node:net';
import { FrameDecoder, MessageType, PIPE_PATH, PROTOCOL_VERSION } from '../shared/protocol';
import { StateManager } from './state-manager';

export class PipeClient {
  private socket: Socket | null = null;
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly state: StateManager, private readonly path = PIPE_PATH) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.open();
  }

  stop(): void {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.socket?.destroy();
    this.socket = null;
  }

  private open(): void {
    if (!this.running) return;
    this.state.setConnection('connecting');
    const socket = connect(this.path);
    this.socket = socket;
    const decoder = new FrameDecoder();
    let versionSeen = false;
    socket.on('connect', () => this.state.setConnection('connected'));
    socket.on('data', (chunk: Buffer) => {
      try {
        for (const message of decoder.push(chunk)) {
          if (!versionSeen) {
            if (message.type !== MessageType.Version || message.version !== PROTOCOL_VERSION) {
              throw new Error(`Unsupported pipe protocol version (expected ${PROTOCOL_VERSION})`);
            }
            versionSeen = true;
            this.state.setVersion(message.version);
            continue;
          }
          switch (message.type) {
            case MessageType.Version: this.state.setVersion(message.version); break;
            case MessageType.SessionStart: this.state.setSession(message.name); break;
            case MessageType.SessionEnd: this.state.endSession(); break;
            case MessageType.AreaProductionStatistics: this.state.putArea(message.area); break;
          }
        }
      } catch (error) {
        this.state.setConnection('disconnected', (error as Error).message);
        socket.destroy();
      }
    });
    socket.on('error', (error: NodeJS.ErrnoException) => {
      const message = error.code === 'ENOENT' || error.code === 'ECONNREFUSED'
        ? 'Anno 117 Pipe nicht verfügbar. Spiel mit /pipe starten.' : error.message;
      this.state.setConnection('disconnected', message);
    });
    socket.on('close', () => {
      if (this.socket !== socket) return;
      this.socket = null;
      decoder.reset();
      this.state.endSession();
      if (this.running) {
        this.state.setConnection('disconnected', this.state.snapshot().error);
        this.timer = setTimeout(() => this.open(), 3000);
      }
    });
  }
}
