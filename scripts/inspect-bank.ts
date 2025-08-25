// version: v0.1b1
// date: 2025-08-25 09:10 Europe/London
// changelog: slice: fix Amex 2024 date parsing
// CANARY: finance-starter v0.2a1 (bank inspector - buffer based)
import * as XLSX from "xlsx";
import fs from "fs";
import path from "path";

const file = process.argv[2];
if (!file) {
  console.error("Usage: npx tsx scripts/inspect-bank.ts <bank-file.csv|.xlsx>");
  process.exit(1);
}

const abs = path.resolve(file);
const buf = fs.readFileSync(abs);
const wb = XLSX.read(buf, { type: "buffer", raw: true });

const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true, header: 1 }) as any[][];
const headers = (rows[0] ?? []).map((c:any,i:number)=> String(c ?? `col_${i}`));

console.log("[Headers]", headers);
console.log("[Sample rows]");
console.log((rows.slice(1,6) || []).map(r => r.slice(0, Math.min(r.length, headers.length))));
