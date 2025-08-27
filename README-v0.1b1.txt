finance-v0.1b1
2025-08-25 09:17 Europe/London

This patch adds robust Amex 2024 date parsing and an inspector:

- lib/parsers/amex.ts
  * parseAmexDateToISO: handles Excel serials, UK D/M/Y, US M/D/Y, Y-M-D, and D-MMM-YY.
  * Emits ISO YYYY-MM-DD, timezone-agnostic (constructs in UTC to avoid drift).

- lib/normalize/transactions.ts
  * normalizeCardDate: routes Amex sources through the new parser.

- scripts/inspect-amex.mjs
  * Inspect Amex .xlsx files and print sample date parsing diagnostics.

Integrate:
1) Place files in your repo at the given paths.
2) Build v0.1b1 release via your release script.
3) Run inspector:
   node scripts/inspect-amex.mjs data/amex/2024/YourAmexExport.xlsx
