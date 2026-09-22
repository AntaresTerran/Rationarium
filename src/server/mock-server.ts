import type { AreaStatistics, ProductionEntry } from '../shared/types';
import { StateManager } from './state-manager';

function number(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function pick(obj: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) if (obj[key] !== undefined) return obj[key];
  return undefined;
}

function map(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(Object.entries(value).map(([key, amount]) => [key, number(amount)]));
}

function entry(value: unknown): ProductionEntry {
  if (!value || typeof value !== 'object') throw new Error('Invalid replay entry');
  const row = value as Record<string, unknown>;
  return {
    productGuid: number(pick(row, 'productGuid', 'ProductGuid', 'guid')),
    generation: number(pick(row, 'generation', 'productGeneration', 'ProductGeneration')),
    consumption: number(pick(row, 'consumption', 'productConsumption', 'ProductConsumption')),
    delta: number(pick(row, 'delta', 'productDelta', 'ProductDelta')),
    perfectGeneration: number(pick(row, 'perfectGeneration', 'PerfectProductGeneration')),
    perfectConsumption: number(pick(row, 'perfectConsumption', 'PerfectProductConsumption')),
    amountOfBuildings: number(pick(row, 'amountOfBuildings', 'AmountOfBuildings', 'buildings')),
    totalMaintenance: number(pick(row, 'totalMaintenance', 'TotalMaintenance')),
    totalIncome: number(pick(row, 'totalIncome', 'TotalIncome')),
    totalProfit: number(pick(row, 'totalProfit', 'TotalProfit')),
    summedProductivity: number(pick(row, 'summedProductivity', 'SummedProductivity')),
    averageProductivity: number(pick(row, 'averageProductivity', 'AverageProductivity')),
    workforces: map(pick(row, 'workforces', 'workforce', 'workforceGUIDtoAmount', 'WorkforceGUIDtoAmount')),
    buildings: map(pick(row, 'buildingsByGuid', 'buildingGUIDtoAmount', 'BuildingGUIDtoAmount', 'buildings')),
    ...(pick(row, 'stock', 'Stock') === undefined ? {} : { stock: number(pick(row, 'stock', 'Stock')) }),
  };
}

export function parseReplay(text: string): AreaStatistics[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length || lines.length > 10000) throw new Error('Replay needs 1 to 10,000 JSONL records');
  return lines.map((line, index) => {
    let raw: unknown;
    try { raw = JSON.parse(line); } catch { throw new Error(`Invalid JSON on line ${index + 1}`); }
    if (!raw || typeof raw !== 'object') throw new Error(`Invalid record on line ${index + 1}`);
    const outer = raw as Record<string, unknown>;
    const source = (outer.area && typeof outer.area === 'object' ? outer.area : outer) as Record<string, unknown>;
    const entries = pick(source, 'entries', 'productionEntries', 'products', 'productionData');
    if (!Array.isArray(entries) || entries.length > 10000) throw new Error(`Missing entries on line ${index + 1}`);
    const rawSessionGuid = pick(source, 'sessionGuid', 'sessionGUID', 'SessionGUID');
    const rawIslandId = pick(source, 'islandId', 'islandID', 'IslandID');
    const sessionGuid = number(rawSessionGuid);
    const islandId = number(rawIslandId);
    if (rawSessionGuid === undefined || rawIslandId === undefined || !Number.isInteger(sessionGuid) || !Number.isInteger(islandId)) throw new Error(`Invalid island key on line ${index + 1}`);
    return {
      sessionId: number(pick(source, 'sessionId', 'sessionID', 'SessionID')),
      islandId,
      areaIndex: number(pick(source, 'areaIndex', 'AreaIndex')),
      sessionGuid,
      areaName: String(pick(source, 'areaName', 'AreaName', 'name') || `Insel ${islandId}`),
      timestamp: number(pick(source, 'timestamp', 'timeStamp', 'TimeStamp'), Date.now()),
      entries: entries.map(entry),
    };
  });
}

export class ReplayEngine {
  private frames: AreaStatistics[] = [];
  private index = 0;
  private timer: NodeJS.Timeout | null = null;
  constructor(private readonly state: StateManager) {}

  load(text: string, name: string): void {
    const frames = parseReplay(text);
    this.pause();
    this.frames = frames;
    this.index = 0;
    this.state.clear();
    this.state.setReplay({ name, length: frames.length, index: 0 });
    this.step();
  }

  step(): void {
    if (!this.frames.length) return;
    if (this.index >= this.frames.length) {
      this.index = 0;
      this.state.clear();
    }
    this.state.putArea(this.frames[this.index++]);
    this.state.setReplay({ index: this.index });
  }

  play(): void {
    if (this.timer || !this.frames.length) return;
    const interval = this.state.snapshot().replay.intervalMs;
    this.timer = setInterval(() => this.step(), interval);
    this.state.setReplay({ playing: true });
  }

  pause(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.state.setReplay({ playing: false });
  }

  speed(intervalMs: number): void {
    if (!Number.isInteger(intervalMs) || intervalMs < 250 || intervalMs > 10000) throw new Error('Interval must be 250–10000 ms');
    const playing = !!this.timer;
    this.pause();
    this.state.setReplay({ intervalMs });
    if (playing) this.play();
  }
}
