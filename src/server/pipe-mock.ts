import { createServer, type Server, type Socket } from 'node:net';
import { MessageType, PIPE_PATH, PROTOCOL_VERSION } from '../shared/protocol';
import type { AreaStatistics, ProductionEntry } from '../shared/types';
import { parseReplay } from './mock-server';

function encodeFrame(payload: Buffer): Buffer {
  const header = Buffer.alloc(4);
  header.writeInt32LE(payload.length);
  return Buffer.concat([header, payload]);
}

class Writer {
  private chunks: Buffer[] = [];
  u8(value: number): void { const b = Buffer.alloc(1); b.writeUInt8(value); this.chunks.push(b); }
  i32(value: number): void { const b = Buffer.alloc(4); b.writeInt32LE(value); this.chunks.push(b); }
  i64(value: number): void { const b = Buffer.alloc(8); b.writeBigInt64LE(BigInt(Math.trunc(value))); this.chunks.push(b); }
  f32(value: number): void { const b = Buffer.alloc(4); b.writeFloatLE(value); this.chunks.push(b); }
  string(value: string): void {
    const bytes = Buffer.from(value, 'utf8');
    if (bytes.length > 255) throw new Error('Mock area name is too long');
    this.u8(bytes.length); this.chunks.push(bytes);
  }
  map(value: Record<string, number>): void {
    const entries = Object.entries(value);
    this.i32(entries.length);
    for (const [guid, amount] of entries) { this.i32(Number(guid)); this.i32(amount); }
  }
  finish(): Buffer { return Buffer.concat(this.chunks); }
}

export function encodeVersion(): Buffer {
  const writer = new Writer(); writer.u8(MessageType.Version); writer.i32(PROTOCOL_VERSION);
  return encodeFrame(writer.finish());
}

export function encodeSessionStart(name: string): Buffer {
  const writer = new Writer(); writer.u8(MessageType.SessionStart); writer.string(name);
  return encodeFrame(writer.finish());
}

function encodeEntry(writer: Writer, entry: ProductionEntry): void {
  writer.i32(entry.productGuid);
  writer.f32(entry.generation); writer.f32(entry.consumption); writer.f32(entry.delta);
  writer.f32(entry.perfectGeneration); writer.f32(entry.perfectConsumption);
  writer.i32(entry.amountOfBuildings); writer.i32(entry.totalMaintenance);
  writer.f32(entry.totalIncome); writer.i32(entry.totalProfit);
  writer.f32(entry.summedProductivity); writer.f32(entry.averageProductivity);
  writer.map(entry.workforces); writer.map(entry.buildings);
}

export function encodeArea(area: AreaStatistics): Buffer {
  const writer = new Writer();
  writer.u8(MessageType.AreaProductionStatistics);
  writer.u8(area.sessionId); writer.u8(area.islandId); writer.u8(area.areaIndex);
  writer.i32(area.sessionGuid); writer.string(area.areaName); writer.i64(area.timestamp);
  writer.i32(area.entries.length);
  for (const entry of area.entries) encodeEntry(writer, entry);
  return encodeFrame(writer.finish());
}

export function startMockPipe(text: string, path = PIPE_PATH, intervalMs = 1000): Promise<Server> {
  const frames = parseReplay(text).map(encodeArea);
  const server = createServer((socket: Socket) => {
    socket.write(encodeVersion());
    socket.write(encodeSessionStart('Rationarium Pipe-Mock'));
    let index = 0;
    const send = () => { if (!socket.destroyed) socket.write(frames[index++ % frames.length]); };
    send();
    const timer = setInterval(send, intervalMs);
    socket.on('close', () => clearInterval(timer));
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(path, () => { server.off('error', reject); resolve(server); });
  });
}
