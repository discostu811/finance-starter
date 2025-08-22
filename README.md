# Finance ETL MVP — v0.1a4 (Full bundle with manifest)

This bundle includes the **headless harness**, diagnostics, and meta docs so you can unzip → upload to GitHub → run in Codespaces.

## Contents
- `lib/types.ts` — shared types
- `lib/xlsx.ts` — robust workbook parsing (cards + Detail)
- `lib/rollup.ts` — monthly aggregation
- `lib/comparator.ts` — reconciliation comparator + printer
- `scripts/etl-compare-2024.ts` — run the comparison
- `scripts/inspect-headers.ts` — print headers + first 5 rows
- `PROJECT-INSTRUCTIONS.md` — zip-based release protocol
- `PROJECT-NOTES.md` — workflow ground rules + commit cheat sheet
- `CHANGES.md` — changelog for v0.1a3 baseline
- `PATCHLIST.txt` — files changed in this meta drop
- `.nvmrc` — lock Node to 20
- `PACKAGE.json.additions.txt` — copy into your package.json
- `MANIFEST.json` — SHA256 checksums for integrity
- `data/` — empty folder (place `Savings.xlsx` here if you like)

## Quick start (Codespaces)
```bash
# 0) Ensure Node 20
nvm install 20 && nvm use 20

# 1) Install deps
npm install

# 2) Put your workbook at ./data/Savings.xlsx (or pass an absolute path)

# 3) Inspect headers
npm run inspect:2024

# 4) Compare to Detail (2024)
npm run compare:2024
```

## Expected right now
- You may see **expense diffs** for Amazon-heavy months — that’s expected until v0.1b adds Amazon linkage.

## Troubleshooting
- **`tsx: not found`** → run `npm install` on Node 20.
- **No truth rows found** → run `npm run inspect:2024` and paste the Detail headers into `PROJECT-NOTES.md`; we’ll adjust the extractor.
- **0 rows for Amex/MC** → header names differ; parser supports `Amount` or `Debit/Credit`. Paste headers and we’ll extend matches.

## Commit convention (summary)
Use Conventional Commits (lightweight):
- `feat: ...` new feature
- `fix: ...` bug fix
- `docs: ...` docs/notes
- `chore: ...` plumbing

Examples:
```
feat(v0.1b): link Amazon detail rows to parent Amex txns
fix: normalize DD/MM/YYYY dates in MC 2024 sheet
docs: paste 2024 header samples into PROJECT-NOTES
chore: add .nvmrc with Node 20
```
