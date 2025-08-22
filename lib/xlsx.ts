import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import { readFileSync } from 'node:fs';
import { CanonicalTxn, DetailTruthRow } from './types';

function normalizeDate(input: any): string {
  // ESM-safe Excel serial conversion (no SSF)
  if (typeof input === 'number') {
    const serial = input;
    const ms = Math.round(serial * 86400000);        // days -> ms
    const base = Date.UTC(1899, 11, 30, 0, 0, 0);    // Excel epoch with 1900 bug accounted
    return dayjs(base + ms).format('YYYY-MM-DD');
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

/**
 * Some exports (your 2024 Amex) have an "empty" header row (nulls)
 * and put the real header labels in the FIRST DATA ROW.
 * This promotes that row to be the header and builds objects for the rest.
 */
function reheaderIfNeeded(ws: XLSX.WorkSheet): any[] {
  const rowsA1: any[][] = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true, header: 1 });
  const header = rowsA1[0] ?? [];
  const allNullHeader = header.every(h => h === null || h === undefined || String(h).trim() === '');
  if (!allNullHeader) {
    return XLSX.utils.sheet_to_json(ws, { defval: null, raw: true });
  }
  const firstData = rowsA1[1] ?? [];
  const hdr = firstData.map((h: any) => (h == null ? '' : String(h).trim()));
  const data = rowsA1.slice(2);
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
 * - Promotes header row if needed (Amex 2024 case).
 * - Supports single "Amount" OR split "Debit/ Credit".
 * - Date keys include "Date " (with space) and "Converted date".
 * - For single Amount sheets, we keep the sign as-is for Amex positives=expense (refunds negative).
 *   For MC, we prefer the "CONVERTED £" column which already has expense positive, payments negative.
 * Output invariant: expenses POSITIVE, credits/refunds NEGATIVE.
 */
export function parseCardSheet(ws: XLSX.WorkSheet, source: 'amex' | 'mc'): CanonicalTxn[] {
  let rows: any[] = reheaderIfNeeded(ws);
  if (!rows.length) return [];

  // MC uses both "Date " and "Converted date"; Amex has "Date" too
  const kDate = findKey(rows[0], ['Post Date','Posted','Date','Date ','Transaction Date','Posting Date','Processed Date','Converted date'])!;
  // Prefer MC "CONVERTED £" if present, otherwise generic Amounts
  const kAmountPref = findKey(rows[0], ['CONVERTED £','Converted £']);
  const kAmount = kAmountPref ?? findKey(rows[0], ['Amount','GBP Amount','Billed Amount','Charge Amount','Value']);
  const kDebit = findKey(rows[0], ['Debit','Debit Amount']);
  const kCredit = findKey(rows[0], ['Credit','Credit Amount']);
  const kDesc = findKey(rows[0], ['Description','Merchant Name','Extended Details','Memo','Details','Narrative','Doing Business As'] );
  const kCurr = findKey(rows[0], ['Currency','Curr','Currency Code']);

  const out: CanonicalTxn[] = [];
  for (const r of rows) {
    try {
      const dateRaw = kDate ? r[kDate] : undefined;
      if (!dateRaw) continue;
      const iso = normalizeDate(dateRaw);

      let amt: number | undefined;
      if (kAmount) {
        const raw = toNumber(r[kAmount]);
        // If using MC "CONVERTED £" or generic Amount: treat positive as expense, negatives as refund/payment.
        amt = raw;
      } else if (kDebit || kCredit) {
        const debit = kDebit ? toNumber(r[kDebit]) : 0;
        const credit = kCredit ? toNumber(r[kCredit]) : 0;
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
 * - First 3 columns may be unnamed; use positional fallback: [0]=year, [2]=month number.
 * - Income = sum(abs) of all columns with "salary" in the header.
 * - Expenses = "Total expenses" if present; else sum of positive non-salary columns.
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
  const posMonthNum = idxMonthNum >= 0 ? idxMonthNum : 2;

  const salaryCols = header
    .map((h, i) => ({ h: h.toLowerCase(), i }))
    .filter(x => x.h.includes('salary'))
    .map(x => x.i);

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

    let incomeTotal = 0;
    for (const i of salaryCols) incomeTotal += Math.abs(asNum(row[i]));

    let expensesTotal = 0;
    if (idxTotalExpenses >= 0) {
      expensesTotal = Math.abs(asNum(row[idxTotalExpenses]));
    } else {
      for (let i = 0; i < header.length; i++) {
        if (salaryCols.includes(i)) continue;
        const v = asNum(row[i]);
        if (v > 0) expensesTotal += v;
      }
    }

    out.push({ year: y, month: m, incomeTotal: +incomeTotal.toFixed(2), expensesTotal: +expensesTotal.toFixed(2) });
  }

  out.sort((a, b) => a.month - b.month);
  return out;
}

export function loadWorkbook(path: string) {
  const buf = readFileSync(path);
  return XLSX.read(buf, { type: 'buffer', cellDates: false });
}
