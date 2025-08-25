// version: v0.1b1
// date: 2025-08-25 08:51 Europe/London
// changelog: slice: fix Amex 2024 date parsing
// v0.1a5 — filter out transfers/payments so they don't show up as income in card-only data.
import type { CanonicalTxn } from "./xlsx";

const PAYMENT_PATTERNS = [
  /\bpayment\b/i,
  /direct\s*debit/i,
  /thank\s*you/i,
  /auto\s*pay/i,
  /autopay/i,
  /statement\s*balance/i,
  /balance\s*payment/i,
  /bill\s*pay/i,
  /transfer/i,
  /repayment/i,
  /payment\s*received/i,
  /credit\s*card\s*repayment/i,
];

function looksLikePayment(desc?: string): boolean {
  if (!desc) return false;
  const d = desc.trim();
  return PAYMENT_PATTERNS.some((rx) => rx.test(d));
}

export function filterTransactions(txns: CanonicalTxn[]): CanonicalTxn[] {
  return txns.filter((t) => {
    // Drop obvious card payments/transfers (almost always negative amounts)
    if (t.amount < 0 && looksLikePayment(t.merchantRaw || t.descriptionRaw)) {
      return false;
    }
    return true;
  });
}
