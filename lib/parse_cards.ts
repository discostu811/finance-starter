// CANARY: finance-starter v0.1c9 (parse_cards)
// Card parsing for 2024 Amex + MC using the workbook, no category guessing.

import * as XLSX from "xlsx";
import { loadWorkbook } from "./xlsx";

export type CardTxn = {
  source: "amex" | "mc";
  postedDate: string;      // YYYY-MM-DD
  amount: number;          // expense as positive, refunds as negative
  merchantRaw?: string;
  descriptionRaw?: string;
  categoryRaw?: string;    // use your sheet category EXACTLY
};

// ---- utilities ----
function excelDateToISO(n: number): string {
  // Excel serial (1900 date system) → YYYY-MM-DD
  const epoch = new Date(Date.UTC(1899, 11, 30));
  const ms = Math.round((n as number) * 86400 * 1000);
  return new Date(epoch.getTime() + ms).toISOString().slice(0, 10);
}

function findHeaderRow(rows: any[][], mustHave: string[]): number {
  for (let i = 0; i < Math.min(rows.length, 50); i++) {
    const r = rows[i]?.map((v:any)=> (v===undefined||v===null) ? "" : String(v).trim());
    if (!r) continue;
    let ok = true;
    for (const key of mustHave) {
      if (!r.includes(key)) { ok = false; break; }
    }
    if (ok) return i;
  }
  return -1;
}

function safeNum(v: any): number {
  if (v === undefined || v === null || v === "") return 0;
  if (typeof v === "number") return v;
  const s = String(v).replace(/[^0-9.\-]/g, "");
  const n = Number(s);
  return isNaN(n) ? 0 : n;
}

// ---- Amex 2024 ----
export function parseAmex2024(wb?: XLSX.WorkBook): CardTxn[] {
  wb = wb ?? loadWorkbook("./data/Savings.xlsx");
  const sheetName = "2024 amex";
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];

  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });
  // Header row looks like: Date, Date Processed, Description, Cardmember, CATEGORIE, Amount, CONVERTED £, Converted date, Month, ...
  const hdrIdx = findHeaderRow(rows, ["Date","Description","CONVERTED £"]);
  if (hdrIdx < 0) return [];
  const data = rows.slice(hdrIdx + 1);

  const idx = (name: string) => rows[hdrIdx].findIndex(v => String(v||"").trim() === name);

  const iDate      = idx("Date");
  const iDesc      = idx("Description");
  const iConverted = idx("CONVERTED £");
  const iCatA      = idx("Category");   // sometimes present
  const iCatB      = idx("CATEGORIE");  // sometimes present
  const iMonth     = idx("Month");      // fallback when Date empty

  const out: CardTxn[] = [];
  for (const r of data) {
    const dRaw = r[iDate];
    const mRaw = r[iDesc];
    const cat  = (iCatA >= 0 ? r[iCatA] : (iCatB >= 0 ? r[iCatB] : "")) ?? "";
    let amt = safeNum(r[iConverted]);

    // Some refunds are negative in Amex; keep sign (positive = expense).
    // Skip completely empty lines:
    if (!dRaw && !mRaw && !amt) continue;

    // Date: prefer serial in "Date", fallback: if Month exists and Date missing, skip (can’t build day).
    let posted: string | null = null;
    if (typeof dRaw === "number") posted = excelDateToISO(dRaw);

    if (!posted) {
      // try "Converted date"?
      const iConvDate = rows[hdrIdx].findIndex(v => String(v||"").trim() === "Converted date");
      if (iConvDate >= 0 && typeof r[iConvDate] === "number") posted = excelDateToISO(r[iConvDate]);
    }
    if (!posted) continue;

    out.push({
      source: "amex",
      postedDate: posted,
      amount: amt,
      merchantRaw: mRaw ? String(mRaw) : undefined,
      descriptionRaw: mRaw ? String(mRaw) : undefined,
      categoryRaw: String(cat || "")
    });
  }
  return out;
}

// ---- MC 2024 ----
export function parseMC2024(wb?: XLSX.WorkBook): CardTxn[] {
  wb = wb ?? loadWorkbook("./data/Savings.xlsx");
  const sheetName = "2024 mc";
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];

  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });
  // Header row looks like: Day, Month, Year, Date , Description, CATEGORY, Amount, CONVERTED £, Converted date, Month
  const hdrIdx = findHeaderRow(rows, ["Date","Description","CONVERTED £"]);
  if (hdrIdx < 0) return [];
  const data = rows.slice(hdrIdx + 1);

  const idx = (name: string) => rows[hdrIdx].findIndex(v => String(v||"").trim() === name);

  const iDate      = idx("Date");
  const iDesc      = idx("Description");
  const iConverted = idx("CONVERTED £");
  const iCat       = idx("CATEGORY");

  const out: CardTxn[] = [];
  for (const r of data) {
    const dRaw = r[iDate];
    const mRaw = r[iDesc];
    const cat  = r[iCat] ?? "";
    let amt = safeNum(r[iConverted]);

    // MC exports typically set expenses as positive in "CONVERTED £" and payments as negative.
    if (!dRaw && !mRaw && !amt) continue;
    if (typeof dRaw !== "number") continue;

    const posted = excelDateToISO(dRaw);

    out.push({
      source: "mc",
      postedDate: posted,
      amount: amt,
      merchantRaw: mRaw ? String(mRaw) : undefined,
      descriptionRaw: mRaw ? String(mRaw) : undefined,
      categoryRaw: String(cat || "")
    });
  }
  return out;
}
