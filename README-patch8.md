README — patch8 (Markdown-only reporting)

What this patch does
--------------------
- Removes any dependency on the old HTML report generator.
- Adds a Markdown + CSV report path so you can open artifacts directly in Codespaces.
- Keeps your existing comparator/build logic intact.

Files added/updated
- scripts/recon/rollup-2024.ts     (rewritten to emit Markdown + CSV)
- lib/compare/mdReport.ts          (new: renders Markdown and CSV)

How to apply
------------
unzip -o /workspaces/finance-starter/finance-v0.1b3-patch8.zip

# generate Markdown report + CSVs
npm run recon:2024 -- --xlsx data/Savings.xlsx --out out/recon-2024.md

Expected logs
-------------
[info] loading workbook: data/Savings.xlsx
[info] detail months loaded: 12
[info] computed months: 12
[ok] wrote CSVs: out/computed-2024.csv, out/detail-2024.csv, out/delta-2024.csv
[ok] wrote out/recon-2024.md
