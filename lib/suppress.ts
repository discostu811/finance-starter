// version: v0.1b1
// date: 2025-08-25 08:51 Europe/London
// changelog: slice: fix Amex 2024 date parsing
// CANARY: finance-starter v0.1c5 (suppression config)
import fs from "fs";

export type SuppressConfig = {
  bank?: {
    expense_ignore?: string[];
    income_ignore?: string[];
  };
  cards?: {
    expense_ignore?: string[];
    income_ignore?: string[];
  };
};

let cached: SuppressConfig | null = null;
let compiled: {
  bank: { expense: RegExp[]; income: RegExp[] };
  cards: { expense: RegExp[]; income: RegExp[] };
} | null = null;

export function loadSuppress(): SuppressConfig {
  if (cached) return cached;
  try {
    const raw = fs.readFileSync("./config/suppress.json", "utf8");
    cached = JSON.parse(raw);
  } catch {
    cached = {};
  }
  return cached!;
}

function compile(list?: string[]) {
  return (list || []).map(s => new RegExp(s, "i"));
}

export function getCompiled() {
  if (compiled) return compiled;
  const cfg = loadSuppress();
  compiled = {
    bank: {
      expense: compile(cfg.bank?.expense_ignore),
      income: compile(cfg.bank?.income_ignore),
    },
    cards: {
      expense: compile(cfg.cards?.expense_ignore),
      income: compile(cfg.cards?.income_ignore),
    },
  };
  return compiled!;
}

export type Txn = {
  source: string;                // "bank" | "amex" | "mc"
  postedDate: string;            // YYYY-MM-DD
  amount: number;                // >0 expense, <0 income (our sign convention)
  merchantRaw?: string;
  descriptionRaw?: string;
  _meta?: Record<string, any>;
};

export function shouldSuppressBank(t: Txn): "expense" | "income" | null {
  const text = (t.merchantRaw || t.descriptionRaw || "").trim();
  const c = getCompiled().bank;
  if (t.amount > 0) {
    return c.expense.some(r => r.test(text)) ? "expense" : null;
  } else if (t.amount < 0) {
    return c.income.some(r => r.test(text)) ? "income" : null;
  }
  return null;
}
