import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const dist = join(root, 'dist', 'client');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff' };
const files = {};
function collect(dir) {
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, item.name);
    if (item.isDirectory()) collect(path);
    else {
      const extension = item.name.slice(item.name.lastIndexOf('.'));
      files['/' + relative(dist, path).replaceAll('\\', '/')] = { type: mime[extension] || 'application/octet-stream', base64: readFileSync(path).toString('base64') };
    }
  }
}
collect(dist);
const de = JSON.parse(readFileSync(join(root, 'data', 'guid_mappings_de.json'), 'utf8'));
const en = JSON.parse(readFileSync(join(root, 'data', 'guid_mappings_en.json'), 'utf8'));
const sample = readFileSync(join(root, 'data', 'samples', 'replay_sample.jsonl'), 'utf8');
const real = readFileSync(join(root, 'data', 'samples', 'replay_real.jsonl'), 'utf8');
const widget = readFileSync(join(root, 'src', 'server', 'widget.ps1'), 'utf8');
const output = `import type { GuidMap } from '../shared/types';\nexport const EMBEDDED_FILES: Record<string, {type: string; base64: string}> = ${JSON.stringify(files)};\nexport const GUID_MAP_DE: GuidMap = ${JSON.stringify(de)};\nexport const GUID_MAP_EN: GuidMap = ${JSON.stringify(en)};\nexport const SAMPLE_REPLAY = ${JSON.stringify(sample)};\nexport const REAL_REPLAY = ${JSON.stringify(real)};\nexport const WIDGET_SCRIPT = ${JSON.stringify(widget)};\n`;
writeFileSync(join(root, 'src', 'server', 'embedded.generated.ts'), output);
