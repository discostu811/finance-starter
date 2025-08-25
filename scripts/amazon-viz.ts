// version: v0.1b1
// date: 2025-08-25 08:51 Europe/London
// changelog: slice: fix Amex 2024 date parsing
// CANARY: finance-starter v0.1b3 (amazon viz)
import { writeFileSync, mkdirSync } from 'fs';
import { loadWorkbook, parseCardSheet } from '../lib/xlsx';
import {
  looksAmazon,
  extractAmazonDetailFromWorkbook,
  matchAmazonParentsWithGrouping,
  AmazonParent
} from '../lib/amazon';

const file = process.argv[2] || './data/Savings.xlsx';
const year = Number(process.argv[3] || 2024);
const outPath = process.argv[4] || `./reports/amazon-${year}.html`;

mkdirSync('./reports', { recursive: true });

const wb = loadWorkbook(file);
const amexName = wb.SheetNames.find(n => n.toLowerCase().includes(String(year)) && n.toLowerCase().includes('amex'));
const mcName   = wb.SheetNames.find(n => n.toLowerCase().includes(String(year)) && (n.toLowerCase().includes('mc') || n.toLowerCase().includes('master')));

const amex = amexName ? parseCardSheet(wb.Sheets[amexName], 'amex') : [];
const mc   = mcName   ? parseCardSheet(wb.Sheets[mcName], 'mc')   : [];
const all  = [...amex, ...mc];

const parents: AmazonParent[] = all
  .filter(t => looksAmazon(t.merchantRaw || t.descriptionRaw))
  .map(t => ({ source: t.source, postedDate: t.postedDate, amount: Math.abs(t.amount), merchant: (t.merchantRaw || t.descriptionRaw || ''), raw: { ...t } }));

const details = extractAmazonDetailFromWorkbook(wb, year);
const { singles, groups, unmatchedParents, unmatchedDetails } = matchAmazonParentsWithGrouping(parents, details, { daysWindow: 7, maxGroup: 3 });

const sum = (xs:number[]) => xs.reduce((a,b)=>a+b,0);
const two = (n:number)=> (Math.round(n*100)/100).toFixed(2);

// Coverage metrics
const parentsSum = sum(parents.map(p=>p.amount));
const singleSum  = sum(singles.map(m=>m.parent.amount));
const groupSum   = sum(groups.map(g=>g.parent.amount));
const matchedParentsCount = singles.length + groups.length;
const matchedParentsSum = singleSum + groupSum;
const coveragePct = parentsSum ? (matchedParentsSum/parentsSum*100) : 0;

// Monthly breakdown (by parent posted month)
function month(s:string){ return Number(s.slice(5,7)); }
const monthly: Record<number,{count:number,sum:number}> = {};
parents.forEach(p=>{
  const m = month(p.postedDate);
  if(!monthly[m]) monthly[m]={count:0,sum:0};
  monthly[m].count++; monthly[m].sum += p.amount;
});
const monthlyMatched: Record<number,{count:number,sum:number}> = {};
singles.forEach(m=>{
  const mm = month(m.parent.postedDate);
  if(!monthlyMatched[mm]) monthlyMatched[mm]={count:0,sum:0};
  monthlyMatched[mm].count++; monthlyMatched[mm].sum += m.parent.amount;
});
groups.forEach(g=>{
  const mm = month(g.parent.postedDate);
  if(!monthlyMatched[mm]) monthlyMatched[mm]={count:0,sum:0};
  monthlyMatched[mm].count++; monthlyMatched[mm].sum += g.parent.amount;
});

function esc(x:string){return x.replace(/[&<>"']/g, m=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m] as string));}

const rowsSingles = singles.slice(0,80).map(m=>`
<tr>
  <td>${esc(m.parent.postedDate)}</td>
  <td>£${two(m.parent.amount)}</td>
  <td>${esc(m.parent.merchant)}</td>
  <td>${esc((m.detail.detailDate||'—'))}</td>
  <td>£${two(m.detail.amount||0)}</td>
  <td>${esc(m.detail.sheet)}</td>
</tr>`).join("");

const rowsGroups = groups.slice(0,60).map(g=>`
<tr>
  <td>${esc(g.parent.postedDate)}</td>
  <td>£${two(g.parent.amount)}</td>
  <td>${esc(g.parent.merchant)}</td>
  <td>${g.details.map(d=>esc(d.detailDate||'—')).join('<br/>')}</td>
  <td>${g.details.map(d=>'£'+two(d.amount||0)).join('<br/>')}</td>
  <td>${esc(g.details.map(d=>d.sheet).join(', '))}</td>
</tr>`).join("");

const rowsUnmatchedParents = unmatchedParents.slice(0,80).map(p=>`
<tr><td>${esc(p.postedDate)}</td><td>£${two(p.amount)}</td><td>${esc(p.merchant)}</td></tr>`).join("");

const rowsUnmatchedDetails = unmatchedDetails.slice(0,80).map(d=>`
<tr><td>${esc(d.detailDate||'—')}</td><td>£${two(d.amount||0)}</td><td>${esc(d.sheet)}</td></tr>`).join("");

const monthlyRows = Array.from({length:12}, (_,i)=>i+1).map(m=>{
  const tot = monthly[m]?.sum||0, cnt = monthly[m]?.count||0;
  const mat = monthlyMatched[m]?.sum||0, mcnt = monthlyMatched[m]?.count||0;
  const pct = tot? (mat/tot*100):0;
  return `<tr><td>${String(m).padStart(2,'0')}</td><td>${cnt}</td><td>£${two(tot)}</td><td>${mcnt}</td><td>£${two(mat)}</td><td>${pct.toFixed(1)}%</td></tr>`;
}).join("");

const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<title>Amazon Match Viz ${year}</title>
<style>
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;margin:24px;line-height:1.4;}
h1,h2{margin:0 0 12px}
.card{border:1px solid #ddd;border-radius:12px;padding:16px;margin:16px 0;box-shadow:0 1px 3px rgba(0,0,0,.04)}
.kpi{display:flex;gap:16px;flex-wrap:wrap}
.kpi .box{padding:12px 16px;border-radius:10px;background:#f7f7f9;border:1px solid #eee;min-width:180px}
table{border-collapse:collapse;width:100%;}
th,td{border:1px solid #eee;padding:8px 10px;text-align:left;font-size:13px;vertical-align:top}
th{background:#fafafa}
.small{color:#666;font-size:12px}
</style>
</head>
<body>
<h1>Amazon Matching — ${year}</h1>
<div class="card kpi">
  <div class="box"><b>Parents (card):</b><br/>${parents.length} • £${two(parentsSum)}</div>
  <div class="box"><b>Matched parents:</b><br/>${matchedParentsCount} • £${two(matchedParentsSum)} (${coveragePct.toFixed(1)}%)</div>
  <div class="box"><b>Singles vs Groups:</b><br/>${singles.length} singles • ${groups.length} groups</div>
</div>

<div class="card">
  <h2>Monthly Coverage</h2>
  <table>
    <thead><tr><th>Month</th><th>#Parents</th><th>£Parents</th><th>#Matched</th><th>£Matched</th><th>Coverage</th></tr></thead>
    <tbody>${monthlyRows}</tbody>
  </table>
</div>

<div class="card">
  <h2>Single Matches (sample)</h2>
  <table>
    <thead><tr><th>Posted</th><th>£Parent</th><th>Merchant</th><th>Detail Date</th><th>£Detail</th><th>Detail Sheet</th></tr></thead>
    <tbody>${rowsSingles}</tbody>
  </table>
  <div class="small">Showing up to 80 rows.</div>
</div>

<div class="card">
  <h2>Group Matches (sample)</h2>
  <table>
    <thead><tr><th>Posted</th><th>£Parent</th><th>Merchant</th><th>Detail Dates</th><th>£Details</th><th>Sheets</th></tr></thead>
    <tbody>${rowsGroups}</tbody>
  </table>
  <div class="small">Showing up to 60 rows. Groups are exact sums (up to 3 lines) within ±7 days.</div>
</div>

<div class="card">
  <h2>Unmatched Parents (sample)</h2>
  <table>
    <thead><tr><th>Posted</th><th>£Amount</th><th>Merchant</th></tr></thead>
    <tbody>${rowsUnmatchedParents}</tbody>
  </table>
</div>

<div class="card">
  <h2>Unmatched Details (sample)</h2>
  <table>
    <thead><tr><th>Detail Date</th><th>£Amount</th><th>Sheet</th></tr></thead>
    <tbody>${rowsUnmatchedDetails}</tbody>
  </table>
</div>

</body>
</html>`;

writeFileSync(outPath, html);
console.log(`Wrote ${outPath}`);
