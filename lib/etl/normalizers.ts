// version: finance-v0.1b3
// date: 2025-08-27 15:03 Europe/London
// changelog: sign unification + category normalization

export type Txn = { Month:number, Category:string, Amount:number, Source:string };

export function normalizeCategories(cat: string, mapping: Record<string,string>) {
  if (!cat) return cat;
  if (mapping[cat] != null) return mapping[cat];
  return cat;
}

export function unifyHouseholdSigns(txns: Txn[], incomeCats: string[]) {
  return txns.map(t => {
    let amt = Number(t.Amount);
    if (t.Source === 'mc') { amt = -amt; }             // MC spend negative -> positive
    if (t.Source === 'david' || t.Source === 'sonya') { amt = -amt; } // banks: outflow negative -> positive
    if (incomeCats.includes(t.Category)) { amt = -Math.abs(amt); }    // income negative
    return {...t, Amount: amt};
  });
}
