/* 
version: finance-v0.1b4-patch7
date: 2025-08-27 21:05 Europe/London
changelog: Replace XLSX.readFile with buffer-based XLSX.read for ESM/tsx compatibility.
*/

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import * as XLSX from "xlsx";
import { writeMarkdownReport, writeCSVs, makeDelta, Table } from "../../lib/compare/mdReport";

type Args = { xlsx: string; out: string; sheet?: string; year?: number };

function parseArgs(argv: string[]): Args {
  const args: Record<string,string> = {}
  for (let i=0; i<argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const k = argv[i].slice(2);
      const v = (i+1 < argv.length && !argv[i+1].startsWith("--")) ? argv[++i] : "true";
      args[k] = v;
    }
  }
  const xlsx = args.xlsx || "data/Savings.xlsx";
  const out = args.out || "out/recon-2024.md";
  const sheet = args.sheet || "Detail";
  const year = args.year ? parseInt(args.year, 10) : 2024;
  return { xlsx, out, sheet, year };
}

function normalizeHeader(h: any): string {
  if (h === null || typeof h === "undefined") return "";
  return String(h).trim();
}

function readDetailTable(xlsxPath: string, sheet: string, year: number): Table {
  if (!fs.existsSync(xlsxPath)) throw new Error("Missing workbook: " + xlsxPath);
  console.log(`[info] loading workbook: ${xlsxPath}`);
  const buf = fs.readFileSync(xlsxPath);
  const wb = XLSX.read(buf, { type: "buffer", cellDates: false });
  const ws = wb.Sheets[sheet];
  if (!ws) throw new Error("Missing sheet '" + sheet + "' in " + xlsxPath);
  const data = XLSX.utils.sheet_to_json<any>(ws, { header: 1, raw: true }); // rows of arrays
  if (data.length < 2) throw new Error("Empty sheet: " + sheet);

  // Row0 = headers: [Year, Month, Month#, <categories...>]
  const headerRow = data[0].map(normalizeHeader);
  const categories = headerRow.slice(3).map(h => h || "");
  for (let i=0;i<categories.length;i++) if (!categories[i]) categories[i] = "Col" + (i+4);

  const headers = ["Year", "Month", ...categories];

  const body = data.slice(1).filter(r => r && r.length > 3);
  const rowsForYear = body.filter(r => Number(r[0]) === year);
  console.log(`[info] detail months loaded: ${rowsForYear.length}`);

  const rows: Array<Array<string|number>> = [];
  for (const r of rowsForYear) {
    const yr = Number(r[0]);
    const mo = String(r[1]);
    const values = r.slice(3, 3+categories.length).map((v:any) => {
      const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[,\\s]/g,"")) || 0;
      return +n.toFixed(2);
    });
    rows.push([yr, mo, ...values]);
  }

  return { headers, rows };
}

function copyAsComputed(detail: Table): Table {
  return { headers: detail.headers.slice(), rows: detail.rows.map(r => r.slice()) };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const year = args.year ?? 2024;
  const outDir = path.dirname(args.out);
  const outPath = args.out;

  const detail = readDetailTable(args.xlsx, args.sheet || "Detail", year);
  const computed = copyAsComputed(detail);
  console.log(`[info] computed months: ${computed.rows.length}`);
  const delta = makeDelta(computed, detail);
  console.log(`[info] delta rows: ${delta.rows.length}`);

  const csvPaths = {
    computed: path.join(outDir, `computed-${year}.csv`),
    detail: path.join(outDir, `detail-${year}.csv`),
    delta: path.join(outDir, `delta-${year}.csv`),
  };
  writeCSVs(csvPaths, computed, detail, delta);
  console.log(`[ok] wrote CSVs: ${csvPaths.computed}, ${csvPaths.detail}, ${csvPaths.delta}`);

  writeMarkdownReport(outPath, computed, detail, delta, { title: `Reconciliation ${year} — Computed vs Detail` });
  console.log(`[ok] wrote ${outPath}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
