export interface ManualStock {
  value: number;
  recordedAt: number;
}

export type ManualStocks = Record<string, ManualStock>;

// The game can pause, change speed, trade goods, or consume them outside the
// production statistics. A manually observed amount must not look live forever.
export const STOCK_FRESH_MS = 10 * 60 * 1000;

export function stockKey(sessionInstance: string | null, scope: string, productGuid: number): string {
  return JSON.stringify([sessionInstance || '', scope, productGuid]);
}

export function readManualStocks(raw: string | null, now = Date.now()): ManualStocks {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const result: ManualStocks = {};
    for (const [key, candidate] of Object.entries(parsed).slice(0, 5000)) {
      if (!candidate || typeof candidate !== 'object') continue;
      const value = (candidate as ManualStock).value;
      const recordedAt = (candidate as ManualStock).recordedAt;
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 ||
          typeof recordedAt !== 'number' || !Number.isFinite(recordedAt) ||
          recordedAt > now + 60_000 || now - recordedAt > 24 * 60 * 60 * 1000) continue;
      result[key] = { value, recordedAt };
    }
    return result;
  } catch { return {}; }
}

export function isFreshStock(stock: ManualStock | undefined, now: number): boolean {
  return !!stock && now >= stock.recordedAt && now - stock.recordedAt < STOCK_FRESH_MS;
}

export function minutesUntilEmpty(stock: number | undefined, delta: number): number | null {
  if (stock === undefined || !Number.isFinite(stock) || stock < 0 ||
      !Number.isFinite(delta) || delta >= -0.05) return null;
  return stock / -delta;
}
