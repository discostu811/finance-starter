// CANARY: finance-starter v0.1c1 (embedded bank sheets: David/Sonya account)
import * as XLSX from "xlsx";

export type EmbeddedBankTxn = {
  source: "bank";
  account: string;         // sheet name (e.g., "David account")
  postedDate: string;      // YYYY-MM-DD
  amount: number;          // +expense (outflow), -income (inflow)
  merchantRaw?: string;
  descriptionRaw?: string;
  raw: Record<string, any>;
};

const toNum = (v:any): number => {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  const n = Number(String(v).replace(/[£$, ]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

function excelSerialToIso(v: number): string {
  // Excel serial (days since 1899-12-30 UTC)
  const epoch = new Date(Date.UTC(1899, 11, 30));
  const d = new Date(epoch.getTime() + v * 86400000);
  return d.toISOString().slice(0,10);
}

function parseDateCell(v:any): string {
  if (v == null || v === "") return "";
  if (typeof v === "number") return excelSerialToIso(v);
  const s = String(v).trim();
  // dd/mm/yyyy or d/m/yy
  let m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    const d = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const yr = m[3].length === 2 ? Number("20" + m[3]) : Number(m[3]);
    const dt = new Date(Date.UTC(yr, mo, d));
    return dt.toISOString().slice(0,10);
  }
  // try Date(...)
  const d2 = new Date(s);
  if (!isNaN(d2.getTime())) {
    const dt = new Date(Date.UTC(d2.getUTCFullYear(), d2.getUTCMonth(), d2.getUTCDate()));
    return dt.toISOString().slice(0,10);
  }
  return "";
}

type HeaderInfo = {
  idxDate: number | null;
  idxDesc: number | null;
  idxAmount: number | null;
  idxDebit: number | null;
  idxCredit: number | null;
};

function findHeaderRowA1(grid: any[][]): { header: string[]; headerRow: number; info: HeaderInfo } | null {
  const want = (s:string)=> s.toLowerCase();
  for (let r = 0; r < Math.min(80, grid.length); r++) {
    const row = grid[r] ?? [];
    const names = row.map((c:any,i:number)=> {
      const s = (c==null?"":String(c)).trim();
      return s===""?`col_${i}`:s;
    });
    const low = names.map(s=> s.toLowerCase());
    const idxDate   = low.findIndex(s => s === "date" || s.includes("date posted") || s.includes("transaction date"));
    const idxDesc   = low.findIndex(s => s === "description" || s === "narrative" || s === "details" || s === "payee" || s.includes("description"));
    const idxAmount = low.findIndex(s => s === "amount" || s.includes("amount (£)") || s.includes("amount gbp"));
    const idxDebit  = low.findIndex(s => s === "debit" || s.includes("money out"));
    const idxCredit = low.findIndex(s => s === "credit" || s.includes("money in"));

    // Valid header if we have date+desc and (amount or debit/credit)
    const ok = idxDate >= 0 && idxDesc >= 0 && (idxAmount >= 0 || (idxDebit >= 0 && idxCredit >= 0));
    if (ok) {
      return {
        header: names,
        headerRow: r,
        info: { idxDate, idxDesc, idxAmount, idxDebit, idxCredit }
      };
    }
  }
  return null;
}

function normalizeAmount(row:any[], info: HeaderInfo): number {
  if (info.idxAmount != null && info.idxAmount >= 0) {
    // Many banks: Amount + = credit (inflow), - = debit (outflow).
    const signed = toNum(row[info.idxAmount]);
    // We want: positive = expense (outflow), negative = income
    return signed < 0 ? Math.abs(signed) : -signed;
  }
  // Separate Debit/Credit columns
  const deb = info.idxDebit != null && info.idxDebit >= 0 ? toNum(row[info.idxDebit]) : 0;
  const cred = info.idxCredit != null && info.idxCredit >= 0 ? toNum(row[info.idxCredit]) : 0;
  // Debit (money out) -> +expense; Credit (money in) -> -income
  if (deb) return deb;
  if (cred) return -cred;
  return 0;
}

export function detectEmbeddedBankSheetNames(allNames: string[]): string[] {
  const names = allNames.map(n => n.trim());
  // very liberal: any sheet containing 'account' or specifically 'david'/'sonya'
  return names.filter(n => {
    const s = n.toLowerCase();
    return s.includes("account") || s.includes("david") || s.includes("sonya");
  });
}

export function parseEmbeddedBankSheet(ws: XLSX.WorkSheet, sheetName: string, year: number): EmbeddedBankTxn[] {
  const grid = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null }) as any[][];
  if (!grid.length) return [];
  const hdr = findHeaderRowA1(grid);
  if (!hdr) return [];
  const { header, headerRow, info } = hdr;
  const body = grid.slice(headerRow + 1);

  const out: EmbeddedBankTxn[] = [];
  for (const r of body) {
    const dateCell = info.idxDate!=null ? r[info.idxDate] : null;
    const descCell = info.idxDesc!=null ? r[info.idxDesc] : "";
    const iso = parseDateCell(dateCell);
    if (!iso) continue;
    if (!iso.startsWith(String(year))) continue;

    const amt = normalizeAmount(r, info);
    const desc = descCell==null ? "" : String(descCell);

    out.push({
      source: "bank",
      account: sheetName,
      postedDate: iso,
      amount: amt,
      merchantRaw: desc,
      descriptionRaw: desc,
      raw: Object.fromEntries(header.map((h, i) => [h, r[i]]))
    });
  }
  return out;
}

export function parseAllEmbeddedBank(wb: XLSX.WorkBook, year: number): EmbeddedBankTxn[] {
  const candidates = detectEmbeddedBankSheetNames(wb.SheetNames);
  let txns: EmbeddedBankTxn[] = [];
  for (const name of candidates) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    txns = txns.concat(parseEmbeddedBankSheet(ws, name, year));
  }
  return txns;
}

// Heuristic: skip bank rows that are just paying off card statements (to avoid double counting)
// Toggle with env BANK_SUPPRESS_CARD_BILLS=0 to disable. Default: ON.
const BILL_PAT = /(american\s*express|amex|master\s*card|mastercard|visa\s*card|direct\s*debit.*(card|payment)|credit\s*card.*payment)/i;

export function suppressCardBillPayments(bankTxns: EmbeddedBankTxn[]): EmbeddedBankTxn[] {
  const on = process.env.BANK_SUPPRESS_CARD_BILLS !== "0";
  if (!on) return bankTxns;
  return bankTxns.filter(t => !BILL_PAT.test(t.descriptionRaw || ""));
}
