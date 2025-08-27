## v0.1b4-patch7 — 2025-08-27
Goal: Make `npm run recon:2024` succeed in a clean Codespaces without edits. Emit Markdown + CSVs from the `Detail` sheet only.
Scope:
- Replace placeholder code in `lib/compare/mdReport.ts` with working CSV/Markdown emitters.
- Implement robust `scripts/recon/rollup-2024.ts` that reads `data/Savings.xlsx` (`Detail` sheet) and outputs `out/recon-2024.md` plus `computed-2024.csv`, `detail-2024.csv`, `delta-2024.csv`.
- Add CANARY headers to changed files.
Risk: Low. Script is self-contained and does not touch parsers or comparators.
