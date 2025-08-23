// CANARY: finance-starter v0.1c6 (probe GLOBAL MONEY net by month)
import { loadWorkbook } from "../lib/xlsx";
import { parseAllEmbeddedBank, suppressCardBillPayments } from "../lib/bank_embedded";

const file = process.argv[2] || "./data/Savings.xlsx";
const year = Number(process.argv[3] || 2024);
const wb = loadWorkbook(file);

let bank = parseAllEmbeddedBank(wb, year);
bank = suppressCardBillPayments(bank); // still hide explicit card-bill payments

const monthly = Array.from({length:12},()=>({exp:0,inc:0}));
for (const t of bank) {
  const text = (t.merchantRaw || t.descriptionRaw || "").toUpperCase();
  if (!text.includes("GLOBAL MONEY")) continue;
  const m = Number(t.postedDate.slice(5,7)) - 1;
  if (t.amount > 0) monthly[m].exp += t.amount;   // debit (spend)
  else monthly[m].inc += -t.amount;               // credit (refund/inflow)
}

console.log("Month | GLOBAL MONEY Expense | GLOBAL MONEY Income | Net (Exp - Inc)");
console.log("------+----------------------+---------------------+----------------");
for (let i=0;i<12;i++){
  const exp = monthly[i].exp;
  const inc = monthly[i].inc;
  const net = +(exp - inc).toFixed(2);
  console.log(`${String(i+1).padStart(5)} | ${exp.toFixed(2).padStart(20)} | ${inc.toFixed(19)} | ${net.toFixed(14)}`);
}
