// CANARY: finance-starter v0.1b2 (amazon report)
import { loadWorkbook, parseCardSheet } from '../lib/xlsx';
import { looksAmazon, extractAmazonDetailFromWorkbook, matchAmazonParentsToDetail, AmazonParent } from '../lib/amazon';

const file = process.argv[2] || './data/Savings.xlsx';
const yearArg = Number(process.argv[3] || 2024);
const wb = loadWorkbook(file);

const amexName = wb.SheetNames.find(n => n.toLowerCase().includes(String(yearArg)) && n.toLowerCase().includes('amex'));
const mcName   = wb.SheetNames.find(n => n.toLowerCase().includes(String(yearArg)) && (n.toLowerCase().includes('mc') || n.toLowerCase().includes('master')));

const amex = amexName ? parseCardSheet(wb.Sheets[amexName], 'amex') : [];
const mc   = mcName   ? parseCardSheet(wb.Sheets[mcName], 'mc')   : [];
const all  = [...amex, ...mc];

const parents: AmazonParent[] = all
  .filter(t => looksAmazon(t.merchantRaw || t.descriptionRaw))
  .map(t => ({ source: t.source, postedDate: t.postedDate, amount: Math.abs(t.amount), merchant: (t.merchantRaw || t.descriptionRaw || ''), raw: { ...t } }));

const details = extractAmazonDetailFromWorkbook(wb, yearArg);
const { matched, unmatchedParents, unmatchedDetails } = matchAmazonParentsToDetail(parents, details);

const sum = (xs:number[]) => xs.reduce((a,b)=>a+b,0);
const two = (n:number)=> (Math.round(n*100)/100).toFixed(2);

console.log(`Parents (card Amazon): ${parents.length}, sum £${two(sum(parents.map(p=>p.amount)))}`);
console.log(`Details (Amazon tabs): ${details.length}, sum £${two(sum(details.map(d=>d.amount || 0)))}`);
console.log(`Matched: ${matched.length}, sum £${two(sum(matched.map(m=>m.parent.amount)))}`);
console.log(`Unmatched parents: ${unmatchedParents.length}, sum £${two(sum(unmatchedParents.map(p=>p.amount)))}`);
console.log(`Unmatched details: ${unmatchedDetails.length}, sum £${two(sum(unmatchedDetails.map(d=>d.amount || 0)))}`);

console.log('\nSample matches (10):');
matched.slice(0,10).forEach(m => {
  console.log(`  ${m.parent.postedDate} £${two(m.parent.amount)}  ${m.parent.merchant}  ⇄  ${(m.detail.detailDate || '—')} ${m.detail.sheet}`);
});

console.log('\nTop 10 unmatched parents:');
unmatchedParents.slice(0,10).forEach(p => console.log(`  ${p.postedDate} £${two(p.amount)}  ${p.merchant}`));

console.log('\nTop 10 unmatched details:');
unmatchedDetails.slice(0,10).forEach(d => console.log(`  ${(d.detailDate || '—')} £${two(d.amount || 0)}  [${d.sheet}]`));
