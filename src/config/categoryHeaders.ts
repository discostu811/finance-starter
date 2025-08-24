export const BANK_CATEGORY_HEADER = 'Category' as const;
export const CARD_CATEGORY_HEADER = 'Categorie' as const;

// helper to safely pick our category field from a row
export function pickBankCategory(row: Record<string, any>): string {
  return String((row as any)[BANK_CATEGORY_HEADER] ?? '').trim();
}
export function pickCardCategory(row: Record<string, any>): string {
  // prefer our manual 'Categorie'; fall back to raw provider 'Category'
  const v = (row as any)[CARD_CATEGORY_HEADER] ?? (row as any)['Category'] ?? '';
  return String(v).trim();
}
