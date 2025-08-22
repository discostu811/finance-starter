// lib/xlsx.ts
// Patch6: Wire robust A1-index header detection into main ETL
import * as XLSX from "xlsx";
import dayjs from "dayjs";
import { readFileSync } from "node:fs";

export type CanonicalTxn = {
  source: "amex" | "mc";
  postedDate: string;
  amount: number;     // expenses positive; refunds/payments negative
  currency?: string;
  merchantRaw?: string;
  descriptionRaw?: string;
};

export type DetailTruthRow = {
  year: number;
  month: number;
  incomeTotal: number;
  expensesTotal: number;
};

export function loadWorkbook(path: string) {
  const buf = readFileSync(path);
  return XLSX.read(buf, { type: "buffer", cellDates: false });
}

// ---- utils ----
function normalizeExcelDate(n: number): string {
  const ms = Math.round(n * 86400000);
  const base = Date.UTC(1899, 11, 30);
  return dayjs(base + ms).format("YYYY-MM-DD");
}
function normalizeDate(input: any): string {
  if (typeof input === "number") return normalizeExcelDate(input);
  const txt = String(input ?? "").trim();
  if (!txt) throw new Error("Empty date cell");
  const fmts = ["YYYY-MM-DD","DD/MM/YYYY","MM/DD/YYYY","D/M/YYYY","M/D/YYYY","YYYY/M/D","DD.MM.YYYY","D.M.YYYY","YYYY.MM.DD"];
  for (const f of fmts) {
    const d = dayjs(txt, f, true);
    if (d.isValid()) return d.format("YYYY-MM-DD");
  }
  const d = dayjs(txt);
  if (d.isValid()) return d.format("YYYY-MM-DD");
  throw new Error(`Unparseable date: ${input}`);
}
function toNumber(v: any): number {
  if (typeof v === "number") return v;
  const s = String(v ?? "").replace(/[ ,]/g, "").replace(/[£$]/g, "");
  if (s === "" || s === "-") return 0;
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

// ---- A1-index header promotion ----
function a1Rows(ws: XLSX.WorkSheet): any[][] {
  return XLSX.utils.sheet_to_json(ws, { defval: null, raw: true, header: 1 }) as any[][];
}
function findHeaderRowIndex(a1: any[][]): number {
  const looksHeader = (row: any[]): boolean => {
    const texts = row.map(c => String(c ?? "").toLowerCase());
    const nonEmpty = texts.filter(t => t !== "").length;
    if (nonEmpty < 3) return false;
    const needles = ["date", "date processed", "converted date", "description", "amount", "converted £", "converted", "cardmember"];
    return needles.some(n => texts.some(t => t.includes(n)));
  };
  for (let i = 0; i < Math.min(500, a1.length); i++) {
    if (looksHeader(a1[i] ?? [])) return i;
  }
  return -1;
}
function reheaderByIndex(ws: XLSX.WorkSheet): any[] {
  const a1 = a1Rows(ws);
  if (!a1.length) return [];
  let idx = findHeaderRowIndex(a1);
  if (idx === -1) {
    return XLSX.utils.sheet_to_json(ws, { defval: null, raw: true });
  }
  const hdr = (a1[idx] ?? []).map((h: any, i: number) => {
    const s = h == null ? "" : String(h).trim();
    return s === "" ? `col_${i}` : s;
  });
  const data = a1.slice(idx + 1);
  const out: any[] = data.map(r => Object.fromEntries(hdr.map((k, i) => [k, r[i] ?? null])));
  return out;
}

// ---- Public parsers ----
export function parseCardSheet(ws: XLSX.WorkSheet, source: "amex" | "mc"): CanonicalTxn[] {
  const rows: any[] = reheaderByIndex(ws);
  if (!rows.length) return [];

  const kDate = findKey(rows[0], ["Date","Date ","Date Processed","Converted date","Post Date","Transaction Date","Posting Date"])!;
  const kAmountPref = findKey(rows[0], ["CONVERTED £","Converted £","Converted GBP"]);
  const kAmount = kAmountPref ?? findKey(rows[0], ["Amount","GBP Amount","Billed Amount","Charge Amount","Value"]);
  const kDebit = findKey(rows[0], ["Debit","Debit Amount"]);
  const kCredit = findKey(rows[0], ["Credit","Credit Amount"]);
  const kDesc = findKey(rows[0], ["Description","Merchant Name","Extended Details","Memo","Details","Narrative","Doing Business As"]);
  const kCurr = findKey(rows[0], ["Currency","Curr","Currency Code"]);

  const out: CanonicalTxn[] = [];
  for (const r of rows) {
    try {
      const d = kDate ? r[kDate] : undefined;
      if (d == null || d === "") continue;
      const iso = normalizeDate(d);

      let amt: number | undefined;
      if (kAmount) {
        amt = toNumber(r[kAmount]);
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
        descriptionRaw: desc ? String(desc) : undefined
      });
    } catch {
      continue;
    }
  }
  return out;
}

export function parseDetailTruth(ws: XLSX.WorkSheet, year: number): DetailTruthRow[] {
  const a1 = a1Rows(ws);
  if (!a1.length) return [];
  const header = (a1[0] ?? []).map(h => (h == null ? "" : String(h)));
  const body = a1.slice(1);

  const idxYear = header.findIndex(h => h.toLowerCase() === "year");
  const idxMonthNum = header.findIndex(h => h.toLowerCase() === "month" || h.toLowerCase() === "mm");
  const idxTotalExpenses = header.findIndex(h => h.toLowerCase().includes("total expenses"));

  const posYear = idxYear >= 0 ? idxYear : 0;
  const posMonthNum = idxMonthNum >= 0 ? idxMonthNum : 2;

  const salaryCols = header.map((h, i) => ({ h: h.toLowerCase(), i })).filter(x => x.h.includes("salary")).map(x => x.i);

  const asNum = (x: any) => {
    const n = Number(String(x ?? "").replace(/[,£ ]/g, ""));
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
