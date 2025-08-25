// version: v0.1b1
// date: 2025-08-25 08:50 Europe/London
// changelog: slice: fix Amex 2024 date parsing
// CANARY: finance-starter v0.1c12 (category comparison: only show card-spend cats)
import * as XLSX from "xlsx";
import { loadWorkbook } from "../lib/xlsx";
import { parseAmex2024, parseMC2024, CardTxn } from "../lib/parse_cards";
import {
  extractAmazonDetailFromWorkbook,
  suppressMatchedAmazonParents,
} from "../lib/amazon";
import { extractDetailMonthly, extractDetailCategories } from "../lib/detail";

const file = process.argv[2] || "./data/Savings.xlsx";
const year = Number(process.argv[3] || 2024);
const wb = loadWorkbook(file);

// 1) Load cards
let amex: CardTxn[] = parseAmex2024(wb);
let mc:   CardTxn[] = parseMC2024(wb);

// 2) Optional Amazon suppression
if (process.env.AMAZON_SUPPRESS_PARENTS === "1") {
  const detail = extractAmazonDetailFromWorkbook(wb, year);
  const before = amex.length + mc.length;
  const sup: any = suppressMatchedAmazonParents(amex, mc, detail);
  if (sup && sup.amex && sup.mc) {
    amex = sup.amex; mc = sup.mc;
    const cnt = typeof sup.suppressedCount === "number" ? sup.suppressedCount : (before - (amex.length + mc.length));
    const amt = typeof sup.suppressedAmount === "number" ? sup.suppressedAmount : 0;
    console.log(`Amazon parents suppressed: ${cnt} txns${amt ? `, £${amt.toFixed(2)}` : ""}`);
  } else {
    const after = amex.length + mc.length;
    console.log(`Amazon parents suppressed (side-effect mode): ${before - after} txns`);
  }
}

// 3) Build month/category totals from cards using their sheet-provided category values
const cards = [...amex, ...mc].filter(t => (t.categoryRaw ?? "").toString().trim().length > 0);

type CatBuckets = Record<string, number>;
const perMonthCards: CatBuckets[] = Array.from({ length: 12 }, () => ({}));

for (const t of cards) {
  const m = Number(t.postedDate?.slice(5, 7)); // YYYY-MM-DD
  if (!m || m < 1 || m > 12) continue;
  const cat = (t.categoryRaw ?? "").toString().trim();
  perMonthCards[m - 1][cat] = (perMonthCards[m - 1][cat] || 0) + (t.amount || 0);
}

// Only keep positive spend by category (ignore card payments/refunds)
for (let i = 0; i < 12; i++) {
  for (const k of Object.keys(perMonthCards[i])) {
    perMonthCards[i][k] = perMonthCards[i][k] > 0 ? perMonthCards[i][k] : 0;
  }
}

// 4) Detail monthly
const detailMonthly = extractDetailMonthly(wb, year);
const detailCats = new Set(extractDetailCategories(wb));

// 5) Compare — only categories with any card spend this month
function f2(n: number) { return Number((n ?? 0).toFixed(2)); }

console.log(`\nCategory reconciliation (Cards vs Detail) — ${year}`);
console.log("Month | Category | Cards | Detail | Δ | OK?");
console.log("------+----------+-------+--------+---+-----");

for (let m = 1; m <= 12; m++) {
  const monthCards = perMonthCards[m - 1] || {};
  const monthDetail = detailMonthly[m - 1] || {};

  const catsToShow = Object.keys(monthCards)
    .filter(k => (monthCards[k] || 0) > 0)               // must have card spend
    .filter(k => detailCats.has(k));                     // must be a real Detail category

  if (catsToShow.length === 0) {
    console.log(`${String(m).padStart(5)} | (no card-category spend this month)`);
    continue;
  }

  for (const cat of catsToShow) {
    const our = f2(monthCards[cat] || 0);
    const truth = f2(monthDetail[cat] || 0);
    const diff = f2(our - truth);
    const ok = Math.abs(diff) < 0.01 ? "✅" : "❌";
    console.log(
      `${String(m).padStart(5)} | ${cat} | ${our.toFixed(2).padStart(7)} | ${truth.toFixed(2).padStart(6)} | ${diff.toFixed(2).padStart(6)} | ${ok}`
    );
  }
}
