# finance-v0.1b3 — Patch 12

**Goal:** Make recon stable in Codespaces with Markdown + CSV outputs only.  
Removes HTML reporter dependency, adds a robust comparator shim, and avoids ESM import/export mismatches.

## What’s in this patch
- `scripts/recon/rollup-2024.ts` — CLI script to build the 2024 comparison and emit Markdown + CSVs.
- `lib/compare/compatComparator.ts` — dynamic shim that finds the correct comparison function from `lib/comparator` regardless of export style.
- `lib/compare/mdReport.ts` — minimal writer for Markdown report and CSVs (computed, detail, delta).

## Install
From your repo root:
```bash
unzip -o /workspaces/finance-starter/finance-v0.1b3-patch12.zip
```

> If you previously applied patches, it’s safe to overwrite.

## Usage
From repo root:
```bash
npm run recon:2024 -- --xlsx data/Savings.xlsx --out out/recon-2024.md
```

Expected logs (shape):
```
[info] loading workbook: data/Savings.xlsx
[info] detail months loaded: 12
[info] computed months: 12
[info] delta rows: 12
[ok] wrote CSVs: out/{computed-2024.csv, detail-2024.csv, delta-2024.csv}
[ok] wrote out/recon-2024.md
```

Open the files directly in Codespaces Explorer:
- `out/recon-2024.md`
- `out/computed-2024.csv`
- `out/detail-2024.csv`
- `out/delta-2024.csv`

## Notes
- The comparator shim tries multiple names: `buildComparison`, `default`, `compare2024`, `runComparison`, `compare`.
- If it can’t find one, it will print the available exports from `lib/comparator` to help adjust quickly.
- HTML reporting is intentionally not used here to avoid preview/server issues.
```

