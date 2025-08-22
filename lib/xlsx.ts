// lib/xlsx.ts
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import { CanonicalTxn, DetailTruthRow } from './types';

function normalizeDate(input: any): string {
  if (typeof input === 'number') {
    const d = XLSX.SSF.parse_date_code(input);
    const iso = dayjs(new Date(d.y, d.m - 1, d.d)).format('YYYY-MM-DD');
    return iso;
  }
  const txt = String(input ?? '').trim();
  if (!txt) throw new Error('Empty date cell');
  const candidates = [
    'YYYY-MM-DD','DD/MM/YYYY','MM/DD/YYYY','D/M/YYYY','M/D/YYYY','YYYY/M/D',
    'DD.MM.YYYY','D.M.YYYY','YYYY.MM.DD'
  ];
  for (const fmt of candidates) {
    const dt = dayjs(txt, fmt, true);
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
 * Robust card parser:
 * - Supports "Amount" single-column OR "Debit"/"Credit" paired columns.
 * - Supports various date/description header names.
 * - Normalizes to: expenses POSITIVE, credits NEGATIVE.
 */
export function parseCardSheet(ws: XLSX.WorkSheet, source: 'amex' | 'mc'): CanonicalTxn[] {
  const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true });
  if (!rows.length) return [];

  const kDate = findKey(rows[0], ['Post Date','Posted','Date','Transaction Date','Posting Date','Processed Date'])!;
  const kAmount = findKey(rows[0], ['Amount','GBP Amount','Billed Amount','Charge Amount','Value']);
  const kDebit = findKey(rows[0], ['Debit','Debit Amount']);
  const kCredit = findKey(rows[0], ['Credit','Credit Amount']);
  const kDesc = findKey(rows[0], ['Description','Merchant Name','Extended Details','Memo','Details','Narrative'] );
  const kCurr = findKey(rows[0], ['Currency','Curr','Currency Code']);

  const out: CanonicalTxn[] = [];
  for (const r of rows) {
    try {
      const dateRaw = kDate ? r[kDate] : undefined;
      if (!dateRaw) continue;
      const iso = normalizeDate(dateRaw);

      let amt: number | undefined;
      if (kAmount) {
        amt = toNumber(r[kAmount]);
        // Make expenses positive, credits negative
        amt = (amt < 0) ? Math.abs(amt) : -Math.abs(amt);
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
 * Extract ground truth from the "Detail" sheet for a specific year.
 */
export function parseDetailTruth(ws: XLSX.WorkSheet, year: number): DetailTruthRow[] {
  const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true });
  if (!rows.length) return [];

  const lowerKeys = (obj: any) =>
    Object.fromEntries(Object.entries(obj).map(([k, v]) => [String(k).toLowerCase(), v]));

  const find = (keys: string[], wantList: string[]) => {
    for (const w of wantList) {
      const k = keys.find(k => k === w.toLowerCase());
      if (k) return k;
    }
    for (const w of wantList) {
      const k = keys.find(k => k.includes(w.toLowerCase()));
      if (k) return k;
    }
    return undefined;
  };

  const out: DetailTruthRow[] = [];

  for (const r0 of rows) {
    const r = lowerKeys(r0);
    const keys = Object.keys(r);

    const kYear = find(keys, ['year','yyyy','unnamed: 0','y']);
    const kMonth = find(keys, ['month','mm','unnamed: 1','m']);
    const kIncome = find(keys, ['total income','income total','income']);
    const kExpenses = find(keys, ['total expenses','expenses total','expenses','spend']);

    if (!kYear || !kMonth || !kIncome || !kExpenses) continue;

    const y = Number(r[kYear]);
    if (!y || y !== year) continue;

    const m = Number(r[kMonth]);
    if (!m || m < 1 || m > 12) continue;

    const asNum = (x: any) => Number(String(x ?? '').replace(/[,£ ]/g, ''));
    const incomeTotal = Math.round(asNum(r[kIncome]) * 100) / 100;
    const expensesTotal = Math.round(asNum(r[kExpenses]) * 100) / 100;

    if (Number.isNaN(incomeTotal) || Number.isNaN(expensesTotal)) continue;

    out.push({ year: y, month: m, incomeTotal, expensesTotal });
  }

  out.sort((a, b) => a.month - b.month);
  return out;
}

export function loadWorkbook(path: string) {
  const wb = XLSX.readFile(path, { cellDates: false });
  return wb;
}
