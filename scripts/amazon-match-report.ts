// scripts/amazon-match-report.ts
// v0.1b — probe: report proposed Amazon parent↔detail matches (no ETL suppression)

import { loadWorkbook, parseCardSheet } from '../lib/xlsx';
import { looksAmazon, extractAmazonDetailFromWorkbook, matchAmazonParentsToDetail } from '../lib/amazon';

const file = process.argv[2] || './data/Savings.xlsx';
const yearArg = Number(process.argv[3] || 2024);

const wb = loadWorkbook(file);

// find card sheets for year
const amexName = wb.SheetNames.find(n => n.toLowerCase().includes(String(yearArg)) && n.toLowerCase().includes('amex'));
const mcName = wb.SheetNames.find(n => n.toLowerCase().includes(String(yearArg)) && (n.toLowerCase().includes('mc') || n.toLowerCase().includes('master')));

const amex = amexName ? parseCardSheet(wb.Sheets[amexName], 'amex') : [];
const mc   = mcName   ? parseCardSheet(wb.Sheets[mcName], 'mc')   : [];
const all  = [...amex, ...mc];

const parents = all
  .filter(t => looksAmazon(t.merchantRaw || t.descriptionRaw))
  .map(t => ({ source: t.source, postedDate: t.postedDate, amount: Math.abs(t.amount), merchant: (t.merchantRaw || t.descriptionRaw || ''), raw: t }));

const details = extractAmazonDetailFromWorkbook(wb, yearArg);

const sum = (xs:number[]) => xs.reduce((a,b)=>a+b,0);
const two = (n:number)=> (Math.round(n*100)/100).toFixed(2);

console.log(`[v0.1b probe] Year=${yearArg}`);
console.log(`Parents (card Amazon): ${parents.length}`);
console.log(`Details (Amazon tabs): ${details.length}`);

const { matched, unmatchedParents, unmatchedDetails } = matchAmazonParentsToDetail(parents, details);

console.log(`Matched pairs: ${matched.length} — sum £${two(sum(matched.map(m => m.parent.amount)))}`);
console.log(`Unmatched parents: ${unmatchedParents.length} — sum £${two(sum(unmatchedParents.map(p => p.amount)))}`);
console.log(`Unmatched details: ${unmatchedDetails.length} — sum £${two(sum(unmatchedDetails.map(d => d.amount || 0)))}`);

console.log('\nSample matches (up to 12):');
matched.slice(0,12).forEach(m => {
  console.log(`  ${m.parent.postedDate} £${two(m.parent.amount)}  ${m.parent.merchant}  ⇄  ${m.detail.detailDate || '—'} [${m.detail.sheet}]`);
});

console.log('\nTop unmatched parents (up to 12):');
unmatchedParents.slice(0,12).forEach(p => {
  console.log(`  ${p.postedDate} £${two(p.amount)}  ${p.merchant}`);
});

console.log('\nTop unmatched details (up to 12):');
unmatchedDetails.slice(0,12).forEach(d => {
  console.log(`  ${d.detailDate || '—'} £${two(d.amount || 0)}  [${d.sheet}]`);
});

console.log('\nPreview: suppressing matched parents would reduce expenses by £' + two(sum(matched.map(m => m.parent.amount))) + '.');
