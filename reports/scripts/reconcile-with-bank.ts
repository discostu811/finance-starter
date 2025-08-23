// CANARY: finance-starter v0.2a1 (Amex+MC+Bank vs full Detail)
import fs from "fs";
import { loadWorkbook, parseCardSheet } from "../lib/xlsx";
import { parseDetailTruthSheet } from "../lib/truth";
import { parseBankFile, BankSchema } from "../lib/bank";
import { looksAmazon, extractAmazonDetailFromWorkbook, suppressMatchedAmazonParents, AmazonParent } from "../lib/amazon";

const xlsxFile = process.argv[2] || "./data/Savings.xlsx";
const year = Number(process.argv[3] || 2024);
const bankFile = process.argv[4];                    // e.g., ./data/bank/hsbc-2024.csv or .xlsx
const bankSchemaFile = process.argv[5];              // e.g., ./data/bank-schemas/example-hsbc-2024.json
const SUPPRESS = process.env.AMAZON_SUPPRESS_PARENTS === "1";

const wb = loadWorkbook(xlsxFile);
const amexName = wb.SheetNames.find(n => n.toLowerCase().includes(String(year)) && n.toLowerCase().includes("amex"));
const mcName   = wb.SheetNames.find(n => n.toLowerCase().includes(String(year)) && (n.toLowerCase().includes("mc") || n.toLowerCase().includes("master")));

const amex = amexName ? parseCardSheet(wb.Sheets[amexName], "amex") : [];
const mc   = mcName   ? parseCardSheet(wb.Sheets[mcName], "mc")   : [];
let all = [...amex, ...mc];

if (SUPPRESS) {
  const parents: AmazonParent[] = all
    .filter(t => looksAmazon(t.merchantRaw || t.descriptionRaw))
    .map(t => ({ source:t.source, postedDate:t.postedDate, amount:Math.abs(t.amount), merchant:(t.merchantRaw||t.descriptionRaw||""), raw:{...t} }));
  const amazonDetails = extractAmazonDetailFromWorkbook(wb, year);
  const { suppressed } = suppressMatchedAmazonParents(parents, amazonDetails);
  const supSet = new Set(suppressed.map(s => s.raw));
  all = all.filter(t => !supSet.has(t));
  console.log(`Amazon parents suppressed: ${suppressed.length} txns, £${suppressed.reduce((a,b)=>a+b.amount,0).toFixed(2)}`);
}

// Bank ingestion (optional on first run)
let bankTxns: any[] = [];
if (bankFile && bankSchemaFile) {
  const schema = JSON.parse(fs.readFileSync(bankSchemaFile, "utf-8")) as BankSchema;
  bankTxns = parseBankFile(bankFile, schema);
  // keep only requested year
  bankTxns = bankTxns.filter(t => t.postedDate.startsWith(String(year)));
  all = [...all, ...bankTxns];
  console.log(`Bank txns loaded: ${bankTxns.length}`);
}

const truthName = wb.SheetNames.find(n => n.toLowerCase()==="detail");
const truth = truthName ? parseDetailTruthSheet(wb.Sheets[truthName], year) : [];

const byM: Record<number,{inc:number,exp:number}> = {};
for (const t of all){
  const m = Number(t.postedDate.slice(5,7));
  if (!byM[m]) byM[m]={inc:0,exp:0};
  if (t.amount<0) byM[m].inc += -t.amount; else byM[m].exp += t.amount;
}

console.log(`\nReconciliation (ALL sources ingested) — ${year}`);
console.log("Month |   Inc(Our)   Inc(Truth)   ΔIncome |   Exp(Our)   Exp(Truth)    ΔExp");
console.log("------+-----------------------------------+--------------------------------");
for (let m=1;m<=12;m++){
  const ours = byM[m]||{inc:0,exp:0};
  const tr = truth.find(r=>r.month===m) || {incomeTotal:0,expensesTotal:0};
  const dI = +(ours.inc - tr.incomeTotal).toFixed(2);
  const dE = +(ours.exp - tr.expensesTotal).toFixed(2);
  const okI = dI===0?"✅":"❌";
  const okE = dE===0?"✅":"❌";
  console.log(`${String(m).padStart(5)} | ${ours.inc.toFixed(2).padStart(10)} ${tr.incomeTotal.toFixed(2).padStart(10)} ${dI.toFixed(10)} ${okI} | ${ours.exp.toFixed(10)} ${tr.expensesTotal.toFixed(10)} ${dE.toFixed(10)} ${okE}`);
}
