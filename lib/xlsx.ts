// lib/xlsx.ts
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
 * Very-smart reheader:
 * 1) If header row has values, use it.
 * 2) Else scan the first 500 rows to find the FIRST row that contains header-like tokens:
 *    must include (any of): 'date','date processed','converted date' AND 'description'
 *    AND (any of): 'amount','converted £','converted £' (case-insensitive).
 * 3) If still not found, also look for a row that exactly equals common Amex labels
 *    (e.g., 'Date','Description','Amount','CONVERTED £').
 * 4) Fallback to row 1.
 */
function reheaderVerySmart(ws: XLSX.WorkSheet): any[] {
  const rowsA1: any[][] = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true, header: 1 });
  if (!rowsA1.length) return [];

  const header0 = rowsA1[0] ?? [];
  const header0HasValues = header0.some((h:any) => h != null && String(h).trim() !== '');
  if (header0HasValues) {
    return XLSX.utils.sheet_to_json(ws, { defval: null, raw: true });
  }

  const maxScan = Math.min(rowsA1.length, 500);
  const hasToken = (row: any[], needles: string[]) => {
    const txt = row.map(c => String(c ?? '').toLowerCase().trim());
    return needles.some(n => txt.some(t => t.includes(n)));
  };

  let headerIdx = -1;
  for (let i = 1; i < maxScan; i++) {
    const row = rowsA1[i] ?? [];
    const nonEmpty = row.filter(c => c != null && String(c).trim() !== '').length;
    if (nonEmpty < 3) continue;
    const hasDate = hasToken(row, ['date processed','converted date','date ' , 'date']);
    const hasDesc = hasToken(row, ['description','merchant name','doing business as']);
    const hasAmt  = hasToken(row, ['converted £','amount','billed amount','gbp amount','charge amount','value']);
    if (hasDate && hasDesc && hasAmt) { headerIdx = i; break; }
  }

  if (headerIdx === -1) {
    // Try strict matches row containing these exact strings
    for (let i = 1; i < maxScan; i++) {
      const row = rowsA1[i] ?? [];
      const s = row.map(c => String(c ?? '').trim());
      if (s.includes('Date') && s.includes('Description') && (s.includes('Amount') || s.includes('CONVERTED £'))) {
        headerIdx = i; break;
      }
    }
  }

  if (headerIdx === -1) headerIdx = 1; // worst-case fallback

  const hdr = (rowsA1[headerIdx] ?? []).map((h: any, i: number) => {
    const s = h == null ? '' : String(h).trim();
    return s === '' ? `col_${i}` : s;
  });

  // Data starts AFTER the header row we picked; skip any all-null rows immediately after
  let start = headerIdx + 1;
  while (start < rowsA1.length) {
    const r = rowsA1[start] ?? [];
    const nonEmpty = r.some(c => c != null && String(c).trim() !== '');
    if (nonEmpty) break;
    start++;
  }

  const data = rowsA1.slice(start);
  const out: any[] = data.map(r => Object.fromEntries(hdr.map((k, i) => [k, r[i] ?? null])));
  return out;
}

export function parseCardSheet(ws: XLSX.WorkSheet, source: 'amex' | 'mc'): CanonicalTxn[] {
  const rows: any[] = reheaderVerySmart(ws);
  if (!rows.length) return [];

  const kDate = findKey(rows[0], ['Post Date','Posted','Date','Date ','Transaction Date','Posting Date','Processed Date','Date Processed','Converted date']);
  const kAmountPref = findKey(rows[0], ['CONVERTED £','Converted £']);
  const kAmount = kAmountPref ?? findKey(rows[0], ['Amount','GBP Amount','Billed Amount','Charge Amount','Value']);
  const kDebit = findKey(rows[0], ['Debit','Debit Amount']);
  const kCredit = findKey(rows[0], ['Credit','Credit Amount']);
  const kDesc = findKey(rows[0], ['Description','Merchant Name','Extended Details','Memo','Details','Narrative','Doing Business As'] );
  const kCurr = findKey(rows[0], ['Currency','Curr','Currency Code']);

  if (!kDate) return []; // give up if no date column discovered
  if (!kAmount && !kDebit && !kCredit) return [];

  const out: CanonicalTxn[] = [];
  for (const r of rows) {
    try {
      const dateRaw = r[kDate];
      if (!dateRaw) continue;
      const iso = normalizeDate(dateRaw);

      let amt: number | undefined;
      if (kAmount) {
        const raw = toNumber(r[kAmount]);
        amt = raw;
      } else {
        const debit = kDebit ? toNumber(r[kDebit]) : 0;
        const credit = kCredit ? toNumber(r[kCredit]) : 0;
        amt = debit > 0 ? debit : (credit > 0 ? -credit : 0);
        if (amt === 0) continue;
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

// Detail parsing unchanged from patch3
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
