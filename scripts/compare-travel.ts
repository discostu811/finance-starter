// CANARY: finance-starter v0.1c7 (compare monthly TRAVEL vs Detail)
import { loadWorkbook } from "../lib/xlsx";
import { parseAllEmbeddedBank, suppressCardBillPayments, BankTxn } from "../lib/bank_embedded";
import { parseAmex2024, parseMC2024 } from "../lib/parse_cards";
import { extractDetailMonthly } from "../lib/detail";

const file = process.argv[2] || "./data/Savings.xlsx";
const year = Number(process.argv[3] || 2024);

const wb = loadWorkbook(file);

// --- Bank travel ---
let bank = parseAllEmbeddedBank(wb, year);
bank = suppressCardBillPayments(bank);

const isGlobalMoney = (s: string) => s.toUpperCase().includes("GLOBAL MONEY");
const isTravelCat = (t: BankTxn) => (t.categoryRaw || "").toUpperCase() === "TRAVEL";

const bankTravelByMonth = Array(12).fill(0);
for (const t of bank) {
  const text = (t.merchantRaw || t.descriptionRaw || "");
  if (t.amount > 0 && (isTravelCat(t) || isGlobalMoney(text))) {
    const m = Number(t.postedDate.slice(5,7)) - 1;
    bankTravelByMonth[m] += t.amount;
  }
}

// --- Card travel (very lightweight: use CATEGORY/CATEGORIE columns if they say Travel) ---
const amex = parseAmex2024(wb).filter(r => r.amount > 0);
const mc   = parseMC2024(wb).filter(r => r.amount > 0);

function looksTravelLabel(s?: string) {
  if (!s) return false;
  const u = s.toUpperCase();
  return u.includes("TRAVEL") || u.includes("TFL TRAVEL") || u.includes("BA ") || u.includes("AIRWAYS");
}
const cardTravelByMonth = Array(12).fill(0);
for (const r of amex) {
  const m = Number(r.postedDate.slice(5,7)) - 1;
  if (looksTravelLabel(r.categoryRaw) || looksTravelLabel(r.merchantRaw) || looksTravelLabel(r.descriptionRaw)) {
    cardTravelByMonth[m] += r.amount;
  }
}
for (const r of mc) {
  const m = Number(r.postedDate.slice(5,7)) - 1;
  if (looksTravelLabel(r.categoryRaw) || looksTravelLabel(r.merchantRaw) || looksTravelLabel(r.descriptionRaw)) {
    cardTravelByMonth[m] += r.amount;
  }
}

// --- Truth (Detail -> Travel column) ---
const truth = extractDetailMonthly(wb, year);
const truthTravelByMonth = truth.map(m => Math.max(0, m["Travel"] || 0)); // ensure positive expenses

// --- Combine bank + cards ---
const ourTravelByMonth = bankTravelByMonth.map((v,i)=> v + cardTravelByMonth[i]);

function fmt(n: number) { return n.toFixed(2).padStart(10); }

// Output
console.log("Month |   Our Travel   Truth Travel   ΔTravel");
console.log("------+---------------------------------------");
for (let i=0;i<12;i++) {
  const our = ourTravelByMonth[i];
  const tru = truthTravelByMonth[i];
  const d = +(our - tru).toFixed(2);
  const ok = Math.abs(d) < 1 ? "✅" : "❌";
  console.log(`${String(i+1).padStart(5)} | ${fmt(our)} ${fmt(tru)} ${fmt(d)} ${ok}`);
}

// Top GLOBAL MONEY by month (to sanity-check attribution)
type Bucket = { amt: number, desc: string };
const tops: Record<number, Bucket[]> = {};
for (let i=0;i<12;i++) tops[i] = [];
for (const t of bank) {
  if (!(isTravelCat(t) || isGlobalMoney(t.merchantRaw || t.descriptionRaw || ""))) continue;
  if (t.amount <= 0) continue;
  const m = Number(t.postedDate.slice(5,7)) - 1;
  const desc = t.merchantRaw || t.descriptionRaw || "";
  tops[m].push({ amt: t.amount, desc });
}
for (let i=0;i<12;i++) {
  const arr = tops[i].sort((a,b)=>b.amt-a.amt).slice(0,5);
  if (!arr.length) continue;
  console.log(`\n=== ${year}-${String(i+1).padStart(2,"0")} Travel Top (Bank) ===`);
  for (const r of arr) console.log(`${r.amt.toFixed(2).padStart(10)}  ${r.desc}`);
}
