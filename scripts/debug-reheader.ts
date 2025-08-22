import * as XLSX from 'xlsx';
import { readFileSync } from 'node:fs';

function reheaderIfNeeded(ws: XLSX.WorkSheet): any[] {
  const rowsA1: any[][] = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true, header: 1 });
  const header = rowsA1[0] ?? [];
  const allNull = header.every(h => h == null || String(h).trim() === '');
  if (!allNull) return XLSX.utils.sheet_to_json(ws, { defval: null, raw: true });
  const firstData = rowsA1[1] ?? [];
  const hdr = firstData.map((h: any, i: number) => {
    const s = h == null ? '' : String(h).trim();
    return s === '' ? `col_${i}` : s;
  });
  const data = rowsA1.slice(2).map(r => {
    const obj: any = {};
    for (let i = 0; i < hdr.length; i++) obj[hdr[i]] = r[i] ?? null;
    return obj;
  });
  console.log('Promoted headers:', hdr);
  console.log('First mapped row:', data[0]);
  console.log('Row count after reheader:', data.length);
  return data;
}

const buf = readFileSync(process.argv[2]!);
const wb = XLSX.read(buf, { type: 'buffer', cellDates: false });
const amexName = wb.SheetNames.find(n => n.toLowerCase().includes('2024') && n.toLowerCase().includes('amex'));
if (!amexName) { console.error('No 2024 amex sheet'); process.exit(1); }
reheaderIfNeeded(wb.Sheets[amexName]);
