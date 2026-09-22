import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';

const source = process.argv[2];
if (!source) throw new Error('Usage: node scripts/import-guid-mappings.mjs <path-to-calculator/js/params.js>');
const sandbox = { window: {} };
runInNewContext(readFileSync(source, 'utf8'), sandbox);
const params = sandbox.window.params;
const root = new URL('../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const food = new Set(params.needs.filter((need) => need.needCategory === 'Food').map((need) => need.needProduct));
const luxury = new Set(params.needs.filter((need) => ['Fashion', 'Household', 'Culture', 'Wonders'].includes(need.needCategory)).map((need) => need.needProduct));
const construction = new Set(params.productFilters.find((filter) => filter.locaText?.english === 'Construction Materials')?.products || []);
const products = [...params.products, ...params.workforce];
for (const language of ['de', 'en']) {
  const path = join(root, 'data', `guid_mappings_${language}.json`);
  const mapping = JSON.parse(readFileSync(path, 'utf8'));
  for (const product of products) {
    const english = product.locaText?.english || product.name || `GUID ${product.guid}`;
    const name = language === 'de' ? (product.locaText?.german || english) : english;
    let category = 'other';
    if (construction.has(product.guid) || product.isConstructionMaterial) category = 'materials';
    else if (/wine|beer|ale|mead|cider|tea|juice|milk|drink/i.test(english)) category = 'drink';
    else if (/weapon|sword|shield|armou?r|spear|bow|arrow/i.test(english)) category = 'military';
    else if (food.has(product.guid) || /fish|grain|oat|wheat|flour|bread|fruit|meat|cheese|egg|vegetable|olive|honey/i.test(english)) category = 'food';
    else if (luxury.has(product.guid) || /jewel|garment|cloth|silk|dye|incense|perfume/i.test(english)) category = 'luxury';
    mapping[product.guid] = { name, category, ...(food.has(product.guid) ? { essential: true } : {}) };
  }
  writeFileSync(path, JSON.stringify(mapping, null, 2) + '\n');
}
await import('./refine-guid-categories.mjs');
