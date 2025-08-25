// version: v0.1b1
// date: 2025-08-25 09:10 Europe/London
// changelog: slice: fix Amex 2024 date parsing
// CANARY: finance-starter v0.1c9 (detail helpers)
// Extract Detail categories and monthly truth totals for a given year.

import * as XLSX from "xlsx";

export function extractDetailCategories(wb: XLSX.WorkBook): string[] {
  const ws = wb.Sheets["Detail"];
  if (!ws) return [];
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });
  if (!rows.length) return [];
  // First row like: [null, null, null, 'David salary','Sonya salary','Housing', ...]
  const hdr = rows[0] || [];
  // Categories start at col index 3 onward, dropping falsy
  return hdr.slice(3).map((v:any)=> String(v||"").trim()).filter(Boolean);
}

export function extractDetailMonthly(wb: XLSX.WorkBook, year: number): Array<Record<string, number>> {
  const ws = wb.Sheets["Detail"];
  if (!ws) return Array(12).fill({}).map(()=> ({}));
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });
  if (!rows.length) return Array(12).fill({}).map(()=> ({}));

  const hdr = rows[0] || [];
  const cats = hdr.slice(3).map((v:any)=> String(v||"").trim());
  const colBase = 3; // categories start at col 3

  const monthly: Array<Record<string, number>> = Array(12).fill(0).map(()=> ({}));

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const y = r?.[0];
    const m = r?.[2]; // month number (1..12)
    if (y !== year || typeof m !== "number") continue;

    for (let j = 0; j < cats.length; j++) {
      const cat = cats[j];
      const v = r[colBase + j];
      const num = (typeof v === "number") ? v : Number(String(v||"").replace(/[^0-9.\-]/g,""));
      if (!isFinite(num)) continue;
      // In your Detail, expenses are positive in category columns.
      monthly[m-1][cat] = (monthly[m-1][cat] || 0) + num;
    }
  }
  return monthly;
}
