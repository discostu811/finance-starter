import { loadWorkbook, parseCardSheet } from '../lib/xlsx';

(async () => {
  const file = process.argv[2] || './data/Savings.xlsx';
  const wb = loadWorkbook(file);
  const amexName = wb.SheetNames.find(n => n.toLowerCase().includes('2024') && n.toLowerCase().includes('amex'))!;
  const mcName   = wb.SheetNames.find(n => n.toLowerCase().includes('2024') && (n.toLowerCase().includes('mc') || n.toLowerCase().includes('master')))!;

  const amex = parseCardSheet(wb.Sheets[amexName], 'amex');
  const mc   = parseCardSheet(wb.Sheets[mcName], 'mc');
  const all  = [...amex, ...mc];

  const inflows = all.filter(t => t.amount < 0);
  const byDesc: Record<string, number> = {};
  for (const t of inflows) {
    const d = (t.merchantRaw || t.descriptionRaw || '').toUpperCase();
    byDesc[d] = (byDesc[d] || 0) + Math.abs(t.amount);
  }
  const top = Object.entries(byDesc).sort((a,b)=>b[1]-a[1]).slice(0,25);
  console.log('Top inflow descriptions (abs sum):');
  for (const [desc, sum] of top) console.log(sum.toFixed(2).padStart(12), '  ', desc);
})();
