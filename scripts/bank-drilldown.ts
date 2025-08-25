// version: v0.1b1
// date: 2025-08-25 09:10 Europe/London
// changelog: slice: fix Amex 2024 date parsing
// CANARY: finance-starter v0.1c4 (bank drilldown by month & merchant)
import { loadWorkbook } from "../lib/xlsx";
import { parseAllEmbeddedBank, suppressCardBillPayments } from "../lib/bank_embedded";

const file = process.argv[2] || "./data/Savings.xlsx";
const year = Number(process.argv[3] || 2024);
const limit = Number(process.argv[4] || 20);

const wb = loadWorkbook(file);
let bank = parseAllEmbeddedBank(wb, year);
bank = suppressCardBillPayments(bank);

// group by month + merchant
type Bucket = { amt: number, count: number };
const expMap: Record<number, Record<string, Bucket>> = {};
const incMap: Record<number, Record<string, Bucket>> = {};

for (const t of bank) {
  const m = Number(t.postedDate.slice(5,7));
  const key = (t.merchantRaw || t.descriptionRaw || "").trim() || "(blank)";
  if (t.amount > 0) {
    if (!expMap[m]) expMap[m] = {};
    const b = expMap[m][key] || (expMap[m][key] = { amt: 0, count: 0 });
    b.amt += t.amount; b.count++;
  } else if (t.amount < 0) {
    if (!incMap[m]) incMap[m] = {};
    const b = incMap[m][key] || (incMap[m][key] = { amt: 0, count: 0 });
    b.amt += -t.amount; b.count++;
  }
}

function topN(rec: Record<string, Bucket>, n: number, desc = true) {
  const arr = Object.entries(rec).map(([k,v])=>({merchant:k, amt:v.amt, count:v.count}));
  arr.sort((a,b)=> desc ? b.amt - a.amt : a.amt - b.amt);
  return arr.slice(0, n);
}

for (let m = 1; m <= 12; m++) {
  const exps = expMap[m] || {};
  const incs = incMap[m] || {};
  const topExp = topN(exps, limit, true);
  const topInc = topN(incs, limit, true);
  console.log(`\n=== ${year}-${String(m).padStart(2,"0")} — Bank EXPENSES (top ${limit}) ===`);
  for (const r of topExp) console.log(`${r.amt.toFixed(2).padStart(12)}  ${r.merchant}`);
  console.log(`\n=== ${year}-${String(m).padStart(2,"0")} — Bank INCOME (top ${limit}) ===`);
  for (const r of topInc) console.log(`${r.amt.toFixed(2).padStart(12)}  ${r.merchant}`);
}
