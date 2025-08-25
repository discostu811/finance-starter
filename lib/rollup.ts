// version: v0.1b1
// date: 2025-08-25 09:10 Europe/London
// changelog: slice: fix Amex 2024 date parsing
// lib/rollup.ts
import dayjs from 'dayjs';
import { CanonicalTxn, MonthlyRollup } from './types';

export function rollupMonthly(year: number, txns: CanonicalTxn[]): MonthlyRollup[] {
  const yTx = txns.filter(t => dayjs(t.postedDate).year() === year);

  const buckets = new Map<number, { income: number; expenses: number }>();
  for (let m = 1; m <= 12; m++) buckets.set(m, { income: 0, expenses: 0 });

  for (const t of yTx) {
    const m = dayjs(t.postedDate).month() + 1;
    const b = buckets.get(m)!;
    if (t.amount >= 0) b.expenses += t.amount;
    else b.income += -t.amount;
  }

  const out: MonthlyRollup[] = [];
  for (let m = 1; m <= 12; m++) {
    const { income, expenses } = buckets.get(m)!;
    const savings = income - expenses;
    const savingsRate = income > 0 ? +(savings / income).toFixed(4) : null;
    out.push({
      year,
      month: m,
      incomeTotal: +income.toFixed(2),
      expensesTotal: +expenses.toFixed(2),
      savings: +savings.toFixed(2),
      savingsRate,
    });
  }
  return out;
}
