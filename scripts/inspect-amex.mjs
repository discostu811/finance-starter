// version: finance-v0.1b1-patch1
// date: 2025-08-25 09:24 Europe/London
// changelog: fix import to .ts and document running with ts-node ESM loader

// NOTE: Run with:
//   node --loader ts-node/esm scripts/inspect-amex.mjs data/amex/2024/*.xlsx

import ExcelJS from 'exceljs';
import path from 'node:path';
import url from 'node:url';

// Import the TypeScript parser directly; requires ts-node ESM loader
import * as Amex from '../lib/parsers/amex.ts'; // <-- .ts extension required

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function log(...args) { console.log('[diag][amex]', ...args); }
function warn(...args) { console.warn('[warn][amex]', ...args); }
function err(...args) { console.error('[err][amex]', ...args); }

async function inspectOne(file) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  log('file:', file, 'sheets:', wb.worksheets.length);

  for (const ws of wb.worksheets) {
    log('sheet:', ws.name, 'rows:', ws.rowCount);
    // assume header row is first
    const headerRow = ws.getRow(1);
    const headers = headerRow.values.filter(Boolean).map(v => String(v).trim());
    log('headers:', headers);

    // sample first few data rows
    for (let r = 2; r <= Math.min(ws.rowCount, 6); r++) {
      const row = ws.getRow(r);
      const obj = {};
      for (let c = 1; c <= headers.length; c++) {
        const h = headers[c-1];
        const v = row.getCell(c).value;
        obj[h] = typeof v === 'object' && v && 'text' in v ? v.text : v;
      }

      const raw = obj['Date'] ?? obj['date'] ?? obj['Trans. Date'] ?? obj['Transaction Date'] ?? obj['Posted Date'] ?? '';
      let iso = null, detected = null, error = null;
      try {
        const res = Amex.parseAmexDate(raw);
        iso = res.iso;
        detected = res.format;
      } catch (e) {
        error = e?.message || String(e);
      }
      console.log(JSON.stringify({ type: 'sample-row', sheet: ws.name, raw, iso, detected, error }));
    }
  }
}

async function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error('Usage: node --loader ts-node/esm scripts/inspect-amex.mjs <globbed .xlsx files>');
    process.exit(2);
  }
  for (const f of files) {
    try { await inspectOne(f); }
    catch (e) { err('failed', f, e?.message || e); }
  }
}

main().catch(e => err('fatal', e?.message || e));
