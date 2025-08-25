// version: v0.1b1
// date: 2025-08-25 08:50 Europe/London
// changelog: slice: fix Amex 2024 date parsing
import * as XLSX from 'xlsx';
import { readFileSync } from 'node:fs';

function looksHeader(row: any[]): boolean {
  const txt = row.map(c => String(c ?? '').toLowerCase());
  const nonEmpty = txt.filter(t => t !== '').length;
  if (nonEmpty < 3) return false;
  const needles = ['date', 'date processed', 'converted date', 'description', 'amount', 'converted £', 'converted'];
  return needles.some(n => txt.some(t => t.includes(n)));
}

const buf = readFileSync(process.argv[2]!);
const wb = XLSX.read(buf, { type: 'buffer' });
const amex = wb.SheetNames.find(n => n.toLowerCase().includes('amex') && n.includes('2024'));
if (!amex) { console.error('No 2024 Amex sheet'); process.exit(1); }
const a1: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[amex], { defval: null, raw: true, header: 1 });

let idx = -1;
for (let i = 0; i < Math.min(500, a1.length); i++) {
  if (looksHeader(a1[i] ?? [])) { idx = i; break; }
}
console.log('HeaderRowIndex=', idx);
if (idx >= 0) {
  console.log('HeaderRowValues=', a1[idx]);
  console.log('NextRowValues=', a1[idx+1]);
} else {
  console.log('No header-like row found in first 500 lines.');
}
