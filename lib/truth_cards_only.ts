// CANARY: finance-starter v0.1b5 (cards-only truth)
import * as XLSX from "xlsx";
import { parseDetailTruthSheet } from "./truth";

export type CardsOnlyConfig = {
  categories: string[];   // case-insensitive header names from the Detail sheet
};

const DEFAULT_CATEGORIES = [
  "Grocery","Restaurants","Entertainment","Travel","Oyster","Clothes",
  "Kitchen","Electronics","Accessories","Supplies","Gift","UK cabs",
  "Others","Services"
];

export function parseDetailTruthCardsOnly(ws: XLSX.WorkSheet, year: number, cfg?: CardsOnlyConfig) {
  // We’ll reuse the header detection from parseDetailTruthSheet’s logic by reading raw and recomputing.
  // Simpler: read Detail fully as 12-month rows using the full parser, then recompute expenses from whitelisted columns.
  // To avoid duplicating a lot of code, we read the sheet again manually here and sum only whitelisted columns.
  const whitelist = (cfg?.categories ?? DEFAULT_CATEGORIES).map(s => s.toLowerCase());

  const grid = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null }) as any[][];
  if (!grid.length) return [];

  // Find header row: look for at least one of whitelist names
  let hdrIdx = -1;
  for (let i = 0; i < Math.min(150, grid.length); i++) {
    const row = (grid[i] ?? []).map((c:any)=> String(c ?? "").trim().toLowerCase());
    const hits = whitelist.filter(w => row.includes(w)).length;
    if (hits >= 3) { hdrIdx = i; break; }
  }
  if (hdrIdx < 0) {
    // fallback: search for "david salary" + "total expenses" (like main truth parser), then still use whitelist
    for (let i = 0; i < Math.min(150, grid.length); i++) {
      const row = (grid[i] ?? []).map((c:any)=> String(c ?? "").trim().toLowerCase());
      if (row.includes("total expenses") && row.includes("david salary")) { hdrIdx = i; break; }
    }
    if (hdrIdx < 0) return [];
  }

  const header = (grid[hdrIdx] ?? []).map((h:any,i:number)=>{
    const s = h == null ? "" : String(h).trim();
    return s === "" ? `col_${i}` : s;
  });

  const idxYear = 0;     // in your sheet year is first col
  const idxMonthNum = 2; // numeric month is third col
  const wlIndices: number[] = [];
  header.forEach((name, i) => {
    const low = String(name).trim().toLowerCase();
    if (whitelist.includes(low)) wlIndices.push(i);
  });

  const byMonth = new Map<number, { exp: number }>();
  const body = grid.slice(hdrIdx + 1);
  const toNum = (v:any) => {
    if (v == null || v === "") return 0;
    if (typeof v === "number") return v;
    const n = Number(String(v).replace(/[£$, ]/g, ""));
    return Number.isFinite(n) ? n : 0;
  };

  for (const r of body) {
    const y = toNum(r[idxYear]);
    if (y !== year) continue;
    const m = toNum(r[idxMonthNum]);
    if (!(m >= 1 && m <= 12)) continue;

    let sum = 0;
    for (const i of wlIndices) {
      const v = toNum(r[i]);
      // Treat positives as expense; negatives are refunds -> subtract (i.e., reduce expense)
      sum += v >= 0 ? v : -v;
    }
    const agg = byMonth.get(m) || { exp: 0 };
    agg.exp += sum;
    byMonth.set(m, agg);
  }

  return Array.from({length:12}, (_,i)=> {
    const m = i+1;
    const t = byMonth.get(m) || { exp: 0 };
    return { month: m, expensesTotal: +t.exp.toFixed(2) };
  });
}
