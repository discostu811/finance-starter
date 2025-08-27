# v0.1b4 — Patch 1

This patch makes the 2024 reconciliation command robust and **stops the import/compat errors**:

- Adds a defensive comparator adapter: `lib/compare/compatComparator.ts`
  - Works with any of the prior `lib/comparator.ts`, `lib/rollup.ts`, and `lib/detail.ts` variants.
  - If project modules aren't callable, it falls back to reading the `Detail` sheet from the workbook.
- Simplifies the recon entrypoint: `scripts/recon/rollup-2024.ts`
  - Consumes the adapter and emits Markdown + CSVs.
- Re-implements `lib/compare/mdReport.ts` with stable `writeMarkdownReport` and `writeCSVs` APIs.

## How to apply

```bash
# from repo root
unzip -o /workspaces/finance-starter/finance-v0.1b4-patch1.zip

# run recon (Markdown + CSVs you can read in Codespaces)
npm run recon:2024 -- --xlsx data/Savings.xlsx --out out/recon-2024.md
```

Expected console output shape:

```
[info] loading workbook: data/Savings.xlsx
[info] computed months: 12, detail months: 12
[info] delta rows: 12
[ok] wrote CSVs: out/computed-2024.csv, out/detail-2024.csv, out/delta-2024.csv
[ok] wrote out/recon-2024.md
```

If your project’s internal `lib/rollup.ts` and `lib/detail.ts` APIs differ, the adapter tries multiple function names. If it still can’t call them, it falls back to workbook parsing so the report still generates.