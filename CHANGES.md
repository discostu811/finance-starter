# Changes — finance-v0.1a4-patch4

## What changed
- **Very-smart Amex reheader:** scans first 500 rows; requires date+description+amount tokens; skips blank lines after header before data.
- Keeps preference for `CONVERTED £` and Excel-serial date conversion.

## How to apply
1. Unzip at repo root (overwrites `lib/xlsx.ts`).
2. Commit and run:
   ```bash
   nvm use 20
   npm install
   npx tsx scripts/debug-parse.ts ./data/Savings.xlsx
   npx tsx scripts/etl-compare-2024.ts ./data/Savings.xlsx
   ```

## Commit suggestion
fix(v0.1a4): very-smart Amex reheader (scan 500 rows; robust tokens)
