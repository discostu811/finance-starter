// version: v0.1b1
// date: 2025-08-25 09:10 Europe/London
// changelog: slice: fix Amex 2024 date parsing
import * as XLSX from "xlsx";
import fs from "node:fs";
import path from "node:path";

function toAoa(sh: XLSX.Sheet): any[][] {
  if (!sh) return [];
  const aoa = XLSX.utils.sheet_to_json(sh, { header: 1, raw: true }) as any[][];
  return (aoa || []).filter(r => (r ?? []).some(c => c !== null && c !== undefined && String(c).trim() !== ""));
}

function showSheet(wb: XLSX.WorkBook, name: string, maxRows = 10) {
  const sh = wb.Sheets[name];
  if (!sh) {
    console.log(`[scratch] sheet "${name}" not found`);
    return;
  }
  const aoa = toAoa(sh);
  const header = (aoa[0] || []).map(x => String(x ?? "").trim());
  console.log(`\n[${name}] header columns (${header.length}):`);
  console.log(header.join(" | "));
  for (let i = 1; i < Math.min(aoa.length, maxRows + 1); i++) {
    console.log(`row${i}: ${aoa[i].map(x => (x === undefined || x === null ? "" : String(x))).join(" | ")}`);
  }
  console.log(`[${name}] total rows (incl header): ${aoa.length}`);
}

const xlsxPath = process.argv[2];
const year = process.argv[3];
if (!xlsxPath || !year) {
  console.error("Usage: npx tsx scripts/scratch-parse-cards.ts <xlsxPath> <year>");
  process.exit(1);
}

const buf = fs.readFileSync(path.resolve(xlsxPath));
const wb = XLSX.read(buf, { type: "buffer" });

console.log("Sheets:", wb.SheetNames.join(", "));

const amexName = `${year} amex`;
const mcName   = `${year} mc`;

showSheet(wb, amexName, 10);
showSheet(wb, mcName, 10);
