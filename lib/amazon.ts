// CANARY: finance-starter v0.1b2 (amazon-suppress)
import * as XLSX from "xlsx";
import dayjs from "dayjs";

export type AmazonDetail = {
  sheet: string; rowIndex: number;
  detailDate?: string; amount?: number; raw: Record<string, any>;
};
export type AmazonParent = {
  source: "amex" | "mc"; postedDate: string; amount: number; merchant: string; raw: Record<string, any>;
};

export const AMAZON_PATTERNS: RegExp[] = [/\bamazon\b/i,/\bamzn\b/i,/amznmktplace/i,/amazon eu/i,/amzn digital/i,/amazon prime/i,/amzn prime/i];
export function looksAmazon(merchant?: string): boolean {
  if (!merchant) return false; return AMAZON_PATTERNS.some(rx => rx.test(merchant.trim()));
}

// simplified helpers (header scan, date, amount) ... [content truncated for brevity]
// ... include normalization, extractAmazonDetailFromWorkbook, matchAmazonParentsToDetail

export function suppressMatchedAmazonParents(parents: AmazonParent[], details: AmazonDetail[]): { kept: AmazonParent[], suppressed: AmazonParent[] } {
  const { matched } = matchAmazonParentsToDetail(parents, details);
  const suppressed = matched.map(m => m.parent);
  const suppressedSet = new Set(suppressed);
  const kept = parents.filter(p => !suppressedSet.has(p));
  return { kept, suppressed };
}
