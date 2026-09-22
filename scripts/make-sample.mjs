import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const areas = [
  { sessionId: 1, sessionGuid: 11701, islandId: 1, areaName: 'Nova Roma', multiplier: 1.3 },
  { sessionId: 1, sessionGuid: 11701, islandId: 2, areaName: 'Portus Aureus', multiplier: 0.85 },
  { sessionId: 2, sessionGuid: 11702, islandId: 1, areaName: 'Albion Magna', multiplier: 0.68 },
];
const goods = [
  [1001, 52, 38, 104, 6, 72, 2001], [1002, 34, 43, 138, 5, 78, 2001],
  [1003, 28, 25, 84, 4, 95, 2001], [1004, 20, 14, 168, 3, 87, 2001],
  [1005, 18, 21, 250, 4, 91, 2002], [1006, 27, 20, 117, 4, 100, 2001],
  [1007, 47, 31, 81, 7, 102, 2001], [1008, 25, 32, 118, 4, 74, 2001],
  [1009, 16, 24, 185, 3, 83, 2002], [1010, 12, 9, 326, 2, 88, 2002],
  [1011, 10, 14, 338, 2, 67, 2002], [1012, 7, 5, 481, 1, 93, 2002],
];
const lines = [];
for (let frame = 0; frame < 12; frame++) {
  for (let a = 0; a < areas.length; a++) {
    const area = areas[a];
    const entries = goods.map(([productGuid, baseGen, baseCon, price, buildings, productivity, workforceGuid], i) => {
      const wave = Math.sin(frame * 0.8 + i * 1.7 + a) * 2.2;
      const generation = Math.max(0, Math.round((baseGen + wave) * area.multiplier * 10) / 10);
      const consumption = Math.max(0, Math.round((baseCon + Math.cos(frame * 0.5 + i + a) * 1.2) * area.multiplier * 10) / 10);
      const amountOfBuildings = Math.max(1, Math.round(buildings * area.multiplier));
      const averageProductivity = Math.min(120, productivity + Math.round(Math.sin(frame + i) * 4));
      return {
        productGuid, generation, consumption, delta: Math.round((generation - consumption) * 10) / 10,
        perfectGeneration: Math.round(generation * 100 / averageProductivity * 10) / 10,
        perfectConsumption: Math.round(consumption * 1.04 * 10) / 10,
        amountOfBuildings, totalMaintenance: amountOfBuildings * 42,
        totalIncome: Math.round(generation * price * 0.35),
        totalProfit: Math.round(generation * price * 0.35 - amountOfBuildings * 42),
        summedProductivity: averageProductivity * amountOfBuildings, averageProductivity,
        workforces: { [workforceGuid]: amountOfBuildings * (workforceGuid === 2001 ? 12 : 8) },
        buildings: { [3000 + productGuid]: amountOfBuildings },
        stock: Math.max(0, Math.round(45 + i * 5 + Math.sin(frame + a) * 6)),
      };
    });
    lines.push(JSON.stringify({ ...area, areaIndex: 0, timestamp: 1735000000000 + frame * 3000, entries }));
  }
}
const dir = join(root, 'data', 'samples');
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'replay_sample.jsonl'), lines.join('\n') + '\n');
