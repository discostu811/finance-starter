# Patch 9 — Comparator export mismatch fix (Markdown + CSV recon)

**What changed**
- Added `lib/compare/compatComparator.ts` which normalizes `lib/comparator` exports.
  - Works whether `lib/comparator` uses a named export `{ buildComparison }` or a default export.
- Updated `scripts/recon/rollup-2024.ts` to import the shim.
- Keeps Markdown + CSV reporting via `lib/compare/mdReport.ts` (from patch8).

**Apply**
```bash
# from repo root
unzip -o /workspaces/finance-starter/finance-v0.1b3-patch9.zip

# run
npm run recon:2024 -- --xlsx data/Savings.xlsx --out out/recon-2024.md
```

**Expected logs**
```
[info] loading workbook: data/Savings.xlsx
[info] detail months loaded: 12
[info] computed months: 12
[ok] wrote CSVs: out/computed-2024.csv, out/detail-2024.csv, out/delta-2024.csv
[ok] wrote out/recon-2024.md
```
