// scripts/etl-compare-2024.ts
import * as XLSX from 'xlsx';
import { loadWorkbook, parseCardSheet, parseDetailTruth } from '../lib/xlsx';
import { rollupMonthly } from '../lib/rollup';
import { compareToTruth, printVarianceTable } from '../lib/comparator';
import { CanonicalTxn } from '../lib/types';

async function main() {
  const path = process.argv[2];
  if (!path) {
    console.error('Usage: npm run compare:2024 -- ./data/Savings.xlsx');
    process.exit(1);
  }

  const wb = loadWorkbook(path);

  const names = wb.SheetNames;
  const amexName = names.find(n => n.toLowerCase().includes('2024') && n.toLowerCase().includes('amex'));
  const mcName   = names.find(n => n.toLowerCase().includes('2024') && (n.toLowerCase().includes('mc') || n.toLowerCase().includes('master')));
  const detailName = names.find(n => n.toLowerCase().includes('detail'));

  if (!amexName) throw new Error('Could not find "2024 amex" sheet');
  if (!mcName) throw new Error('Could not find "2024 mc" sheet');
  if (!detailName) throw new Error('Could not find "Detail" sheet');

  console.log(`Sheets: amex="${amexName}", mc="${mcName}", detail="${detailName}"`);

  const amexWs = wb.Sheets[amexName];
  const mcWs = wb.Sheets[mcName];
  const detailWs = wb.Sheets[detailName];

  const amexTx = parseCardSheet(amexWs, 'amex');
  const mcTx = parseCardSheet(mcWs, 'mc');
  const all: CanonicalTxn[] = [...amexTx, ...mcTx];

  console.log(`Parsed: amex rows=${amexTx.length}, mc rows=${mcTx.length}, total=${all.length}`);

  const our = rollupMonthly(2024, all);
  const truth = parseDetailTruth(detailWs, 2024);

  if (truth.length === 0) {
    console.error('No truth rows found for 2024 in "Detail" — run inspect:2024 and adjust lib/xlsx.ts');
    process.exit(2);
  }

  const variance = compareToTruth(our, truth);
  printVarianceTable(variance);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
