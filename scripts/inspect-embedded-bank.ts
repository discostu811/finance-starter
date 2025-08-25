// version: v0.1b1
// date: 2025-08-25 09:10 Europe/London
// changelog: slice: fix Amex 2024 date parsing
// CANARY: finance-starter v0.1c1 (inspect embedded bank sheets)
import { loadWorkbook } from "../lib/xlsx";
import { detectEmbeddedBankSheetNames, parseEmbeddedBankSheet } from "../lib/bank_embedded";
import * as XLSX from "xlsx";

const file = process.argv[2] || "./data/Savings.xlsx";
const year = Number(process.argv[3] || 2024);
const wb = loadWorkbook(file);

const names = detectEmbeddedBankSheetNames(wb.SheetNames);
console.log("Detected bank-like sheets:", names);
for (const n of names) {
  const ws = wb.Sheets[n];
  const grid = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null }) as any[][];
  const hdr = grid[0] || [];
  console.log(`\n[Headers?] ${n}`);
  console.log(hdr.map((c:any,i:number)=> String(c ?? `col_${i}`)));
  const sample = grid.slice(1, 6);
  console.log(`[Samples] ${n}`);
  console.log(sample);
  const parsed = parseEmbeddedBankSheet(ws, n, year);
  console.log(`[Parsed count ${year}] ${n}:`, parsed.length);
  console.log("First 3 parsed:", parsed.slice(0,3));
}
