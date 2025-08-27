// version: finance-v0.1b3
// date: 2025-08-27 15:03 Europe/London
// changelog: pivot month×category + totals

export type Txn = { Month:number, Category:string, Amount:number };

export function pivotMonthCategory(txns: Txn[]) {
  const cats = Array.from(new Set(txns.map(t => t.Category))).sort();
  const months = Array.from(new Set(txns.map(t => t.Month))).sort((a,b)=>a-b);
  const table: Record<number, Record<string, number>> = {};
  for (const m of months) {
    table[m] = {};
    for (const c of cats) table[m][c] = 0;
  }
  for (const t of txns) {
    if (!table[t.Month]) table[t.Month] = {};
    if (table[t.Month][t.Category] == null) table[t.Month][t.Category] = 0;
    table[t.Month][t.Category] += Number(t.Amount)||0;
  }
  const rows = months.map(m => {
    const row:any = {Month: m};
    for (const c of cats) row[c] = table[m][c]||0;
    row['Grand Total'] = Object.values(table[m]).reduce((a:any,b:any)=>a+Number(b), 0);
    return row;
  });
  return {categories: cats, rows};
}
