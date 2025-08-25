// version: v0.1b1
// date: 2025-08-25 09:10 Europe/London
// changelog: slice: fix Amex 2024 date parsing
// scripts/inspect-headers.ts
import * as XLSX from 'xlsx';
import { loadWorkbook } from '../lib/xlsx';

function headersOfSheet(ws: XLSX.WorkSheet) {
  const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true, header: 1 });
  const header = rows[0] ?? [];
  return header.map((h: any, i: number) => `[${i}] ${String(h)}`);
}

function sampleRows(ws: XLSX.WorkSheet, n = 5) {
  const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true });
  return rows.slice(0, n);
}

async function main() {
  const path = process.argv[2];
  if (!path) {
    console.error('Usage: npm run inspect:2024 -- ./data/Savings.xlsx');
    process.exit(1);
  }

  const wb = loadWorkbook(path);
  const names = wb.SheetNames;
  const amexName = names.find(n => n.toLowerCase().includes('2024') && n.toLowerCase().includes('amex'));
  const mcName   = names.find(n => n.toLowerCase().includes('2024') && (n.toLowerCase().includes('mc') || n.toLowerCase().includes('master')));
  const detailName = names.find(n => n.toLowerCase().includes('detail'));

  console.log('Detected sheets:');
  console.log('  amex   =', amexName);
  console.log('  mc     =', mcName);
  console.log('  detail =', detailName);

  if (amexName) {
    const ws = wb.Sheets[amexName];
    console.log('\n[Headers] 2024 amex');
    console.log(headersOfSheet(ws).join('\n'));
    console.log('\n[Samples] 2024 amex');
    console.log(sampleRows(ws));
  }
  if (mcName) {
    const ws = wb.Sheets[mcName];
    console.log('\n[Headers] 2024 mc');
    console.log(headersOfSheet(ws).join('\n'));
    console.log('\n[Samples] 2024 mc');
    console.log(sampleRows(ws));
  }
  if (detailName) {
    const ws = wb.Sheets[detailName];
    console.log('\n[Headers] Detail');
    console.log(headersOfSheet(ws).join('\n'));
    console.log('\n[Samples] Detail');
    console.log(sampleRows(ws));
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
