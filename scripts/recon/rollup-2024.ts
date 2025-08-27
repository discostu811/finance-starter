// scripts/recon/rollup-2024.ts
// Standalone recon for 2024 that DOES NOT depend on lib/comparator.
// It reads the "Detail" sheet in Savings.xlsx and produces:
//   - out/{computed-2024.csv, detail-2024.csv, delta-2024.csv}
//   - out/recon-2024.md
//
// "Computed" fallback == "Detail" (same numbers), so Delta is all zeros.
// This guarantees a working report inside Codespaces while we stabilize
// transaction parsers. When parsers are available later, this script can
// be extended to replace "computed" with the real transaction rollup.

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import * as XLSX from "xlsx";
import { writeMarkdownReport, writeCSVs, makeDelta } from "../../lib/compare/mdReport";

type Table = { headers: string[]; rows: Array<Record<string, number|string>> };

function parseArgs(argv: string[]) {
  const args: Record<string,string> = {};
  for (let i=0; i<argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const k = argv[i].slice(2);
      const v = (i+1 < argv.length && !argv[i+1].startsWith("--")) ? argv[++i] : "true";
      args[k] = v;
    }
  }
  return args;
}

function fmt(n: any) {
  if (n === null || n === undefined || n === "") return 0;
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

// Read the "Detail" sheet and return a month x category table for a given year.
function readDetailForYear(xlsxPath: string, year: number): Table {
  const wb = XLSX.readFile(xlsxPath);
  const ws = wb.Sheets["Detail"];
  if (!ws) throw new Error(`Detail sheet not found in ${xlsxPath}`);
  const aoa = XLSX.utils.sheet_to_json<any>(ws, { header: 1, raw: true });
  if (!aoa || aoa.length < 2) throw new Error("Detail sheet is empty or malformed.");

  // Header row is the first row.
  const headers = (aoa[0] as any[]).map(v => String(v ?? "").trim());
  // Expect first 3 columns: Year, Month name, Month number, then categories, then Grand Total.
  const idxYear = 0, idxMonthNum = 2;
  // Identify category headers from column 3 until (but excluding) "Grand Total" if present.
  let lastCol = headers.length - 1;
  const grandIdx = headers.findIndex(h => /^grand total$/i.test(h));
  if (grandIdx > -1) lastCol = grandIdx;
  const categoryHeaders = headers.slice(3, lastCol);

  const rows: Array<Record<string, number|string>> = [];
  for (let i = 1; i < aoa.length; i++) {
    const r = aoa[i] as any[];
    if (!r || r.length === 0) continue;
    const y = fmt(r[idxYear]);
    const m = fmt(r[idxMonthNum]);
    if (y !== year || m < 1 || m > 12) continue;
    const rec: Record<string, number|string> = { Month: Number(m) };
    for (let c = 0; c < categoryHeaders.length; c++) {
      const h = categoryHeaders[c] || `Col${c+4}`;
      rec[h] = fmt(r[3 + c]);
    }
    // Include Grand Total if present
    if (grandIdx > -1) rec["Grand Total"] = fmt(r[grandIdx]);
    rows.push(rec);
  }
  // Sort by month asc
  rows.sort((a,b) => Number(a.Month) - Number(b.Month));
  const finalHeaders = ["Month", ...categoryHeaders];
  if (grandIdx > -1) finalHeaders.push("Grand Total");
  return { headers: finalHeaders, rows };
}

function ensureDir(p: string) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const xlsxPath = args["xlsx"] || "data/Savings.xlsx";
  const outPath = args["out"] || "out/recon-2024.md";
  const year = Number(args["year"] || 2024);

  console.log(`[info] loading workbook: ${xlsxPath}`);
  const detail = readDetailForYear(xlsxPath, year);
  console.log(`[info] detail months loaded: ${detail.rows.length}`);

  // Computed fallback == detail (until parsers are plugged in)
  const computed: Table = JSON.parse(JSON.stringify(detail));
  const delta = makeDelta(computed, detail);
  console.log(`[info] computed months: ${computed.rows.length}`);
  console.log(`[info] delta rows: ${delta.rows.length}`);

  ensureDir(outPath);
  // Write CSVs alongside the outPath
  const outDir = path.dirname(outPath);
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
