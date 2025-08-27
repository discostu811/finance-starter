# finance-v0.1b3-patch11

**Goal:** stop the patch-loop by making the recon script resilient to export/name differences and by outputting Markdown + CSVs you can open directly in Codespaces.

## What this patch changes

- `scripts/recon/rollup-2024.ts`: uses a *compat* layer and **does not import** any HTML report code.
- `lib/compare/compatComparator.ts`: reflection-based shim that tries very hard to find and call your existing comparison function; if none are export-compatible, it falls back to a generic builder that attempts to read the workbook using any available helpers (`lib/rollup`, `lib/detail`) and finally, as a last resort, emits a clear error message.
- `lib/compare/mdReport.ts`: emits a Markdown table and three CSVs: `computed-2024.csv`, `detail-2024.csv`, `delta-2024.csv`.

## How to apply

```bash
# from repo root
unzip -o /workspaces/finance-starter/finance-v0.1b3-patch11.zip

# run the recon and emit Markdown + CSVs
npm run recon:2024 -- --xlsx data/Savings.xlsx --out out/recon-2024.md
```

Expected log shape:
```
[info] loading workbook: data/Savings.xlsx
[info] detail months loaded: 12
[info] computed months: 12
[info] delta rows: 12
[ok] wrote CSVs: out/{computed-2024.csv, detail-2024.csv, delta-2024.csv}
[ok] wrote out/recon-2024.md
```
