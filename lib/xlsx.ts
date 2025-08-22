// lib/xlsx.ts
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import { readFileSync } from 'node:fs';
import { CanonicalTxn, DetailTruthRow } from './types';

function normalizeDate(input: any): string {
  // Handle Excel serial numbers without relying on XLSX.SSF (works in ESM)
  if (typeof input === 'number') {
    const serial = input;
    // Excel's epoch is 1899-12-30 (accounts for the 1900 leap-year bug)
    const ms = Math.round(serial * 86400000);
    const base = Date.UTC(1899, 11, 30, 0, 0, 0);
    const iso = dayjs(base + ms).format('YYYY-MM-DD');
    return iso;
  }
  const txt = String(input ?? '').trim();
  if (!txt) throw new Error('Empty date cell');
  const fmts = ['YYYY-MM-DD','DD/MM/YYYY','MM/DD/YYYY','D/M/YYYY','M/D/YYYY','YYYY/M/D','DD.MM.YYYY','D.M.YYYY','YYYY.MM.DD'];
  for (const f of fmts) {
    const dt = dayjs(txt, f, true);
    if (dt.isValid()) return dt.format('YYYY-MM-DD');
  }
  const d = dayjs(txt);
  if (d.isValid()) return d.format('YYYY-MM-DD');
  throw new Error(`Unparseable date: ${input}`);
}

function toNumber(v: any): number {
  if (typeof v === 'number') return v;
  const s = String(v ?? '').replace(/[ ,]/g, '').replace(/[£$]/g, '');
  if (s === '' || s === '-') return 0;
  const n = Number(s);
  if (Number.isNaN(n)) throw new Error(`Unparseable number: ${v}`);
  return n;
}

function findKey(row: any, wants: string[]): string | undefined {
  const keys = Object.keys(row || {});
  const lower = keys.map(k => k.toLowerCase().trim());
  for (const want of wants) {
    const i = lower.indexOf(want.toLowerCase().trim());
    if (i >= 0) return keys[i];
  }
  for (const want of wants) {
    const i = lower.findIndex(k => k.includes(want.toLowerCase()));
    if (i >= 0) return keys[i];
  }
  return undefined;
}

// If export produced empty headers and put real headers in first data row,
// rebuild rows so that rows[0] becomes header and content starts at row 1.
function reheaderIfNeeded(ws: XLSX.WorkSheet): any[] {
  const rowsA1: any[][] = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true, header: 1 });
  const header = rowsA1[0] ?? [];
  const allNullHeader = header.every(h => h === null || h === undefined || String(h).trim() === '');
  if (!allNullHeader) {
    // normal case; return object rows
    return XLSX.utils.sheet_to_json(ws, { defval: null, raw: true });
  }
  // Use first non-empty row as header, remainder as data
  const firstData = rowsA1[1] ?? [];
  const hdr = firstData.map((h: any) => (h == null ? '' : String(h).trim()));
  const data = rowsA1.slice(2); // start after the header row we promoted
  // Build objects using promoted header
  const out: any[] = data.map(r => {
    const obj: any = {};
    for (let i = 0; i < hdr.length; i++) {
      const key = hdr[i] && hdr[i] !== '' ? hdr[i] : `col_${i}`;
      obj[key] = r[i] ?? null;
    }
    return obj;
  });
  return out;
}

/**
 * Robust card parser:
 * - Handles headerless Amex export (promotes first data row to header).
 * - Supports single "Amount" or "Debit"/"Credit".
 * - Heuristic to normalize sign: if median(raw Amount) > 0 => positive means expense;
 *   else negative means expense. Output: expenses POSITIVE, credits NEGATIVE.
 */
export function parseCardSheet(ws: XLSX.WorkSheet, source: 'amex' | 'mc'): CanonicalTxn[] {
  let rows: any[] = reheaderIfNeeded(ws);
  if (!rows.length) return [];

  const kDate = findKey(rows[0], ['Post Date','Posted','Date','Transaction Date','Posting Date','Processed Date','Converted date','Date '])!;
  const kAmount = findKey(rows[0], ['Amount','GBP Amount','Billed Amount','Charge Amount','Value','CONVERTED £']);
  const kDebit = findKey(rows[0], ['Debit','Debit Amount']);
  const kCredit = findKey(rows[0], ['Credit','Credit Amount']);
  const kDesc = findKey(rows[0], ['Description','Merchant Name','Extended Details','Memo','Details','Narrative','Doing Business As'] );
  const kCurr = findKey(rows[0], ['Currency','Curr','Currency Code']);

  // Pre-calc polarity for single Amount if present
  let signMultiplier = 1;
  if (kAmount) {
    const samples = rows
      .map(r => r[kAmount])
      .filter(v => v != null && v !== '')
      .map(toNumber)
      .sort((a,b)=>a-b);
    if (samples.length) {
      const mid = samples[Math.floor(samples.length/2)];
      // If median > 0 => positive means expense (e.g., Amex)
      // We want expenses positive -> multiplier = +1
      // Else (median < 0) => negative means expense (e.g., MC) -> multiplier = -1 to flip
      signMultiplier = mid >= 0 ? 1 : -1;
    }
  }

  const out: CanonicalTxn[] = [];
  for (const r of rows) {
    try {
      const dateRaw = kDate ? r[kDate] : undefined;
      if (!dateRaw) continue;
      const iso = normalizeDate(dateRaw);

      let amt: number | undefined;
      if (kAmount) {
        const raw = toNumber(r[kAmount]);
        amt = raw * signMultiplier;
      } else if (kDebit || kCredit) {
        const debit = kDebit ? toNumber(r[kDebit]) : 0;
        const credit = kCredit ? toNumber(r[kCredit]) : 0;
        // debit are expenses, credit are refunds/payments
        amt = debit > 0 ? debit : (credit > 0 ? -credit : 0);
        if (amt === 0) continue;
      } else {
        continue;
      }

      const desc = kDesc ? r[kDesc] : undefined;
      const curr = kCurr ? r[kCurr] : undefined;

      out.push({
        source,
        postedDate: iso,
        amount: amt,
        currency: curr ? String(curr) : undefined,
        merchantRaw: desc ? String(desc) : undefined,
        descriptionRaw: desc ? String(desc) : undefined,
      });
    } catch {
      continue;
    }
  }
  return out;
}

/**
 * Extract ground truth from "Detail".
 * Fallbacks:
 *  - If Year/Month columns are unnamed (e.g., __EMPTY), use positional columns [0]=year, [2]=monthNumber.
 *  - Income total: sum of columns whose header contains "salary" (absolute values of negatives).
 *  - Expenses total: prefer "Total expenses" if present; else sum of non-salary positive columns.
 */
export function parseDetailTruth(ws: XLSX.WorkSheet, year: number): DetailTruthRow[] {
  const rowsA1: any[][] = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true, header: 1 });
  if (!rowsA1.length) return [];

  const header: string[] = (rowsA1[0] ?? []).map(h => (h == null ? '' : String(h)));
  const body = rowsA1.slice(1);

  const idxYear = header.findIndex(h => h.toLowerCase() === 'year');
  const idxMonthNum = header.findIndex(h => h.toLowerCase() === 'month' || h.toLowerCase() === 'mm');
  const idxTotalExpenses = header.findIndex(h => h.toLowerCase().includes('total expenses'));

  const posYear = idxYear >= 0 ? idxYear : 0;
  const posMonthNum = idxMonthNum >= 0 ? idxMonthNum : 2; // your sheet shows month number at col 2
  const hasTotalExpenses = idxTotalExpenses >= 0;

  // Salary columns detection
  const salaryCols = header
    .map((h, i) => ({ h: h.toLowerCase(), i }))
    .filter(x => x.h.includes('salary'))
    .map(x => x.i);

  // Helper to numeric
  const asNum = (x: any) => {
    const n = Number(String(x ?? '').replace(/[,£ ]/g, ''));
    return Number.isFinite(n) ? n : 0;
  };

  const out: DetailTruthRow[] = [];

  for (const row of body) {
    const y = Number(row[posYear]);
    const m = Number(row[posMonthNum]);
    if (!y || !m || m < 1 || m > 12) continue;
    if (y !== year) continue;

    // Income total: sum salary columns (use absolute values)
    let incomeTotal = 0;
    for (const i of salaryCols) {
      const v = asNum(row[i]);
      incomeTotal += Math.abs(v);
    }

    let expensesTotal = 0;
    if (hasTotalExpenses) {
      expensesTotal = Math.abs(asNum(row[idxTotalExpenses]));
    } else {
      // Sum positive non-salary columns
      for (let i = 0; i < header.length; i++) {
        if (salaryCols.includes(i)) continue;
        const v = asNum(row[i]);
        if (v > 0) expensesTotal += v;
      }
    }

    out.push({ year, month: m, incomeTotal: +incomeTotal.toFixed(2), expensesTotal: +expensesTotal.toFixed(2) });
  }

  out.sort((a, b) => a.month - b.month);
  return out;
}

export function loadWorkbook(path: string) {
  const buf = readFileSync(path);
  const wb = XLSX.read(buf, { type: 'buffer', cellDates: false });
  return wb;
}
