// CANARY: finance-starter v0.2a1 (bank inspector)
import * as XLSX from "xlsx";

const file = process.argv[2];
if (!file) { console.error("Usage: npx tsx scripts/inspect-bank.ts <bank-file>"); process.exit(1); }
const wb = XLSX.readFile(file, { raw: true });
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true, header: 1 }) as any[][];
const headers = (rows[0] ?? []).map((c:any,i:number)=> String(c ?? `col_${i}`));
console.log("[Headers]", headers);
console.log("[Sample rows]");
console.log((rows.slice(1,6) || []).map(r => r.slice(0, Math.min(r.length, headers.length))));
