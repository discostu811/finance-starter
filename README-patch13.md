# finance-v0.1b3-patch13

**Purpose:** Make the recon script robust to different exports from `lib/comparator.ts`.
Your repo currently exports `compareToTruth` (and `printVarianceTable`). Prior patches
looked for `buildComparison` (or default), which caused failures.

This adapter resolves a builder function in this priority order:
1. `compareToTruth`
2. `buildComparison`
3. `default`
4. `compare2024`
5. `runComparison`
6. `compare`

It then re-exports:
- `getBuildComparison()`
- `buildComparison`
- `default` (alias of `buildComparison`)

So scripts that import any of those will work.

## Files
- `lib/compare/compatComparator.ts`

## Install
From repo root:
```bash
unzip -o /workspaces/finance-starter/finance-v0.1b3-patch13.zip
```

## Run
```bash
npm run recon:2024 -- --xlsx data/Savings.xlsx --out out/recon-2024.md
```

Expected logs (shape):
```
[info] loading workbook: data/Savings.xlsx
[info] detail months loaded: 12
[info] computed months: 12
[info] delta rows: 12
[ok] wrote CSVs: out/{computed-2024.csv,detail-2024.csv,delta-2024.csv}
[ok] wrote out/recon-2024.md
```
