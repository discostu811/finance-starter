import * as XLSX from 'xlsx';
import { loadWorkbook, parseCardSheet } from '../lib/xlsx';

function keysOfFirstObject(ws: XLSX.WorkSheet) {
  const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true });
  return rows.length ? Object.keys(rows[0]) : [];
}

async function main() {
  const path = process.argv[2];
  if (!path) {
    console.error('Usage: tsx scripts/debug-parse.ts ./data/Savings.xlsx');
    process.exit(1);
  }
  const wb = loadWorkbook(path);
  const amexName = wb.SheetNames.find(n => n.toLowerCase().includes('2024') && n.toLowerCase().includes('amex'));
  const mcName   = wb.SheetNames.find(n => n.toLowerCase().includes('2024') && (n.toLowerCase().includes('mc') || n.toLowerCase().includes('master')));

  if (!amexName || !mcName) {
    console.error('Could not find 2024 amex or 2024 mc'); process.exit(1);
  }

  const amexWs = wb.Sheets[amexName];
  const mcWs   = wb.Sheets[mcName];

  console.log('Amex raw first-row keys:', keysOfFirstObject(amexWs));
  console.log('MC   raw first-row keys:', keysOfFirstObject(mcWs));

  const amex = parseCardSheet(amexWs, 'amex');
  const mc   = parseCardSheet(mcWs, 'mc');
  console.log(`Parsed counts: amex=${amex.length}, mc=${mc.length}`);
  console.log('Amex first 3:', amex.slice(0,3));
  console.log('MC   first 3:', mc.slice(0,3));
}
main().catch(e => { console.error(e); process.exit(1); });
