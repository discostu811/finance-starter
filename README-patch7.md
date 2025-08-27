# v0.1b3-patch7

This patch **removes the HTML report generator** and related assets so we only use Markdown + CSV outputs going forward.

## What this patch includes
- `scripts/cleanup-html.sh` — removes:
  - `lib/compare/htmlReport.ts`
  - `out/report.css`
  - any stale `out/*.html` files

## How to apply

```bash
# from your repo root
unzip -o /workspaces/finance-starter/finance-v0.1b3-patch7.zip

# run the cleanup to delete HTML generator files
bash scripts/cleanup-html.sh

# then run reconciliation in Markdown
npm run recon:2024 -- --xlsx data/Savings.xlsx --out out/recon-2024.md
# Expected logs (shape):
# [info] loading workbook: data/Savings.xlsx
# [info] detail months loaded: 12
# [info] computed months: 12
# [info] delta rows: 12
# [ok] wrote CSVs: out/{computed-2024.csv, detail-2024.csv, delta-2024.csv}
# [ok] wrote out/recon-2024.md
```
