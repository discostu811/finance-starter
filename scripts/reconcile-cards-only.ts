// version: v0.1b1
// date: 2025-08-25 08:51 Europe/London
// changelog: slice: fix Amex 2024 date parsing
// CANARY: finance-starter v0.1b5 (cards-only reconcile)
import { writeFileSync, mkdirSync } from 'fs';
import { loadWorkbook, parseCardSheet } from '../lib/xlsx';
import { parseDetailTruthCardsOnly } from '../lib/truth_cards_only';
import { looksAmazon, extractAmazonDetailFromWorkbook, suppressMatchedAmazonParents, AmazonParent } from '../lib/amazon';

const file = process.argv[2] || './data/Savings.xlsx';
const year = Number(process.argv[3] || 2024);
const outPath = process.argv[4] || `./reports/reconcile-cards-${year}.html`;

mkdirSync('./reports', { recursive: true });

const wb = loadWorkbook(file);
const amexName = wb.SheetNames.find(n => n.toLowerCase().includes(String(year)) && n.toLowerCase().includes('amex'));
const mcName   = wb.SheetNames.find(n => n.toLowerCase().includes(String(year)) && (n.toLowerCase().includes('mc') || n.toLowerCase().includes('master')));

const amex = amexName ? parseCardSheet(wb.Sheets[amexName], 'amex') : [];
const mc   = mcName   ? parseCardSheet(wb.Sheets[mcName], 'mc')   : [];
let all = [...amex, ...mc];

// Optional suppression of Amazon parents if env is set
let suppressedCount = 0, suppressedSum = 0;
if (process.env.AMAZON_SUPPRESS_PARENTS === '1') {
  const parents: AmazonParent[] = all
    .filter(t => looksAmazon(t.merchantRaw || t.descriptionRaw))
    .map(t => ({ source:t.source, postedDate:t.postedDate, amount:Math.abs(t.amount), merchant:(t.merchantRaw||t.descriptionRaw||''), raw:{...t} }));
  const amazonDetails = extractAmazonDetailFromWorkbook(wb, year);
  const { kept, suppressed } = suppressMatchedAmazonParents(parents, amazonDetails);
  const sup = new Set(suppressed.map(s => s.raw));
  all = all.filter(t => !sup.has(t));
  suppressedCount = suppressed.length;
  suppressedSum = suppressed.reduce((a,b)=>a+b.amount,0);
}

const truthName = wb.SheetNames.find(n => n.toLowerCase()==='detail');
const truth = truthName ? parseDetailTruthCardsOnly(wb.Sheets[truthName], year) : [];

const ourByM: Record<number, { exp: number }> = {};
for (const t of all) {
  const m = Number(t.postedDate.slice(5,7));
  if (!ourByM[m]) ourByM[m] = { exp: 0 };
  if (t.amount > 0) ourByM[m].exp += t.amount;      // card charges positive
  else ourByM[m].exp += 0;                           // ignore refunds here (or subtract if you prefer)
}

const two = (n:number)=> (Math.round(n*100)/100).toFixed(2);
const sum = (xs:number[]) => xs.reduce((a,b)=>a+b,0);

const rows = Array.from({length:12}, (_,i)=>i+1).map(m=>{
  const ours = ourByM[m]?.exp || 0;
  const truthExp = truth.find(r=>r.month===m)?.expensesTotal || 0;
  const d = +(ours - truthExp).toFixed(2);
  return { m, ours, truthExp, d };
});

const htmlRows = rows.map(r=>`
<tr>
  <td>${String(r.m).padStart(2,'0')}</td>
  <td>£${two(r.ours)}</td>
  <td>£${two(r.truthExp)}</td>
  <td>${two(r.d)} ${r.d===0?'✅':'❌'}</td>
</tr>`).join("");

const html = `<!doctype html>
<html><head><meta charset="utf-8"/><title>Cards-only Reconcile ${year}</title>
<style>
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;margin:24px}
table{border-collapse:collapse;width:100%}
th,td{border:1px solid #eee;padding:8px 10px;font-size:13px}
th{background:#fafafa;text-align:left}
.kpi{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px}
.kpi .box{padding:12px 16px;border-radius:10px;background:#f7f7f9;border:1px solid #eee;min-width:200px}
small{color:#666}
</style></head>
<body>
<h1>Cards-only Reconciliation — ${year}</h1>
<div class="kpi">
  <div class="box"><b>Amazon suppressed:</b><br/>${suppressedCount} • £${two(suppressedSum)}</div>
  <div class="box"><b>Total Δ (sum months):</b><br/>£${two(sum(rows.map(r=>r.d)))}</div>
</div>
<table>
  <thead><tr><th>Month</th><th>Exp (Our — Cards)</th><th>Exp (Truth — Cards-only)</th><th>Δ</th></tr></thead>
  <tbody>${htmlRows}</tbody>
</table>
<p><small>Cards-only truth includes these categories: Grocery, Restaurants, Entertainment, Travel, Oyster, Clothes, Kitchen, Electronics, Accessories, Supplies, Gift, UK cabs, Others, Services.</small></p>
</body></html>`;

mkdirSync('./reports', { recursive: true });
writeFileSync(outPath, html);
console.log(`Wrote ${outPath}`);
