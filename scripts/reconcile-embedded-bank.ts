// CANARY: finance-starter v0.1c1 (reconcile Amex+MC+EmbeddedBank vs Detail)
import { loadWorkbook, parseCardSheet } from "../lib/xlsx";
import { parseDetailTruthSheet } from "../lib/truth";
import { looksAmazon, extractAmazonDetailFromWorkbook, suppressMatchedAmazonParents, AmazonParent } from "../lib/amazon";
import { parseAllEmbeddedBank, suppressCardBillPayments } from "../lib/bank_embedded";

const file = process.argv[2] || "./data/Savings.xlsx";
const year = Number(process.argv[3] || 2024);
const SUPPRESS_AMZ = process.env.AMAZON_SUPPRESS_PARENTS === "1";

const wb = loadWorkbook(file);

// Cards
const amexName = wb.SheetNames.find(n => n.toLowerCase().includes(String(year)) && n.toLowerCase().includes("amex"));
const mcName   = wb.SheetNames.find(n => n.toLowerCase().includes(String(year)) && (n.toLowerCase().includes("mc") || n.toLowerCase().includes("master")));
const amex = amexName ? parseCardSheet(wb.Sheets[amexName], "amex") : [];
const mc   = mcName   ? parseCardSheet(wb.Sheets[mcName], "mc")   : [];
let all = [...amex, ...mc];

// Amazon parent suppression (cards)
if (SUPPRESS_AMZ) {
  const parents: AmazonParent[] = all
    .filter(t => looksAmazon(t.merchantRaw || t.descriptionRaw))
    .map(t => ({ source:t.source, postedDate:t.postedDate, amount:Math.abs(t.amount), merchant:(t.merchantRaw||t.descriptionRaw||""), raw:{...t} }));
  const amazonDetails = extractAmazonDetailFromWorkbook(wb, year);
  const { suppressed } = suppressMatchedAmazonParents(parents, amazonDetails);
  const sup = new Set(suppressed.map(p => p.raw));
  all = all.filter(t => !sup.has(t));
  console.log(`Amazon parents suppressed: ${suppressed.length} txns, £${suppressed.reduce((a,b)=>a+b.amount,0).toFixed(2)}`);
}

// Embedded bank (David/Sonya account)
let bank = parseAllEmbeddedBank(wb, year);
const before = bank.length;
bank = suppressCardBillPayments(bank);
const after = bank.length;
if (after !== before) {
  console.log(`Suppressed bank card-bill rows: ${before - after}`);
}
all = [...all, ...bank];

// Truth (full Detail, with our improved fallback)
const detailName = wb.SheetNames.find(n => n.toLowerCase() === "detail");
const truth = detailName ? parseDetailTruthSheet(wb.Sheets[detailName], year) : [];

const incExpByMonth: Record<number, { inc: number; exp: number }> = {};
for (const t of all) {
  const m = Number(t.postedDate.slice(5,7));
  if (!incExpByMonth[m]) incExpByMonth[m] = { inc: 0, exp: 0 };
  if (t.amount < 0) incExpByMonth[m].inc += -t.amount;  // income
  else incExpByMonth[m].exp += t.amount;                // expense
}

console.log(`\nReconciliation (Cards + Embedded Bank) — ${year}`);
console.log("Month |   Inc(Our)   Inc(Truth)   ΔIncome |   Exp(Our)   Exp(Truth)    ΔExp");
console.log("------+-----------------------------------+--------------------------------");
for (let m = 1; m <= 12; m++) {
  const ours = incExpByMonth[m] || { inc: 0, exp: 0 };
  const truthRow = truth.find(r => r.month === m);
  const incTruth = truthRow ? truthRow.incomeTotal : 0;
  const expTruth = truthRow ? truthRow.expensesTotal : 0;
  const dInc = +(ours.inc - incTruth).toFixed(2);
  const dExp = +(ours.exp - expTruth).toFixed(2);
  const okInc = dInc === 0 ? "✅" : "❌";
  const okExp = dExp === 0 ? "✅" : "❌";
  console.log(`${String(m).padStart(5)} | ${ours.inc.toFixed(2).padStart(10)} ${incTruth.toFixed(2).padStart(10)} ${dInc.toFixed(10)} ${okInc} | ${ours.exp.toFixed(10)} ${expTruth.toFixed(10)} ${dExp.toFixed(10)} ${okExp}`);
}
