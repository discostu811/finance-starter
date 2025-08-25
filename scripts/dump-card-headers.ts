// version: v0.1b1
// date: 2025-08-25 08:51 Europe/London
// changelog: slice: fix Amex 2024 date parsing
import * as XLSX from "xlsx";
import { loadWorkbook } from "../lib/xlsx";

const file = process.argv[2] || "./data/Savings.xlsx";
const year = String(process.argv[3] || 2024);
const wb = loadWorkbook(file);

// list all sheets first
console.log("Sheets:", Object.keys(wb.Sheets).join(", "));

// dump the first non-empty row (headers) for any sheet that looks like amex/mc for the year
for (const [name, sh] of Object.entries(wb.Sheets)) {
  const lname = name.toLowerCase();
  if (!lname.includes(year) || !(lname.includes("amex") || lname.includes("mc"))) continue;
  const aoa: any[][] = XLSX.utils.sheet_to_json(sh, { header: 1, raw: true }) as any[][];
  const header = (aoa[0] || []).map(v => String(v ?? "").trim());
  console.log(`\n[${name}] header columns (${header.length}):`);
  console.log(header.join(" | "));
  // also show first 3 data rows so we can spot which column is category/desc/amount/date
  for (let i = 1; i <= 3 && i < aoa.length; i++) {
    console.log(`row${i}:`, (aoa[i] || []).map(v => String(v ?? "")).join(" | "));
  }
}
