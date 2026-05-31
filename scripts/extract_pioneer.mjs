/**
 * Mark 拓荒者計畫 schools using manual name list or Excel (if exceljs available).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const xlsxPath = path.join(root, 'data', 'List of Partner Institutions for Outbound Exchange.xlsx');
const manualPath = path.join(root, 'data', 'pioneer_school_names.json');
const schoolsPath = path.join(root, 'data', 'nycu_191_clean.json');

function normalizeName(text) {
  return String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]+/g, ' ');
}

function isPurpleColor(color) {
  if (!color) return false;
  if (color.argb) {
    const hex = color.argb.slice(-6);
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return b > 90 && r > 70 && g < 200 && b > r;
  }
  return color.theme === 5 || color.theme === 7;
}

async function extractFromXlsx() {
  if (!fs.existsSync(xlsxPath)) return [];
  try {
    const exceljsPath = path.resolve(__dirname, 'next-dashboard/node_modules/exceljs/excel.js');
    const { default: ExcelJS } = await import(exceljsPath);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(xlsxPath);
    const sheet = workbook.worksheets[0];
    const pioneers = [];
    sheet.eachRow((row) => {
      const cell = row.getCell(2);
      const value = String(cell.value ?? '').trim();
      if (!value || value.includes('Institution') || value.includes('Country')) return;
      if (isPurpleColor(cell.font?.color)) pioneers.push(value);
    });
    return pioneers;
  } catch {
    return [];
  }
}

function matchSchools(pioneerNames, schools) {
  const matched = new Set();
  for (const pioneer of pioneerNames) {
    const key = normalizeName(pioneer);
    for (const school of schools) {
      const candidates = [school.name, school.name_en, `${school.name} ${school.name_en}`];
      if (candidates.some((c) => normalizeName(c).includes(key) || key.includes(normalizeName(c)))) {
        matched.add(school.id);
      }
    }
  }
  return matched;
}

const schools = JSON.parse(fs.readFileSync(schoolsPath, 'utf8'));
let pioneerNames = await extractFromXlsx();

if (pioneerNames.length === 0 && fs.existsSync(manualPath)) {
  pioneerNames = JSON.parse(fs.readFileSync(manualPath, 'utf8'));
  console.log(`Using manual pioneer list (${pioneerNames.length} names)`);
}

const matchedIds = matchSchools(pioneerNames, schools);
const enriched = schools.map((school) => ({ ...school, is_pioneer: matchedIds.has(school.id) }));
fs.writeFileSync(schoolsPath, JSON.stringify(enriched, null, 2), 'utf8');
console.log(`Pioneer schools marked: ${matchedIds.size} / ${schools.length}`);
