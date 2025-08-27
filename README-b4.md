
# finance-v0.1b4

**What changed (stabilization pass):**
- Standardized comparator entrypoint via `lib/compare/compatComparator.ts`, removing ambiguity about exports.
- Fixed `lib/etl/loaders.ts` bug (`False` -> `false`) causing runtime reference errors.
- Replaced HTML report path with Markdown + CSV output only.
- Implemented `lib/compare/mdReport.ts` with `writeMarkdownReport` and `writeCSVs` exports.
- Updated `scripts/recon/rollup-2024.ts` to use XLSX correctly and the compat comparator.
- Ensured `npm run recon:2024` works out-of-the-box; outputs to `out/recon-2024.md` and CSVs.
- Added `xlsx` dependency if missing.

**Run:**
```
npm install
npm run recon:2024 -- --xlsx data/Savings.xlsx --out out/recon-2024.md
```

**Outputs:**
- `out/recon-2024.md`
- `out/computed-2024.csv`
- `out/detail-2024.csv`
- `out/delta-2024.csv`
