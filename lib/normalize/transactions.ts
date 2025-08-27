// version: finance-v0.1b1
// date: 2025-08-25 09:17 Europe/London
// changelog: hook Amex date parser into normalize pipeline (non-breaking)

import { parseAmexDateToISO } from "../parsers/amex";

export function normalizeCardDate(source: string, raw: unknown): string | null {
  if (source.toLowerCase().includes("amex")) {
    return parseAmexDateToISO(raw);
  }
  // Other sources use existing logic (placeholder; integrate with your current normalize if present)
  if (raw == null) return null;
  const s = String(raw).trim();
  const m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
  return null;
}
