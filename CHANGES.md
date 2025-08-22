# Changes — finance-v0.1a3-harness

## What changed
- Established baseline ingestion & reconciliation harness for 2024 Amex + MC.
- Added diagnostics via `inspect-headers.ts`.
- Added `PROJECT-NOTES.md` and `.nvmrc` (Node 20 lock).
- Added `README.md` and `PACKAGE.json.additions.txt`.

## Files included (high level)
- `lib/` — types, xlsx parser, rollup, comparator
- `scripts/` — etl-compare-2024, inspect-headers
- `PROJECT-NOTES.md`, `PROJECT-INSTRUCTIONS.md`
- `README.md`, `.nvmrc`, `PACKAGE.json.additions.txt`

## How to upgrade from previous
1. Unzip bundle at repo root.
2. `nvm install 20 && nvm use 20`
3. `npm install`
4. Put `Savings.xlsx` into `./data` (or pass absolute path).
5. `npm run inspect:2024` → paste headers into Notes.
6. `npm run compare:2024`.

## Commit suggestion
feat(v0.1a3): baseline ingestion harness + diagnostics + meta
