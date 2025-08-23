// CANARY: finance-starter v0.1b2 (suppressed compare)
import { loadWorkbook, parseCardSheet, parseDetailTruth } from '../lib/xlsx';
import { looksAmazon, extractAmazonDetailFromWorkbook, suppressMatchedAmazonParents, AmazonParent } from '../lib/amazon';

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
  .map(t => ({ source:t.source, postedDate:t.postedDate, amount:Math.abs(t.amount), merchant:(t.merchantRaw||t.descriptionRaw||''), raw:{...t} }));

if (process.env.AMAZON_SUPPRESS_PARENTS === '1') {
  const amazonDetails = extractAmazonDetailFromWorkbook(wb, year);
  const { kept, suppressed } = suppressMatchedAmazonParents(amazonParents, amazonDetails);
  console.log(`Amazon parents suppressed: ${suppressed.length} txns, £${suppressed.reduce((a,b)=>a+b.amount,0).toFixed(2)}`);
  const suppressedSet = new Set(suppressed.map(p => p.raw));
  all = all.filter(t => !suppressedSet.has(t));
}

// ... reconciliation loop identical to etl-compare-2024.ts
