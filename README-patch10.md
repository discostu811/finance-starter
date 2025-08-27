
# finance-v0.1b3 — Patch 10

**What’s in here**
- Robust Markdown + CSV reporting (no HTML).
- Comparator shim that tolerates both `export default` and `export const buildComparison`.
- No other behaviour changes.

**Apply**
```bash
# from repo root
unzip -o /workspaces/finance-starter/finance-v0.1b3-patch10.zip

# run
npm run recon:2024 -- --xlsx data/Savings.xlsx --out out/recon-2024.md
```
You should see logs like:
```
[info] loading workbook: data/Savings.xlsx
[info] computed rows: 12
[info] detail rows: 12
[info] delta rows: 12
[ok] wrote CSVs: out/computed-2024.csv, out/detail-2024.csv, out/delta-2024.csv
[ok] wrote out/recon-2024.md
```
