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
  const txt = String(input).trim();
  const candidates = [
    'YYYY-MM-DD',
    'DD/MM/YYYY',
    'MM/DD/YYYY',
    'D/M/YYYY',
    'M/D/YYYY',
    'YYYY/M/D',
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
  const s = String(v ?? '').replace(/[, ]+/g, '').replace(/£/g, '');
  if (s === '') return 0;
  const n = Number(s);
  if (Number.isNaN(n)) throw new Error(`Unparseable number: ${v}`);
  return n;
}

export function parseCardSheet(ws: XLSX.WorkSheet, source: 'amex' | 'mc'): CanonicalTxn[] {
  const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true });

  function pick(row: any, names: string[]): any {
    const keys = Object.keys(row);
    for (const want of names) {
      const k = keys.find(
        (key) => key.toLowerCase().trim() === want.toLowerCase().trim()
      );
      if (k) return row[k];
    }
    for (const want of names) {
      const k = keys.find((key) => key.toLowerCase().includes(want.toLowerCase()));
      if (k) return row[k];
    }
    return undefined;
  }

  const out: CanonicalTxn[] = [];
  for (const r of rows) {
    const dateRaw = pick(r, ['Post Date', 'Posted', 'Date', 'Transaction Date']);
    if (!dateRaw) continue;
    let amountRaw = pick(r, ['Amount', 'Charge Amount', 'Value', 'GBP Amount', 'Billed Amount']);
    if (amountRaw === undefined || amountRaw === null || amountRaw === '') continue;

    const desc = pick(r, ['Description', 'Merchant Name', 'Extended Details', 'Memo', 'Details']);
    const currency = pick(r, ['Currency', 'Curr', 'Currency Code']);

    const iso = normalizeDate(dateRaw);
    let amt = toNumber(amountRaw);

    // Normalize sign: expenses POSITIVE, income/credits NEGATIVE
    if (amt < 0) amt = Math.abs(amt); else amt = -Math.abs(amt);

    out.push({
      source,
      postedDate: iso,
      amount: amt,
      currency: currency ? String(currency) : undefined,
      merchantRaw: desc ? String(desc) : undefined,
      descriptionRaw: desc ? String(desc) : undefined,
    });
  }
  return out;
}

export function parseDetailTruth(ws: XLSX.WorkSheet, year: number): DetailTruthRow[] {
  const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true });

  const lowerKeys = (obj: any) =>
    Object.fromEntries(Object.entries(obj).map(([k, v]) => [k.toLowerCase(), v]));

  const pickKey = (keys: string[], wants: string[]) => {
    for (const want of wants) {
      const exact = keys.find((k) => k === want.toLowerCase());
      if (exact) return exact;
    }
    for (const want of wants) {
      const inc = keys.find((k) => k.includes(want.toLowerCase()));
      if (inc) return inc;
    }
    return undefined;
  };

  const out: DetailTruthRow[] = [];

  for (const r of rows) {
    const lr = lowerKeys(r);
    const keys = Object.keys(lr);

    const keyYear = pickKey(keys, ['year', 'yyyy', 'unnamed: 0', 'y']);
    const keyMonth = pickKey(keys, ['month', 'mm', 'unnamed: 1', 'm']);
    const keyIncome = pickKey(keys, ['income', 'total income', 'incomes']);
    const keyExpenses = pickKey(keys, ['total expenses', 'expenses', 'spend']);

    if (!keyYear || !keyMonth || !keyIncome || !keyExpenses) continue;

    const y = Number(lr[keyYear]);
    if (!y || y !== year) continue;

    const m = Number(lr[keyMonth]);
    if (!m || m < 1 || m > 12) continue;

    const incomeTotal = Math.round((toNumber(lr[keyIncome])) * 100) / 100;
    const expensesTotal = Math.round((toNumber(lr[keyExpenses])) * 100) / 100;

    out.push({ year: y, month: m, incomeTotal, expensesTotal });
  }

  out.sort((a, b) => a.month - b.month);
  return out;
}

export function loadWorkbook(path: string) {
  const wb = XLSX.readFile(path, { cellDates: false });
  return wb;
}
