// version: v0.1b1
// date: 2025-08-25 08:51 Europe/London
// changelog: slice: fix Amex 2024 date parsing
// CANARY: finance-starter v0.1b4 (suppressed compare uses grouping + truth parser)
import { loadWorkbook, parseCardSheet } from '../lib/xlsx';
import { parseDetailTruthSheet as parseDetailTruth } from '../lib/truth';
import {
  looksAmazon,
  extractAmazonDetailFromWorkbook,
  suppressMatchedAmazonParents,
  AmazonParent
} from '../lib/amazon';

const file = process.argv[2] || './data/Savings.xlsx';
const year = Number(process.argv[3] || 2024);
const wb = loadWorkbook(file);

const amexName = wb.SheetNames.find(n => n.toLowerCase().includes(String(year)) && n.toLowerCase().includes('amex'));
const mcName   = wb.SheetNames.find(n => n.toLowerCase().includes(String(year)) && (n.toLowerCase().includes('mc') || n.toLowerCase().includes('master')));

const amex = amexName ? parseCardSheet(wb.Sheets[amexName], 'amex') : [];
const mc   = mcName   ? parseCardSheet(wb.Sheets[mcName], 'mc')   : [];
let all = [...amex, ...mc];

let amazonParents: AmazonParent[] = all
  .filter(t => looksAmazon(t.merchantRaw || t.descriptionRaw))
  .map(t => ({
    source: t.source,
    postedDate: t.postedDate,
    amount: Math.abs(t.amount),
    merchant: (t.merchantRaw || t.descriptionRaw || ''),
    raw: { ...t }
  }));

if (process.env.AMAZON_SUPPRESS_PARENTS === '1') {
  const amazonDetails = extractAmazonDetailFromWorkbook(wb, year);
  const { kept, suppressed } = suppressMatchedAmazonParents(amazonParents, amazonDetails);
  console.log(`Amazon parents suppressed (v0.1b3/4 group-aware): ${suppressed.length} txns, £${suppressed.reduce((a,b)=>a+b.amount,0).toFixed(2)}`);
  const suppressedSet = new Set(suppressed.map(p => p.raw));
  all = all.filter(t => !suppressedSet.has(t));
}

const detailName = wb.SheetNames.find(n => n.toLowerCase() === 'detail');
const truth = detailName ? parseDetailTruth(wb.Sheets[detailName], year) : [];

const incExpByMonth: Record<number, { inc: number; exp: number }> = {};
for (const t of all) {
  const m = Number(t.postedDate.slice(5,7));
  if (!incExpByMonth[m]) incExpByMonth[m] = { inc: 0, exp: 0 };
  if (t.amount < 0) incExpByMonth[m].inc += -t.amount;
  else incExpByMonth[m].exp += t.amount;
}

console.log(`Reconciliation (${year}) — Our vs Detail`);
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
