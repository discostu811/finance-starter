// version: v0.1b1
// date: 2025-08-25 08:50 Europe/London
// changelog: slice: fix Amex 2024 date parsing
import * as XLSX from "xlsx";
import fs from "node:fs";
import path from "node:path";

type Row = Record<string, any>;
type CardTxn = { source: "AMEX" | "MC", month: number, category: string, amount: number };

function toAoa(sh: XLSX.Sheet): any[][] {
  if (!sh) return [];
  const aoa = XLSX.utils.sheet_to_json(sh, { header: 1, raw: true }) as any[][];
  return (aoa || []).filter(r => (r ?? []).some(c => c !== null && c !== undefined && String(c).trim() !== ""));
}

function headerMap(aoa: any[][]): Record<string, number> {
  const h = (aoa[0] || []).map(x => String(x ?? "").trim());
  const map: Record<string, number> = {};
  h.forEach((name, i) => { map[name.toLowerCase()] = i; });
  return map;
}

function col(ri: any[], hm: Record<string, number>, names: string[]): any {
  for (const n of names) {
    const idx = hm[n.toLowerCase()];
    if (idx !== undefined) return ri[idx];
  }
  return undefined;
}

function parseCardSheet(wb: XLSX.WorkBook, name: string, source: "AMEX" | "MC"): CardTxn[] {
  const sh = wb.Sheets[name];
  if (!sh) {
    console.log(`[cards] ${source}: sheet "${name}" not found`);
    return [];
  }
  const aoa = toAoa(sh);
  if (aoa.length <= 1) return [];
  const hm = headerMap(aoa);

  // heuristics for headers seen in your workbook
  const catCols = ["Category", "CATEGORY", "CATEGORIE"];
  const amtCols = ["CONVERTED £", "Converted £", "Converted amount", "Amount"]; // fallback to Amount
  const monthCols = ["Month"];

  const out: CardTxn[] = [];
  for (let i = 1; i < aoa.length; i++) {
    const r = aoa[i] as any[];
    const rawCat = String(col(r, hm, catCols) ?? "").trim();
    const rawAmt = col(r, hm, amtCols);
    const rawMonth = col(r, hm, monthCols);

    // skip empty / header-ish rows
    if (!rawCat && (rawAmt === undefined || rawAmt === null)) continue;

    // numeric amount (use converted if present, else raw Amount)
    const amt = Number(rawAmt);
    if (Number.isNaN(amt)) continue;

    // normalize category; ignore card payments/refunds categories
    const catLower = rawCat.toLowerCase();
    if (catLower === "payment" || catLower === "card bill" || catLower === "refund") continue;

    // month fallback from date serial if needed (not expected here, we have Month)
    let month = Number(rawMonth);
    if (!Number.isFinite(month)) continue;

    out.push({
      source,
      month,
      category: rawCat,
      amount: amt,
    });
  }
  console.log(`[cards] ${source}: using sheet "${name}" with ${out.length} parsed txns`);
  return out;
}

function sumByMonthCategory(rows: CardTxn[]): Map<string, { amount: number, count: number }> {
  const m = new Map<string, { amount: number, count: number }>();
  for (const r of rows) {
    const key = `${r.month}|${r.category}`;
    const entry = m.get(key) || { amount: 0, count: 0 };
    entry.amount += r.amount;
    entry.count += 1;
    m.set(key, entry);
  }
  return m;
}

const xlsxPath = process.argv[2];
const year = process.argv[3];
if (!xlsxPath || !year) {
  console.error("Usage: npx tsx scripts/cards-only-reconcile.ts <xlsxPath> <year>");
  process.exit(1);
}

const buf = fs.readFileSync(path.resolve(xlsxPath));
const wb = XLSX.read(buf, { type: "buffer" });

const amexName = `${year} amex`;
const mcName   = `${year} mc`;

const amexTx = parseCardSheet(wb, amexName, "AMEX");
const mcTx   = parseCardSheet(wb, mcName, "MC");
const all = [...amexTx, ...mcTx];

console.log(`[diag] parsed counts amex=${amexTx.length} mc=${mcTx.length} total=${all.length}`);

const sums = sumByMonthCategory(all);

// pretty table sorted by month then category
console.log("Month | Category | CardsSum | Count");
console.log("----- + -------- + -------- + -----");
[...sums.entries()]
  .map(([k, v]) => {
    const [m, c] = k.split("|");
    return { month: Number(m), category: c, amount: v.amount, count: v.count };
  })
  .sort((a, b) => (a.month - b.month) || a.category.localeCompare(b.category))
  .forEach(r => {
    const amt = new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(r.amount);
    console.log(`${String(r.month).padStart(5)} | ${r.category.padEnd(8)} | ${amt.padStart(8)} | ${String(r.count).padStart(5)}`);
  });
