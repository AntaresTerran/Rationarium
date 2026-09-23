export type Mode = 'live' | 'demo';
export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'replay';
export type Category = 'food' | 'drink' | 'materials' | 'military' | 'luxury' | 'other';

export interface ProductionEntry {
  productGuid: number;
  generation: number;
  consumption: number;
  delta: number;
  perfectGeneration: number;
  perfectConsumption: number;
  amountOfBuildings: number;
  totalMaintenance: number;
  totalIncome: number;
  totalProfit: number;
  summedProductivity: number;
  averageProductivity: number;
  workforces: Record<string, number>;
  buildings: Record<string, number>;
  stock?: number;
}

export interface AreaStatistics {
  sessionId: number;
  islandId: number;
  areaIndex: number;
  sessionGuid: number;
  areaName: string;
  timestamp: number;
  entries: ProductionEntry[];
}

export interface Island extends AreaStatistics {
  key: string;
  updatedAt: number;
}

export interface TrendPoint {
  at: number;
  delta: number;
}

export interface DashboardState {
  mode: Mode;
  connection: ConnectionStatus;
  sessionName: string | null;
  sessionInstance: string | null;
  protocolVersion: number | null;
  error: string | null;
  islands: Island[];
  trends: Record<string, TrendPoint[]>;
  replay: { name: string; length: number; index: number; playing: boolean; intervalMs: number };
}

export interface GuidMapping {
  name: string;
  category?: Category;
  essential?: boolean;
}

export type GuidMap = Record<string, GuidMapping>;
