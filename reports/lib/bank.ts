// CANARY: finance-starter v0.2a1 (generic bank adapter)
import * as XLSX from "xlsx";
import fs from "fs";

export type BankSchema = {
  // header names (case-insensitive) for the incoming file
  date: string;            // posting date
  description: string;     // narrative/merchant
  debit?: string;          // optional (positive numbers mean outflow)
  credit?: string;         // optional (positive numbers mean inflow)
  amount?: string;         // optional (signed amount; positive inflow, negative outflow)
  currency?: string;       // optional (e.g., "GBP")
  dateFormat?: string;     // optional hint like "DD/MM/YYYY"
};

export type BankTxn = {
  source: "bank";
  postedDate: string;      // YYYY-MM-DD
  amount: number;          // positive = expense (outflow), negative = inflow (income)
  merchantRaw?: string;
  descriptionRaw?: string;
  currency?: string;
  raw: Record<string, any>;
};

// quick helpers
const toNum = (v:any) => {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  const n = Number(String(v).replace(/[£$, ]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

function parseDateCell(v:any, fmt?: string): string {
  if (v == null || v === "") return "";
  if (typeof v === "number") {
    // Excel serial
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(epoch.getTime() + (v * 86400000));
    return d.toISOString().slice(0,10);
  }
  const s = String(v).trim();
  // very small parser for common dd/mm/yyyy or yyyy-mm-dd
  if (fmt?.toUpperCase().includes("DD/MM/")) {
    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (m) {
      const d = Number(m[1]), mo = Number(m[2])-1, y = Number(m[3].length===2?("20"+m[3]):m[3]);
      const dt = new Date(Date.UTC(y,mo,d));
      return dt.toISOString().slice(0,10);
    }
  }
  // try ISO-ish
  const d = new Date(s);
  if (!isNaN(d.getTime())) return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString().slice(0,10);
  return "";
}

function readAny(file:string): any[] {
  const lower = file.toLowerCase();
  if (lower.endsWith(".csv")) {
    // light CSV via XLSX
    const wb = XLSX.readFile(file, { raw: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(ws, { defval: null, raw: true });
  } else {
    const wb = XLSX.readFile(file, { raw: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(ws, { defval: null, raw: true });
  }
}

export function parseBankFile(file:string, schema: BankSchema): BankTxn[] {
  const rows = readAny(file);
  const h = (s:string)=> s.trim().toLowerCase();
  const dateKey = h(schema.date);
  const descKey = h(schema.description);
  const debitKey = schema.debit ? h(schema.debit) : undefined;
  const creditKey = schema.credit ? h(schema.credit) : undefined;
  const amountKey = schema.amount ? h(schema.amount) : undefined;
  const currencyKey = schema.currency ? h(schema.currency) : undefined;

  const out: BankTxn[] = [];
  for (const r0 of rows) {
    // normalize keys lowercased
    const r: Record<string, any> = {};
    Object.keys(r0).forEach(k => r[h(k)] = (r0 as any)[k]);

    const date = parseDateCell(r[dateKey], schema.dateFormat);
    if (!date) continue;
    const desc = r[descKey] ?? "";

    let amt = 0;
    if (amountKey) {
      // convention: positive = inflow, negative = outflow; we want positive = expense
      const signed = toNum(r[amountKey]);
      amt = signed < 0 ? Math.abs(signed) : -signed;
    } else {
      const deb = debitKey ? toNum(r[debitKey]) : 0;
      const cred = creditKey ? toNum(r[creditKey]) : 0;
      // debit (money out) should become positive expense
      // credit (money in) should become negative (income)
      amt = deb > 0 ? deb : (cred > 0 ? -cred : 0);
    }

    const currency = currencyKey ? String(r[currencyKey] ?? "") : undefined;

    out.push({
      source: "bank",
      postedDate: date,
      amount: amt,
      merchantRaw: String(desc ?? ""),
      descriptionRaw: String(desc ?? ""),
      currency,
      raw: r0 as any
    });
  }
  return out;
}
