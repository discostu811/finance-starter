// finance-starter — compare-categories-by-source.ts
// Updates in this drop:
// - BANK category lookup is now robust (case-insensitive, multiple aliases)
// - "UK Cash" (and any other category) is treated like Restaurants—no virtual account
// - Safe Amazon parent suppression stays guarded

import { loadWorkbook } from "../lib/xlsx";
import { parseAmex, parseMC } from "../lib/parse_cards";
import {
  extractAmazonDetailFromWorkbook,
  matchAmazonParentsToDetail,
  suppressMatchedAmazonParents,
} from "../lib/amazon";
import {
  parseAllEmbeddedBank,
  suppressCardBillPayments,
} from "../lib/bank_embedded";

const file = process.argv[2] || "./data/Savings.xlsx";
const year = process.argv[3] || "2024";

const wb = loadWorkbook(file);
const amexArr = parseAmex(wb, year);
const mcArr = parseMC(wb, year);
let bankArr = parseAllEmbeddedBank(wb, year);

// ---------- helpers ----------
const norm = (s: string) =>
  (s || "").toLowerCase().replace(/\s+/g, " ").trim();

const titleCase = (s: string) =>
  (s || "").replace(/\b\w+/g, w => w[0]?.toUpperCase() + w.slice(1));

function monthFrom(anyDate: any): number {
  if (!anyDate && anyDate !== 0) return NaN as any;
  // excel serial date
  if (typeof anyDate === "number" && isFinite(anyDate)) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(epoch.getTime() + anyDate * 86400000);
    return d.getUTCMonth() + 1;
  }
  const d = new Date(anyDate);
  if (isNaN(d as any)) return NaN as any;
  return d.getMonth() + 1;
}

// case-insensitive field picker over multiple aliases
function pickField<T = any>(obj: any, aliases: string[]): T | undefined {
  if (!obj) return undefined;
  const keys = Object.keys(obj);
  for (const k of keys) {
    const low = k.toLowerCase();
    if (aliases.includes(low)) return obj[k];
  }
  return undefined;
}

// BANK category resolver: tries many common spellings + fallbacks
function getBankCategory(b: any): string {
  const val =
    pickField(b, [
      "categoryraw",
      "category",
      "cat",
      "bankcategory",
      "detailcategory",
      "detail_cat",
      "detailcategoryraw",
      "subcategory",
      "group",
      "label",          // sometimes people export like this
      "type",           // last-ditch, if they stuck category in here
    ]) ?? "";

  const cleaned = String(val).trim();
  return cleaned || "Uncat";
}

// BANK date resolver: postedDate/date/txnDate
function getBankDate(b: any): any {
  return (
    pickField(b, ["posteddate", "date", "txndate", "transactiondate"]) ??
    b.postedDate ??
    b.date
  );
}

// ---------- Amazon suppression (guarded) ----------
if (process.env.AMAZON_SUPPRESS_PARENTS === "1") {
  try {
    const detailRaw: any = extractAmazonDetailFromWorkbook(wb, year);
    const details =
      Array.isArray(detailRaw)
        ? detailRaw
        : Array.isArray(detailRaw?.details)
          ? detailRaw.details
          : Array.isArray(detailRaw?.rows)
            ? detailRaw.rows
            : [];

    if (details.length) {
      const matched = matchAmazonParentsToDetail([...amexArr, ...mcArr], details);
      suppressMatchedAmazonParents(matched);
    } else {
      console.warn(`[amazon] No detail rows found for ${year}; skipping parent suppression.`);
    }
  } catch (e: any) {
    console.warn(`[amazon] Failed to process Amazon detail: ${e?.message}. Skipping parent suppression.`);
  }
}

// ---------- Bank card-bill suppression (optional) ----------
if (process.env.BANK_SUPPRESS_CARD_BILLS === "1") {
  bankArr = suppressCardBillPayments(bankArr);
}

// ---------- collect normalized rows ----------
type Row = { month: number; cat: string; amt: number; src: "amex" | "mc" | "bank" };
const rows: Row[] = [];

// AMEX
for (const r of amexArr) {
  rows.push({
    month: monthFrom((r as any).postedDate ?? (r as any).date),
    cat: (r as any).categoryRaw ?? (r as any).category ?? "Uncat",
    amt: (r as any).amount,
    src: "amex",
  });
}

// MC
for (const r of mcArr) {
  rows.push({
    month: monthFrom((r as any).postedDate ?? (r as any).date),
    cat: (r as any).categoryRaw ?? (r as any).category ?? "Uncat",
    amt: (r as any).amount,
    src: "mc",
  });
}

// BANK (robust category + date)
for (const b of bankArr) {
  rows.push({
    month: monthFrom(getBankDate(b)),
    cat: getBankCategory(b),
    amt: (b as any).amount,
    src: "bank",
  });
}

// ---------- canonical display labels by normalized key ----------
const byNorm: Record<string, string> = {};
for (const r of rows) {
  const key = norm(r.cat);
  if (!byNorm[key]) {
    // preserve user's original style if it had caps; else TitleCase the normalized key
    const nice = r.cat && /[A-Z]/.test(r.cat) ? r.cat : titleCase(key);
    byNorm[key] = nice;
  }
}
const cats = Object.keys(byNorm).sort();

// sum helper
function agg(rows: Row[], src: Row["src"], month: number, normKey: string): number {
  let sum = 0;
  for (const r of rows) {
    if (r.src !== src) continue;
    if (r.month !== month) continue;
    if (norm(r.cat) !== normKey) continue;
    sum += r.amt;
  }
  return sum;
}

function fmt(n: number) {
  return (isFinite(n) ? n : 0).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ---------- header ----------
console.log(`[cards] AMEX: using sheet "${year} amex" with ${amexArr.length} data rows`);
console.log(`[cards] MC: using sheet "${year} mc" with ${mcArr.length} data rows`);
console.log(
  `[diag] year=${year} AMAZON_SUPPRESS=${process.env.AMAZON_SUPPRESS_PARENTS === "1"} BANK_SUPPRESS_BILLS=${process.env.BANK_SUPPRESS_CARD_BILLS === "1"} amex=${amexArr.length} mc=${mcArr.length} bank=${bankArr.length}`
);
console.log(`Category reconciliation by SOURCE — ${year}`);
console.log("Month | Category | Cards | Bank | OurSum | Detail | Δ | OK?");
console.log("------+----------+-------+------+--------+--------+---+-----");

// ---------- body ----------
for (let m = 1; m <= 12; m++) {
  for (const key of cats) {
    const label = byNorm[key];
    const amexV = agg(rows, "amex", m, key);
    const mcV   = agg(rows, "mc",   m, key);
    const bankV = agg(rows, "bank", m, key);

    const ours = amexV + mcV;
    const truth = bankV; // “Bank” = “Detail” column in output
    const diff = ours - truth;

    if (Math.abs(ours) > 0.009 || Math.abs(truth) > 0.009) {
      const ok = Math.abs(diff) < 0.01 ? "✅" : "❌";
      console.log(
        `${m.toString().padStart(4)} | ${label.padEnd(14)} | ${fmt(ours).padStart(7)} | ${fmt(truth).padStart(6)} | ${fmt(ours).padStart(8)} | ${fmt(truth).padStart(8)} | ${fmt(diff).padStart(7)} | ${ok}`
      );
    }
  }
}
