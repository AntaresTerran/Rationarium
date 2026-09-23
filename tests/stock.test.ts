import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isFreshStock, minutesUntilEmpty, readManualStocks, stockKey, STOCK_FRESH_MS } from '../src/client/src/stock';

test('manual stock belongs to the selected game session and scope', () => {
  assert.notEqual(stockKey('Roma', 'all', 2068), stockKey('Roma', '3245_1', 2068));
  assert.notEqual(stockKey('Roma', '3245_1', 2068), stockKey('Roma', '3245_1', 2069));
  assert.notEqual(stockKey('Roma', '3245_1', 2068), stockKey('Albion', '3245_1', 2068));
});

test('manual stock expires before it can be used as a live forecast', () => {
  const now = 1_000_000;
  const entry = { value: 30, recordedAt: now - STOCK_FRESH_MS + 1 };
  assert.equal(isFreshStock(entry, now), true);
  assert.equal(minutesUntilEmpty(entry.value, -2.5), 12);
  assert.equal(isFreshStock(entry, now + 1), false);
  assert.equal(minutesUntilEmpty(undefined, -2.5), null);
  assert.equal(minutesUntilEmpty(30, 0), null);
});

test('stored stock rejects invalid and far-future values', () => {
  const now = 1_000_000;
  const values = readManualStocks(JSON.stringify({
    valid: { value: 0, recordedAt: now },
    negative: { value: -1, recordedAt: now },
    future: { value: 2, recordedAt: now + 120_000 },
    fake: { value: '12', recordedAt: now },
  }), now);
  assert.deepEqual(values, { valid: { value: 0, recordedAt: now } });
  assert.deepEqual(readManualStocks('{', now), {});
});
