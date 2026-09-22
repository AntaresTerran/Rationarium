import type { AreaStatistics, ProductionEntry } from './types';

export const PIPE_PATH = String.raw`\\.\pipe\anno117`;
export const PROTOCOL_VERSION = 2;
export const MAX_MESSAGE_SIZE = 1024 * 1024;
export const enum MessageType {
  Version = 0,
  SessionStart = 1,
  SessionEnd = 2,
  AreaProductionStatistics = 3,
}

export type PipeMessage =
  | { type: MessageType.Version; version: number }
  | { type: MessageType.SessionStart; name: string }
  | { type: MessageType.SessionEnd }
  | { type: MessageType.AreaProductionStatistics; area: AreaStatistics };

class Reader {
  private offset = 0;
  constructor(private readonly data: Buffer) {}
  private take(bytes: number): number {
    if (bytes < 0 || this.offset + bytes > this.data.length) throw new Error('Truncated pipe message');
    const at = this.offset;
    this.offset += bytes;
    return at;
  }
  u8(): number { return this.data.readUInt8(this.take(1)); }
  i32(): number { return this.data.readInt32LE(this.take(4)); }
  i64(): number { return Number(this.data.readBigInt64LE(this.take(8))); }
  f32(): number {
    const value = this.data.readFloatLE(this.take(4));
    if (!Number.isFinite(value)) throw new Error('Non-finite pipe value');
    return value;
  }
  string(): string {
    const length = this.u8();
    return this.data.toString('utf8', this.take(length), this.offset);
  }
  count(minBytes: number): number {
    const count = this.i32();
    if (count < 0 || count > (this.data.length - this.offset) / minBytes) throw new Error('Invalid pipe entry count');
    return count;
  }
  map(): Record<string, number> {
    const result: Record<string, number> = {};
    const count = this.count(8);
    for (let i = 0; i < count; i++) {
      const guid = this.i32();
      result[guid] = (result[guid] || 0) + this.i32();
    }
    return result;
  }
  remaining(): number { return this.data.length - this.offset; }
}

function parseEntry(reader: Reader): ProductionEntry {
  const productGuid = reader.i32();
  const generation = reader.f32();
  const consumption = reader.f32();
  const delta = reader.f32();
  const perfectGeneration = reader.f32();
  const perfectConsumption = reader.f32();
  const amountOfBuildings = reader.i32();
  const totalMaintenance = reader.i32();
  const totalIncome = reader.f32();
  const totalProfit = reader.i32();
  const summedProductivity = reader.f32();
  const averageProductivity = reader.f32();
  const workforces = reader.map();
  const buildings = reader.map();
  return { productGuid, generation, consumption, delta, perfectGeneration, perfectConsumption,
    amountOfBuildings, totalMaintenance, totalIncome, totalProfit, summedProductivity,
    averageProductivity, workforces, buildings };
}

export function parseMessage(data: Buffer): PipeMessage {
  const reader = new Reader(data);
  const type = reader.u8();
  let result: PipeMessage;
  switch (type) {
    case MessageType.Version:
      result = { type, version: reader.i32() }; break;
    case MessageType.SessionStart:
      result = { type, name: reader.string() }; break;
    case MessageType.SessionEnd:
      result = { type }; break;
    case MessageType.AreaProductionStatistics: {
      const sessionId = reader.u8();
      const islandId = reader.u8();
      const areaIndex = reader.u8();
      const sessionGuid = reader.i32();
      const areaName = reader.string();
      const timestamp = reader.i64();
      const count = reader.count(56);
      const entries: ProductionEntry[] = [];
      for (let i = 0; i < count; i++) entries.push(parseEntry(reader));
      result = { type, area: { sessionId, islandId, areaIndex, sessionGuid, areaName, timestamp, entries } };
      break;
    }
    default: throw new Error(`Unknown pipe message type ${type}`);
  }
  if (reader.remaining() !== 0) throw new Error('Trailing bytes in pipe message');
  return result;
}

export class FrameDecoder {
  private pending = Buffer.alloc(0);
  push(chunk: Buffer): PipeMessage[] {
    this.pending = Buffer.concat([this.pending, chunk]);
    const messages: PipeMessage[] = [];
    while (this.pending.length >= 4) {
      const length = this.pending.readInt32LE(0);
      if (length < 1 || length > MAX_MESSAGE_SIZE) {
        this.pending = Buffer.alloc(0);
        throw new Error(`Invalid pipe frame length ${length}`);
      }
      if (this.pending.length < length + 4) break;
      messages.push(parseMessage(this.pending.subarray(4, length + 4)));
      this.pending = this.pending.subarray(length + 4);
    }
    return messages;
  }
  reset(): void { this.pending = Buffer.alloc(0); }
}
