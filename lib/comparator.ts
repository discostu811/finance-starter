// version: v0.1b1
// date: 2025-08-25 09:10 Europe/London
// changelog: slice: fix Amex 2024 date parsing
// lib/comparator.ts
import { DetailTruthRow, MonthlyRollup } from './types';

export type VarianceRow = {
  month: number;
  incomeOur: number; incomeTruth: number; incomeDiff: number;
  expensesOur: number; expensesTruth: number; expensesDiff: number;
};

export function compareToTruth(our: MonthlyRollup[], truth: DetailTruthRow[]): VarianceRow[] {
  const truthMap = new Map(truth.map(t => [t.month, t]));
  const out: VarianceRow[] = [];
  for (const r of our) {
    const t = truthMap.get(r.month);
    if (!t) continue;
    const incomeDiff = +(r.incomeTotal - t.incomeTotal).toFixed(2);
    const expensesDiff = +(r.expensesTotal - t.expensesTotal).toFixed(2);
    out.push({
      month: r.month,
      incomeOur: r.incomeTotal,
      incomeTruth: t.incomeTotal,
      incomeDiff,
      expensesOur: r.expensesTotal,
      expensesTruth: t.expensesTotal,
      expensesDiff,
    });
  }
  return out;
}

export function printVarianceTable(rows: VarianceRow[]) {
  const fmt = (n: number) => n.toFixed(2).padStart(10);
  console.log('\nReconciliation (2024) — Our vs Detail');
  console.log('Month |   Inc(Our)   Inc(Truth)   ΔIncome |   Exp(Our)   Exp(Truth)    ΔExp');
  console.log('------+-----------------------------------+--------------------------------');
  for (const r of rows) {
    const greenIncome = r.incomeDiff === 0 ? '✅' : '❌';
    const greenExp = r.expensesDiff === 0 ? '✅' : '❌';
    console.log(
      `${String(r.month).padStart(5)} | ${fmt(r.incomeOur)} ${fmt(r.incomeTruth)} ${fmt(r.incomeDiff)} ${greenIncome} | ${fmt(r.expensesOur)} ${fmt(r.expensesTruth)} ${fmt(r.expensesDiff)} ${greenExp}`
    );
  }
  const allGreen = rows.every(r => r.incomeDiff === 0 && r.expensesDiff === 0);
  console.log('\nResult:', allGreen ? 'ALL GREEN ✅' : 'MISMATCHES FOUND ❌ (likely Amazon detail needed)');
}

/** Compatibility wrapper: stable entry point for recon scripts */
export function buildComparison(workbook: any, year: number) {
  // Delegate to the existing comparison implementation
  return compareToTruth(workbook, year);
}


export default buildComparison;
