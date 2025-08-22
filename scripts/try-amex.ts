import * as XLSX from 'xlsx';
import { readFileSync } from 'node:fs';
import dayjs from 'dayjs';

function normalizeDate(input: any): string {
  if (typeof input === 'number') {
    const ms = Math.round(input * 86400000);
    const base = Date.UTC(1899, 11, 30);
    return dayjs(base + ms).format('YYYY-MM-DD');
  }
  const txt = String(input ?? '').trim();
  const fmts = ['YYYY-MM-DD','DD/MM/YYYY','MM/DD/YYYY','D/M/YYYY','M/D/YYYY','YYYY/M/D','DD.MM.YYYY','D.M.YYYY','YYYY.MM.DD'];
  for (const f of fmts) { const d = dayjs(txt, f, true); if (d.isValid()) return d.format('YYYY-MM-DD'); }
  const d = dayjs(txt); if (d.isValid()) return d.format('YYYY-MM-DD');
  throw new Error(`Unparseable date: ${input}`);
}

function reheader(ws: XLSX.WorkSheet) {
  const a1: any[][] = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true, header: 1 });
  const header = a1[0] ?? [];
  const allNull = header.every(h => h == null || String(h).trim() === '');
  if (!allNull) return { hdr: header.map(String), data: XLSX.utils.sheet_to_json(ws, { defval: null, raw: true }) };
  const hdr = (a1[1] ?? []).map((h: any, i: number) => (h == null || String(h).trim()==='' ? `col_${i}` : String(h).trim()));
  const data = a1.slice(2).map(r => Object.fromEntries(hdr.map((k: string, i: number) => [k, r[i] ?? null])));
  return { hdr, data };
}

const buf = readFileSync(process.argv[2]!);
const wb = XLSX.read(buf, { type: 'buffer' });
const amex = wb.SheetNames.find(n => n.toLowerCase().includes('amex') && n.includes('2024'))!;
const ws = wb.Sheets[amex];
const { hdr, data } = reheader(ws);

const wants = (row: any, names: string[]) => {
  const keys = Object.keys(row);
  const lower = keys.map(k => k.toLowerCase().trim());
  for (const n of names) { const i = lower.indexOf(n.toLowerCase()); if (i>=0) return keys[i]; }
  for (const n of names) { const i = lower.findIndex(k => k.includes(n.toLowerCase())); if (i>=0) return keys[i]; }
  return undefined;
};

const kDate = wants(data[0], ['Date','Date Processed','Converted date','Date ']);
const kAmt  = wants(data[0], ['CONVERTED £','Amount','GBP Amount','Billed Amount','Charge Amount','Value']);

console.log('Picked keys → Date:', kDate, '| Amount:', kAmt);
console.log('First row sample:', data[0]);

let ok = 0;
for (const r of data) {
  try {
    const iso = normalizeDate(r[kDate!]);
    const num = Number(String(r[kAmt!]).replace(/[£ ,]/g,''));
    if (Number.isFinite(num)) ok++;
  } catch {}
}
console.log('Rows parseable with picked keys:', ok, 'of', data.length);
