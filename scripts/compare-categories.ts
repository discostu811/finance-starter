// CANARY: finance-starter v0.1c11 (category comparison, robust suppression handling)
// Compares per-month, per-category (from card sources) against Detail ground truth.
// Uses your sheet category fields directly (no guessing).

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

// 1) Load card txns
let amex: CardTxn[] = parseAmex2024(wb);
let mc:   CardTxn[] = parseMC2024(wb);

// 2) Optional: suppress Amazon parent rows if matching Amazon detail exists
if (process.env.AMAZON_SUPPRESS_PARENTS === "1") {
  const detail = extractAmazonDetailFromWorkbook(wb, year);
  const beforeCount = amex.length + mc.length;

  // Some versions return { amex, mc, suppressedCount, suppressedAmount }
  // Others may side-effect and return void. Handle both safely.
  const sup: any = suppressMatchedAmazonParents(amex, mc, detail);

  if (sup && sup.amex && sup.mc) {
    amex = sup.amex as CardTxn[];
    mc   = sup.mc   as CardTxn[];
    const cnt = typeof sup.suppressedCount === "number" ? sup.suppressedCount : (beforeCount - (amex.length + mc.length));
    const amt = typeof sup.suppressedAmount === "number" ? sup.suppressedAmount : 0;
    console.log(`Amazon parents suppressed: ${cnt} txns${amt ? `, £${amt.toFixed(2)}` : ""}`);
  } else {
    const afterCount = amex.length + mc.length;
    const cnt = beforeCount - afterCount;
    console.log(`Amazon parents suppressed (side-effect mode): ${cnt} txns`);
  }
}

const cards = [...amex, ...mc];

// Keep only rows that have a category string
const cardsWithCat = cards.filter(t => (t.categoryRaw ?? "").toString().trim().length > 0);

// 3) Build per-month, per-category totals from cards (expenses positive)
type CatBuckets = Record<string, number>;
const perMonthCards: CatBuckets[] = Array.from({ length: 12 }, () => ({}));

for (const t of cardsWithCat) {
  const m = Number(t.postedDate?.slice(5, 7)); // "YYYY-MM-DD"
  if (!m || m < 1 || m > 12) continue;
  const cat = (t.categoryRaw ?? "").toString().trim();
  perMonthCards[m - 1][cat] = (perMonthCards[m - 1][cat] || 0) + (t.amount || 0);
}
// Keep only positive expense flow per category (refunds/payments become 0 here)
for (let i = 0; i < 12; i++) {
  for (const k of Object.keys(perMonthCards[i])) {
    perMonthCards[i][k] = perMonthCards[i][k] > 0 ? perMonthCards[i][k] : 0;
  }
}

// 4) Load Detail per-month totals
const detailMonthly = extractDetailMonthly(wb, year); // array[12] of { category: amount }
const detailCats = new Set(extractDetailCategories(wb)); // all Detail column names

// 5) Compare
function f2(n: number) { return Number((n ?? 0).toFixed(2)); }

console.log(`\nCategory reconciliation (Cards vs Detail) — ${year}`);
console.log("Month | Category | Cards | Detail | Δ | OK?");
console.log("------+----------+-------+--------+---+-----");

for (let m = 1; m <= 12; m++) {
  const monthCards = perMonthCards[m - 1] || {};
  const monthDetail = detailMonthly[m - 1] || {};

  const keys = new Set<string>([
    ...Object.keys(monthCards),
    ...Object.keys(monthDetail),
  ]);

  // Only show categories that exist in Detail’s columns
  const catsToShow = [...keys].filter(k => detailCats.has(k));

  if (catsToShow.length === 0) {
    console.log(`${String(m).padStart(5)} | (no overlapping categories this month)`);
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
