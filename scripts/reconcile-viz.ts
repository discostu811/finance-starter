// version: v0.1b1
// date: 2025-08-25 08:51 Europe/London
// changelog: slice: fix Amex 2024 date parsing
// CANARY: finance-starter v0.1b4 (reconcile viz)
import { writeFileSync, mkdirSync } from 'fs';
import { loadWorkbook, parseCardSheet } from '../lib/xlsx';
import { parseDetailTruthSheet } from '../lib/truth';
import { looksAmazon, extractAmazonDetailFromWorkbook, suppressMatchedAmazonParents, AmazonParent } from '../lib/amazon';

const file = process.argv[2] || './data/Savings.xlsx';
const year = Number(process.argv[3] || 2024);
const outPath = process.argv[4] || `./reports/reconcile-${year}.html`;

mkdirSync('./reports', { recursive: true });

const wb = loadWorkbook(file);
const amexName = wb.SheetNames.find(n => n.toLowerCase().includes(String(year)) && n.toLowerCase().includes('amex'));
const mcName   = wb.SheetNames.find(n => n.toLowerCase().includes(String(year)) && (n.toLowerCase().includes('mc') || n.toLowerCase().includes('master')));

const amex = amexName ? parseCardSheet(wb.Sheets[amexName], 'amex') : [];
const mc   = mcName   ? parseCardSheet(wb.Sheets[mcName], 'mc')   : [];
let all = [...amex, ...mc];

// suppress if env set
let suppressedCount = 0, suppressedSum = 0;
if (process.env.AMAZON_SUPPRESS_PARENTS === '1') {
  const parents: AmazonParent[] = all
    .filter(t => looksAmazon(t.merchantRaw || t.descriptionRaw))
    .map(t => ({ source:t.source, postedDate:t.postedDate, amount:Math.abs(t.amount), merchant:(t.merchantRaw||t.descriptionRaw||''), raw:{...t} }));
  const amazonDetails = extractAmazonDetailFromWorkbook(wb, year);
  const { kept, suppressed } = suppressMatchedAmazonParents(parents, amazonDetails);
  const supSet = new Set(suppressed.map(s => s.raw));
  all = all.filter(t => !supSet.has(t));
  suppressedCount = suppressed.length;
  suppressedSum = suppressed.reduce((a,b)=>a+b.amount,0);
}

const truthName = wb.SheetNames.find(n => n.toLowerCase()==='detail');
const truth = truthName ? parseDetailTruthSheet(wb.Sheets[truthName], year) : [];

const sum = (xs:number[])=> xs.reduce((a,b)=>a+b,0);
const two = (n:number)=> (Math.round(n*100)/100).toFixed(2);

// our month buckets
const byM: Record<number,{inc:number,exp:number}> = {};
for (const t of all){
  const m = Number(t.postedDate.slice(5,7));
  if (!byM[m]) byM[m]={inc:0,exp:0};
  if (t.amount<0) byM[m].inc += -t.amount; else byM[m].exp += t.amount;
}

const rows = Array.from({length:12}, (_,i)=>i+1).map(m=>{
  const ours = byM[m]||{inc:0,exp:0};
  const tr = truth.find(r=>r.month===m) || {incomeTotal:0,expensesTotal:0};
  const dI = ours.inc - tr.incomeTotal;
  const dE = ours.exp - tr.expensesTotal;
  return { m, ours, tr, dI, dE };
});

const htmlRows = rows.map(r=>`
<tr>
  <td>${String(r.m).padStart(2,'0')}</td>
  <td>£${two(r.ours.inc)}</td>
  <td>£${two(r.tr.incomeTotal)}</td>
  <td>${two(r.dI)} ${r.dI===0?'✅':'❌'}</td>
  <td>£${two(r.ours.exp)}</td>
  <td>£${two(r.tr.expensesTotal)}</td>
  <td>${two(r.dE)} ${r.dE===0?'✅':'❌'}</td>
</tr>
`).join("");

const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<title>Reconcile ${year}</title>
<style>
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;margin:24px;line-height:1.4;}
h1{margin:0 0 12px}
.card{border:1px solid #ddd;border-radius:12px;padding:16px;margin:16px 0;box-shadow:0 1px 3px rgba(0,0,0,.04)}
table{border-collapse:collapse;width:100%}
th,td{border:1px solid #eee;padding:8px 10px;font-size:13px}
th{background:#fafafa;text-align:left}
.kpi{display:flex;gap:16px;flex-wrap:wrap}
.kpi .box{padding:12px 16px;border-radius:10px;background:#f7f7f9;border:1px solid #eee;min-width:200px}
small{color:#666}
</style>
</head>
<body>
<h1>Reconciliation — ${year}</h1>
<div class="card kpi">
  <div class="box"><b>Amazon suppressed:</b><br/>${suppressedCount} txns • £${two(suppressedSum)}</div>
  <div class="box"><b>Total ΔIncome:</b><br/>£${two(sum(rows.map(r=>r.dI)))}</div>
  <div class="box"><b>Total ΔExpenses:</b><br/>£${two(sum(rows.map(r=>r.dE)))}</div>
</div>
<div class="card">
  <table>
    <thead>
      <tr>
        <th>Month</th>
        <th>Inc (Our)</th>
        <th>Inc (Truth)</th>
        <th>ΔIncome</th>
        <th>Exp (Our)</th>
        <th>Exp (Truth)</th>
        <th>ΔExp</th>
      </tr>
    </thead>
    <tbody>${htmlRows}</tbody>
  </table>
  <p><small>✅ means exact match for that measure in that month.</small></p>
</div>
</body>
</html>`;

writeFileSync(outPath, html);
console.log(`Wrote ${outPath}`);
