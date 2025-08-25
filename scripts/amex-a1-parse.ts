// version: v0.1b1
// date: 2025-08-25 08:50 Europe/London
// changelog: slice: fix Amex 2024 date parsing
import * as XLSX from 'xlsx';
import { readFileSync } from 'node:fs';
import dayjs from 'dayjs';

function normalizeExcelDate(n: number): string {
  const ms = Math.round(n * 86400000);
  const base = Date.UTC(1899, 11, 30);
  return dayjs(base + ms).format('YYYY-MM-DD');
}

const buf = readFileSync(process.argv[2]!);
const wb = XLSX.read(buf, { type: 'buffer' });
const amex = wb.SheetNames.find(n => n.toLowerCase().includes('amex') && n.includes('2024'))!;
const a1: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[amex], { defval: null, raw: true, header: 1 });

const hdrIdx = Number(process.argv[3] || NaN);
if (!Number.isFinite(hdrIdx)) { console.error('Usage: tsx scripts/amex-a1-parse.ts <file> <headerRowIndex>'); process.exit(1); }

const hdr = (a1[hdrIdx] ?? []).map(x => String(x ?? '').trim().toLowerCase());
const rowStart = hdrIdx + 1;

// find important column indexes by *content*
const idxDate = [ 'date processed','converted date','post date','date ','date','transaction date','posting date' ]
  .map(k => hdr.indexOf(k)).find(i => i >= 0);
const idxAmt = [ 'converted £','converted gbp','amount','gbp amount','billed amount','charge amount','value' ]
  .map(k => hdr.indexOf(k)).find(i => i >= 0);
const idxDesc = [ 'description','merchant name','extended details','details','doing business as' ]
  .map(k => hdr.indexOf(k)).find(i => i >= 0);

console.log('Picked indexes:', { idxDate, idxAmt, idxDesc });

let count = 0;
const sample: any[] = [];
for (let r = rowStart; r < a1.length; r++) {
  const row = a1[r] ?? [];
  const d = row[idxDate!];
  const a = row[idxAmt!];
  const desc = row[idxDesc!];

  if (d == null || a == null) continue;

  // date
  let iso: string;
  if (typeof d === 'number') iso = normalizeExcelDate(d);
  else {
    const t = String(d).trim();
    const tryParse = dayjs(t, ['YYYY-MM-DD','DD/MM/YYYY','MM/DD/YYYY','D/M/YYYY','M/D/YYYY'], true);
    iso = tryParse.isValid() ? tryParse.format('YYYY-MM-DD') : dayjs(t).format('YYYY-MM-DD');
  }

  // amount
  const num = Number(String(a).replace(/[£ ,]/g,''));
  if (!Number.isFinite(num)) continue;

  // merchant/desc
  const m = desc == null ? undefined : String(desc);

  count++;
  if (sample.length < 3) sample.push({ postedDate: iso, amount: num, description: m });
}
console.log('Amex parseable rows:', count);
console.log('Amex first 3:', sample);
