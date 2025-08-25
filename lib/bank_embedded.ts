// version: v0.1b1
// date: 2025-08-25 08:51 Europe/London
// changelog: slice: fix Amex 2024 date parsing
// CANARY: finance-starter v0.1c2 (embedded bank: accept 'Debit/Credit' & 'CONVERTED £' as amount)
import * as XLSX from "xlsx";

export type EmbeddedBankTxn = {
  source: "bank";
  account: string;
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
  const epoch = new Date(Date.UTC(1899, 11, 30));
  const d = new Date(epoch.getTime() + v * 86400000);
  return d.toISOString().slice(0,10);
}

function parseDateCell(v:any): string {
  if (v == null || v === "") return "";
  if (typeof v === "number") return excelSerialToIso(v);
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    const d = Number(m[1]), mo = Number(m[2]) - 1, yr = m[3].length===2 ? Number("20"+m[3]) : Number(m[3]);
    const dt = new Date(Date.UTC(yr, mo, d));
    return dt.toISOString().slice(0,10);
  }
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
  idxAmount: number | null;   // may be 'Amount', 'Debit/Credit', or 'CONVERTED £'
  idxDebit: number | null;    // separate debit column (rare in your sheets)
  idxCredit: number | null;   // separate credit column
};

function findHeaderRowA1(grid: any[][]): { header: string[]; headerRow: number; info: HeaderInfo } | null {
  const canon = (s:string)=> s.trim().toLowerCase();
  const includes = (s:string, sub:string)=> canon(s).includes(sub);

  for (let r = 0; r < Math.min(80, grid.length); r++) {
    const row = grid[r] ?? [];
    const header = row.map((c:any,i:number)=> {
      const s = (c==null?"":String(c)).trim();
      return s==="" ? `col_${i}` : s;
    });

    const low = header.map(canon);

    // core columns
    const idxDate   = low.findIndex(s =>
      s === "date" || s.includes("date posted") || s.includes("transaction date") || s === "converted date"
    );

    const idxDesc   = low.findIndex(s =>
      s === "description" || s === "narrative" || s === "details" || s === "payee" || s.includes("description")
      || s === "merchant/description" || s.includes("merchant")
    );

    // accept several "amount-like" headers:
    let idxAmount = low.findIndex(s =>
      s === "amount" || s.includes("amount (£)") || s.includes("amount gbp")
    );
    if (idxAmount < 0) {
      // Your sheets commonly have these:
      idxAmount = low.findIndex(s => s === "debit/credit" || s.includes("converted £") || s.includes("converted gbp"));
    }

    const idxDebit  = low.findIndex(s => s === "debit"  || s.includes("money out"));
    const idxCredit = low.findIndex(s => s === "credit" || s.includes("money in"));

    const ok = (idxDate >= 0) && (idxDesc >= 0) && (idxAmount >= 0 || (idxDebit >= 0 && idxCredit >= 0));
    if (ok) {
      return {
        header, headerRow: r,
        info: { idxDate, idxDesc, idxAmount, idxDebit, idxCredit }
      };
    }
  }
  return null;
}

function normalizeAmount(row:any[], info: HeaderInfo): number {
  if (info.idxAmount != null && info.idxAmount >= 0) {
    const signed = toNum(row[info.idxAmount]);
    // Convention: positive = expense, negative = income
    return signed < 0 ? Math.abs(signed) : -signed;
  }
  const deb = info.idxDebit != null && info.idxDebit >= 0 ? toNum(row[info.idxDebit]) : 0;
  const cred = info.idxCredit != null && info.idxCredit >= 0 ? toNum(row[info.idxCredit]) : 0;
  if (deb) return deb;
  if (cred) return -cred;
  return 0;
}

export type EmbeddedBankTxn = {
  source: "bank";
  account: string;
  postedDate: string;
  amount: number;
  merchantRaw?: string;
  descriptionRaw?: string;
  raw: Record<string, any>;
};

export function detectEmbeddedBankSheetNames(allNames: string[]): string[] {
  return allNames.filter(n => {
    const s = n.toLowerCase();
    return s.includes("account") || s.includes("david") || s.includes("sonya");
  });
}

export function parseEmbeddedBankSheet(ws: XLSX.WorkSheet, sheetName: string, year: number) {
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

export function parseAllEmbeddedBank(wb: XLSX.WorkBook, year: number) {
  const names = detectEmbeddedBankSheetNames(wb.SheetNames);
  let txns: EmbeddedBankTxn[] = [];
  for (const name of names) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    txns = txns.concat(parseEmbeddedBankSheet(ws, name, year));
  }
  return txns;
}

const BILL_PAT = /(american\s*express|amex|master\s*card|mastercard|visa\s*card|direct\s*debit.*(card|payment)|credit\s*card.*payment)/i;
export function suppressCardBillPayments(bankTxns: EmbeddedBankTxn[]) {
  const on = process.env.BANK_SUPPRESS_CARD_BILLS !== "0";
  if (!on) return bankTxns;
  return bankTxns.filter(t => !BILL_PAT.test(t.descriptionRaw || ""));
}
