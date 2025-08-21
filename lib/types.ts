// lib/types.ts

export type CanonicalTxn = {
  source: 'amex' | 'mc';
  postedDate: string;      // YYYY-MM-DD
  amount: number;          // signed, expenses positive here
  currency?: string;
  merchantRaw?: string;
  descriptionRaw?: string;
};

export type MonthlyRollup = {
  year: number;
  month: number;           // 1..12
  incomeTotal: number;     // positive number
  expensesTotal: number;   // positive number
  savings: number;         // income - expenses
  savingsRate: number | null; // (income - expenses)/income or null if income=0
};

export type DetailTruthRow = {
  year: number;
  month: number;
  incomeTotal: number;     // from "Detail"
  expensesTotal: number;   // from "Detail"
};
