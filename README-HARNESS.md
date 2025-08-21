# Finance ETL Harness v0.1a (Headless)

This is a minimal, headless harness that reads your `Savings.xlsx`, parses **“2024 amex”** and **“2024 mc”** tabs,
aggregates monthly totals, and compares them to your **“Detail”** sheet for 2024. It prints a reconciliation
table in the terminal so we can see immediate gaps before adding Amazon linkage.

## Files
- `lib/types.ts` — shared types
- `lib/xlsx.ts` — workbook loading and parsing for Amex/MC + Detail truth
- `lib/rollup.ts` — monthly aggregation logic
- `lib/comparator.ts` — compare our rollup vs Detail and print a table
- `scripts/etl-compare-2024.ts` — the runner script
- `data/` — put your `Savings.xlsx` here when running locally (optional if you pass a path)

## Install (inside your Next.js repo or any Node project)
1) Copy these files into your repo, preserving paths.
2) Add to your `package.json` (merge keys, don't overwrite unrelated fields):

```jsonc
{
  "dependencies": {
    "xlsx": "^0.18.5",
    "dayjs": "^1.11.11"
  },
  "devDependencies": {
    "tsx": "^4.16.2"
  },
  "scripts": {
    "compare:2024": "tsx scripts/etl-compare-2024.ts ./data/Savings.xlsx"
  }
}
```

3) Install deps:
```bash
npm install
```

## Run
1) Place your `Savings.xlsx` at `./data/Savings.xlsx` (or pass a path).
2) Run:
```bash
npm run compare:2024
# or: npx tsx scripts/etl-compare-2024.ts /absolute/path/to/Savings.xlsx
```

You should see a reconciliation table for 2024. Expect expense mismatches in Amazon-heavy months
until we add the Amazon parent/child linker in v0.1b.

If the script can't find your sheet names or columns, tell me the exact sheet names and headers it printed
and I'll refine the detectors.
