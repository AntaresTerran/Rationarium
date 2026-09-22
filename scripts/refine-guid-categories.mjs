import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const englishPath = join(root, 'data', 'guid_mappings_en.json');
const english = JSON.parse(readFileSync(englishPath, 'utf8'));
const changes = new Map();
const materials = /^(wood|limestone|silver ore|iron ore|uncut marble|coal|clay|silica|copper ore|tin ore|granite block|mud|reeds|leather|iron|glass|ornate wood|bronze|chassis|silver|resin|gold ore|gold|minerals|obsidian|sandarac wood)$/i;
const foods = /^(sturgeon|mackerel|barley|auroch|aurochs|small birds|oysters|sheep|pigs|lard|bird tongues|caviar|herbs)$/i;
const drinks = /^(grapes|malt)$/i;
const luxuries = /^(pigments|celtic green|tyrian purple|cushions|head piece|murex snails|seashells)$/i;
for (const [guid, value] of Object.entries(english)) {
  if (value.category !== 'other') continue;
  if (materials.test(value.name)) changes.set(guid, 'materials');
  else if (foods.test(value.name)) changes.set(guid, 'food');
  else if (drinks.test(value.name)) changes.set(guid, 'drink');
  else if (luxuries.test(value.name)) changes.set(guid, 'luxury');
}
for (const language of ['de', 'en']) {
  const path = join(root, 'data', `guid_mappings_${language}.json`);
  const mapping = JSON.parse(readFileSync(path, 'utf8'));
  for (const [guid, category] of changes) mapping[guid].category = category;
  writeFileSync(path, JSON.stringify(mapping, null, 2) + '\n');
}
