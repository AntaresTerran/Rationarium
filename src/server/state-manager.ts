import { EventEmitter } from 'node:events';
import type { AreaStatistics, ConnectionStatus, DashboardState, Island, Mode, TrendPoint } from '../shared/types';

export class StateManager extends EventEmitter {
  private islands = new Map<string, Island>();
  private trends = new Map<string, TrendPoint[]>();
  private state: Omit<DashboardState, 'islands' | 'trends'> = {
    mode: 'live', connection: 'disconnected', sessionName: null, protocolVersion: null,
    error: null, replay: { name: 'Integrierte Demonstration', length: 0, index: 0, playing: false, intervalMs: 1800 },
  };

  snapshot(): DashboardState {
    return {
      ...this.state,
      replay: { ...this.state.replay },
      islands: [...this.islands.values()].sort((a, b) => a.areaName.localeCompare(b.areaName)),
      trends: Object.fromEntries(this.trends),
    };
  }

  private publish(): void { this.emit('change', this.snapshot()); }

  setMode(mode: Mode): void {
    this.clear();
    this.state.mode = mode;
    this.state.connection = mode === 'demo' ? 'replay' : 'disconnected';
    this.state.error = null;
    this.publish();
  }

  setConnection(connection: ConnectionStatus, error: string | null = null): void {
    this.state.connection = connection;
    this.state.error = error;
    this.publish();
  }

  setVersion(version: number): void { this.state.protocolVersion = version; this.publish(); }
  setSession(name: string): void { this.clear(); this.state.sessionName = name; this.publish(); }
  endSession(): void { this.clear(); this.publish(); }

  clear(): void {
    this.islands.clear();
    this.trends.clear();
    this.state.sessionName = null;
  }

  putArea(area: AreaStatistics): void {
    const key = `${area.sessionGuid}_${area.islandId}`;
    const updatedAt = Date.now();
    this.islands.set(key, { ...area, key, updatedAt });
    for (const entry of area.entries) {
      const trendKey = `${key}:${entry.productGuid}`;
      const points = this.trends.get(trendKey) || [];
      points.push({ at: updatedAt, delta: entry.delta });
      if (points.length > 40) points.shift();
      this.trends.set(trendKey, points);
      const empireKey = `empire:${entry.productGuid}`;
      const empireDelta = [...this.islands.values()].reduce((sum, island) =>
        sum + (island.entries.find((item) => item.productGuid === entry.productGuid)?.delta || 0), 0);
      const empirePoints = this.trends.get(empireKey) || [];
      empirePoints.push({ at: updatedAt, delta: empireDelta });
      if (empirePoints.length > 40) empirePoints.shift();
      this.trends.set(empireKey, empirePoints);
    }
    this.publish();
  }

  setReplay(patch: Partial<DashboardState['replay']>): void {
    this.state.replay = { ...this.state.replay, ...patch };
    this.publish();
  }
}
