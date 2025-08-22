# Changes — finance-v0.1a4-patch1

## What changed
- Fixed `loadWorkbook` in `lib/xlsx.ts` to use Node FS + `XLSX.read` buffer mode (ESM safe).
- Added explicit `import { readFileSync } from 'node:fs'`.

## How to upgrade from v0.1a4
1. Unzip this patch at repo root.
2. Overwrite `lib/xlsx.ts` with the patched version.
3. Run:
   ```bash
   npm run inspect:2024
   npm run compare:2024
   ```

## Expected
- `inspect:2024` now prints headers instead of crashing.
- `compare:2024` runs (still red diffs on Amazon-heavy months until v0.1b).

## Commit suggestion
fix(v0.1a4): patch loadWorkbook for ESM XLSX support
