import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outputPath = path.join(root, 'data', 'scholarships.json');

const OIA_JSON_URL =
  'https://oia.nycu.edu.tw/oia/ch/app/openData/data/list?module=nycu0007&mserno=0&type=json&id=716';

const items = await fetch(OIA_JSON_URL).then((r) => r.json());
const payload = {
  synced_at: new Date().toISOString(),
  source: 'https://oia.nycu.edu.tw/oia/ch/app/data/list?module=nycu0007&id=716',
  items: Array.isArray(items) ? items : [],
};

fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2), 'utf8');
console.log(`Saved ${payload.items.length} scholarship items to ${outputPath}`);
