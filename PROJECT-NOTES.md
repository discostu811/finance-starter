# 📓 Project Notes — Finance ETL MVP

## 🔹 Pinned Headers
_Paste output of `npm run inspect:2024` here for Amex, MC, Amazon, Detail._

## 🔹 Ground Truth Expectations
- Detail tab is the authority; reconciliation must match exactly once features are in place.

## 🔹 Known Issues / Format Quirks
- Amex can use Debit/Credit instead of Amount; mid-year format changes possible.
- Amazon children must not double-count with parent card rows.

## 🔹 TODO / Next Steps
- [ ] v0.1 — baseline ingestion & 2024 reconciliation
- [ ] v0.2 — Amazon linkage
- [ ] v0.3 — multi-year + freeze
- [ ] v0.4 — categorization
- [ ] v0.5 — web app polish

## 🔹 Debugging Checklist
1. Run `npm run inspect:2024` and paste headers here.
2. Confirm parser matched Amount or Debit/Credit.
3. Confirm Detail extractor found Year/Month/Income/Expenses columns.
4. Compare Σ(children) vs parent for Amazon months (from v0.2).

## 🔹 Workflow Ground Rules
- Always upload **last full zip** (or `MANIFEST.json`) before requesting a new release.  
- Every drop you receive back will include:  
  - `MANIFEST.json` (hashes)  
  - `CHANGES.md` (what changed + how to upgrade)  
  - `PATCHLIST.txt` (list of changed files)  
- Commit convention: `feat(vX.Yb): <summary>`, plus `fix|docs|chore` as needed.

## 🔹 Commit Cheat Sheet
Examples:
- `feat(v0.1b): link Amazon detail rows to parent Amex txns`
- `fix: normalize DD/MM/YYYY dates in MC 2024 sheet`
- `docs: paste 2024 header samples into PROJECT-NOTES`
- `chore: add .nvmrc with Node 20`
