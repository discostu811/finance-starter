// version: v0.1b1
// date: 2025-08-25 09:10 Europe/London
// changelog: slice: fix Amex 2024 date parsing
// CANARY: finance-starter v0.1b4 (truth parser)
// lib/truth.ts — parse "Detail" tab into per-month truth totals

import * as XLSX from "xlsx";
import dayjs from "dayjs";

export type TruthRow = { month: number; incomeTotal: number; expensesTotal: number };

function a1(ws: XLSX.WorkSheet): any[][] {
  return XLSX.utils.sheet_to_json(ws, { defval: null, raw: true, header: 1 }) as any[][];
}

// Find the header row by looking for "Total expenses" and at least one salary column
function findHeaderIdx(grid: any[][]): number {
  for (let i = 0; i < Math.min(100, grid.length); i++) {
    const row = grid[i] ?? [];
    const txt = row.map((c:any)=>String(c ?? "").trim().toLowerCase());
    const hasTotal = txt.includes("total expenses");
    const hasSalary = txt.includes("david salary") || txt.includes("sonya salary");
    if (hasTotal && hasSalary) return i;
  }
  // fallback: scan rows for any "total expenses"
  for (let i = 0; i < Math.min(200, grid.length); i++) {
    const row = grid[i] ?? [];
    const txt = row.map((c:any)=>String(c ?? "").trim().toLowerCase());
    if (txt.includes("total expenses")) return i;
  }
  return -1;
}

function toNum(v:any): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  const n = Number(String(v).replace(/[£$, ]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function parseDetailTruthSheet(ws: XLSX.WorkSheet, year: number): TruthRow[] {
  const grid = a1(ws);
  if (!grid.length) return [];

  const hdrIdx = findHeaderIdx(grid);
  // In your sheet, first three columns above headers are null; header row with real names appears around 11
  const hdrRow = hdrIdx >= 0 ? grid[hdrIdx] : grid[0];
  const header = (hdrRow ?? []).map((h:any,i:number)=>{
    const s = h == null ? "" : String(h).trim();
    return s === "" ? `col_${i}` : s;
  });

  // Find the columns we need
  const colIndex = new Map<string, number>();
  header.forEach((name, i) => colIndex.set(String(name).trim(), i));

  // Heuristics for fixed columns
  const yearCol = colIndex.get("Year") ?? 0;         // In your sheet, first column is the year (but often blank header)
  const monthNumCol = colIndex.get("Month") != null ? null : 2; // Your sheet has numeric month at col_2
  // We’ll be robust: if there is a column literally named "Month", we’ll try to parse number from it; else col_2 is numeric index.

  // Income columns (salaries appear as negatives in your sample)
  const incomeCols: number[] = [];
  for (const key of ["David salary","Sonya salary"]) {
    const idx = header.findIndex(h => String(h).trim().toLowerCase() === key.toLowerCase());
    if (idx >= 0) incomeCols.push(idx);
  }

  // Expenses: prefer explicit "Total expenses"; else sum all non-income category columns (from header row onward)
  const totalExpIdx = header.findIndex(h => String(h).trim().toLowerCase() === "total expenses");
  const categoryStart = Math.min(
    ...["David salary","Sonya salary","Housing","Grocery","Restaurants"]
      .map(k => header.findIndex(h => String(h).trim().toLowerCase() === k.toLowerCase()))
      .filter(i => i >= 0)
  );

  const body = grid.slice((hdrIdx >= 0 ? hdrIdx : 0) + 1);

  const byMonth: Map<number, {inc:number, exp:number}> = new Map();

  for (const r of body) {
    if (!r) continue;

    // year
    const yRaw = r[yearCol];
    const y = typeof yRaw === "number" ? yRaw : Number(String(yRaw||"").trim());
    if (y !== year) continue;

    // month number
    let m: number | null = null;
    if (monthNumCol !== null) {
      const mRaw = r[monthNumCol as number];
      m = typeof mRaw === "number" ? mRaw : Number(String(mRaw||"").trim());
      if (!Number.isFinite(m)) m = null;
    }
    // If there's a textual "Month" column, try to parse known names
    if (m == null) {
      const iMonthText = header.findIndex(h => String(h).trim().toLowerCase() === "month");
      if (iMonthText >= 0) {
        const name = String(r[iMonthText] || "").toLowerCase();
        const idx = ["january","february","march","april","may","june","july","august","september","october","november","december"].indexOf(name);
        if (idx >= 0) m = idx + 1;
      }
    }
    if (m == null || m < 1 || m > 12) continue;

    // income total: sum salaries; if negative (usual), flip sign to positive income
    let inc = 0;
    for (const i of incomeCols) inc += toNum(r[i]);
    const incomeTotal = Math.abs(inc); // treat income as positive magnitude

    // expenses total: prefer explicit Total expenses
    let expensesTotal = 0;
    if (totalExpIdx >= 0) {
      expensesTotal = toNum(r[totalExpIdx]);
      expensesTotal = Math.abs(expensesTotal);
      if (!expensesTotal) {
        const start = Number.isFinite(categoryStart) ? categoryStart : 3;
        for (let i = start; i < header.length; i++) {
          if (incomeCols.includes(i)) continue;
          const name = String(header[i]).toLowerCase();
          if (!name || name.startsWith("col_")) continue;
          const v = toNum(r[i]);
          if (v > 0) expensesTotal += v;
          else if (v < 0 && name.includes("refund")) expensesTotal += 0;
          else if (v < 0) expensesTotal += Math.abs(v);
        }
      }
    } else {
      const start = Number.isFinite(categoryStart) ? categoryStart : 3;
      for (let i = start; i < header.length; i++) {
        if (incomeCols.includes(i)) continue;
        const name = String(header[i]).toLowerCase();
        if (!name || name.startsWith("col_")) continue;
        const v = toNum(r[i]);
        if (v > 0) expensesTotal += v;
        else if (v < 0 && name.includes("refund")) expensesTotal += 0;
        else if (v < 0) expensesTotal += Math.abs(v);
      }
    }

    const agg = byMonth.get(m) || {inc:0,exp:0};
    agg.inc += incomeTotal;
    agg.exp += expensesTotal;
    byMonth.set(m, agg);
  }

  const out: TruthRow[] = [];
  for (let m=1;m<=12;m++){
    const t = byMonth.get(m) || {inc:0,exp:0};
    out.push({ month: m, incomeTotal: +(t.inc.toFixed(2)), expensesTotal: +(t.exp.toFixed(2)) });
  }
  return out;
}
