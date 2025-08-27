# finance-v0.1b4-patch2

**Goal:** Stop the XLSX errors and produce a Markdown report + CSVs that render inside Codespaces without requiring the HTML server. This patch:
- Rewrites `scripts/recon/rollup-2024.ts` to auto-detect the Detail sheet and read it via `lib/xlsx.loadWorkbook` (no `XLSX.readFile`).
- Exports `makeDelta` from `lib/compare/mdReport.ts` and makes CSV/Markdown writers robust.
- Keeps a compatibility `lib/compare/compatComparator.ts` that avoids `XLSX.readFile` entirely.

## How to apply

From the repo root:

```bash
unzip -o /workspaces/finance-starter/finance-v0.1b4-patch2.zip

# then run
npm ci
npm run recon:2024 -- --xlsx data/Savings.xlsx --out out/recon-2024.md
```

## Expected logs (shape)

```
[info] loading workbook: data/Savings.xlsx
[info] detail months loaded: 12
[info] computed months: 12
[info] delta rows: 12
[ok] wrote CSVs: out/{computed-2024.csv, detail-2024.csv, delta-2024.csv}
[ok] wrote out/recon-2024.md
```
