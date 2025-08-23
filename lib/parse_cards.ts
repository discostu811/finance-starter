// CANARY: finance-starter v0.1c12 (cards: correct category mapping)
import * as XLSX from "xlsx";
import { loadWorkbook, excelSerialToIso } from "./xlsx";

export type CardTxn = {
  source: "amex" | "mc";
  postedDate: string;   // YYYY-MM-DD
  amount: number;       // positive for spend, negative for payments/refunds
  currency?: string;
  merchantRaw?: string;
  descriptionRaw?: string;
  categoryRaw?: string;
  raw?: any;
};

function findHeaderRow(aoa: any[][], required: string[]): number {
  for (let r = 0; r < Math.min(30, aoa.length); r++) {
    const row = aoa[r]?.map(v => (v ?? "").toString().trim());
    if (!row || !row.length) continue;
    if (required.every(k => row.includes(k))) return r;
  }
  return -1;
}

export function parseAmex2024(wb: XLSX.WorkBook): CardTxn[] {
  const sh = wb.Sheets["2024 amex"];
  if (!sh) return [];
  const aoa: any[][] = XLSX.utils.sheet_to_json(sh, { header: 1, raw: true });
  const hdrRow = findHeaderRow(aoa, ["Date", "Description", "Amount"]);
  if (hdrRow < 0) return [];
  const headers = aoa[hdrRow].map((v: any) => (v ?? "").toString().trim());

  const idx = (name: string) => headers.indexOf(name);
  const iDate = idx("Date");
  const iDesc = idx("Description");
  const iAmt  = idx("CONVERTED £") >= 0 ? idx("CONVERTED £") : idx("Amount");
  const iMerA = idx("Doing Business As");
  const iCat1 = idx("CATEGORIE");     // <-- real Amex category
  const iCat2 = idx("Subcategory");
  const iCat3 = idx("Category");      // often IBAN-ish, not a category, fallback only

  const out: CardTxn[] = [];
  for (let r = hdrRow + 1; r < aoa.length; r++) {
    const row = aoa[r];
    if (!row) continue;
    const rawDate = row[iDate];
    const rawAmt  = row[iAmt];
    const desc    = row[iDesc];
    if (rawDate == null || rawAmt == null) continue;

    const postedDate = typeof rawDate === "number" ? excelSerialToIso(rawDate) : (rawDate || "").toString();
    const amount = Number(rawAmt) || 0;
    const merchant = (row[iMerA] ?? desc ?? "").toString().trim();

    const cat =
      (iCat1 >= 0 ? row[iCat1] : undefined) ??
      (iCat2 >= 0 ? row[iCat2] : undefined) ??
      (iCat3 >= 0 ? row[iCat3] : undefined) ?? "";

    out.push({
      source: "amex",
      postedDate,
      amount,
      merchantRaw: merchant,
      descriptionRaw: (desc ?? "").toString(),
      categoryRaw: (cat ?? "").toString().trim(),
      raw: row,
    });
  }
  return out;
}

export function parseMC2024(wb: XLSX.WorkBook): CardTxn[] {
  const sh = wb.Sheets["2024 mc"];
  if (!sh) return [];
  const rows: any[] = XLSX.utils.sheet_to_json(sh, { raw: true });
  const out: CardTxn[] = [];

  for (const r of rows) {
    const rawDate = r["Converted date"] ?? r["Date "] ?? r["Date"];
    const desc = r["Description"];
    const amt = r["CONVERTED £"] ?? r["Amount"];
    if (rawDate == null || amt == null) continue;

    const postedDate = typeof rawDate === "number" ? excelSerialToIso(rawDate) : (rawDate || "").toString();
    const category = (r["CATEGORY"] ?? r["Category"] ?? "").toString().trim();

    out.push({
      source: "mc",
      postedDate,
      amount: Number(amt) || 0,
      merchantRaw: (desc ?? "").toString(),
      descriptionRaw: (desc ?? "").toString(),
      categoryRaw: category,
      raw: r,
    });
  }
  return out;
}
