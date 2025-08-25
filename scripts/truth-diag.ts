// version: v0.1b1
// date: 2025-08-25 09:10 Europe/London
// changelog: slice: fix Amex 2024 date parsing
import * as XLSX from "xlsx";
import { parseDetailTruthSheet } from "../lib/truth";

const file = process.argv[2] || "./data/Savings.xlsx";
const year = Number(process.argv[3] || 2024);
const wb = XLSX.readFile(file);
const sheetName = wb.SheetNames.find(n => n.toLowerCase() === "detail");
if (!sheetName) { console.log("No Detail"); process.exit(0); }

const ws = wb.Sheets[sheetName];

// Reuse logic loosely: dump the first body row for the year and compute both totals
function a1(ws: XLSX.WorkSheet): any[][] {
  return XLSX.utils.sheet_to_json(ws, { defval: null, raw: true, header: 1 }) as any[][];
}
const grid = a1(ws);

// naive header find used by lib/truth.ts
function findHeaderIdx(grid: any[][]): number {
  for (let i = 0; i < Math.min(100, grid.length); i++) {
    const row = grid[i] ?? [];
    const txt = row.map((c:any)=>String(c ?? "").trim().toLowerCase());
    if (txt.includes("total expenses") && (txt.includes("david salary") || txt.includes("sonya salary"))) return i;
  }
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

const hdrIdx = findHeaderIdx(grid);
const header = (grid[hdrIdx] ?? grid[0]).map((h:any,i:number)=> (h==null||String(h).trim()==="")?`col_${i}`:String(h).trim());
const body = grid.slice((hdrIdx>=0?hdrIdx:0)+1);

const totalExpIdx = header.findIndex(h => h.toLowerCase() === "total expenses");
const incomeCols = header.map((h,i)=>[h.toLowerCase(),i] as const).filter(([h])=> h==="david salary" || h==="sonya salary").map(([_,i])=>i);
const start = Math.min(...["David salary","Sonya salary","Housing","Grocery","Restaurants"].map(k=> header.findIndex(h => h.toLowerCase()===k.toLowerCase())).filter(i=>i>=0));

for (const r of body) {
  const y = toNum(r[0]);
  if (y !== year) continue;
  const m = toNum(r[2]);
  if (!m) continue;

  let total = 0;
  if (totalExpIdx >= 0) total = Math.abs(toNum(r[totalExpIdx]));
  let summed = 0;
  const s = Number.isFinite(start) ? start : 3;
  for (let i = s; i < header.length; i++){
    if (incomeCols.includes(i)) continue;
    const name = header[i].toLowerCase();
    if (!name || name.startsWith("col_")) continue;
    const v = toNum(r[i]);
    if (v > 0) summed += v;
    else if (v < 0 && name.includes("refund")) summed += 0;
    else if (v < 0) summed += Math.abs(v);
  }

  console.log("Month", m, "TotalExpensesCell=", total, "SummedCategories=", summed);
  if (m >= 3) break; // print first couple of months only
}
