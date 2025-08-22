# Changes — finance-v0.1a4-patch2

## What changed
- **Amex header fix:** Detects headerless exports and promotes the first data row to headers.
- **Sign heuristic:** For single `Amount` sheets, detects if positive or negative represents expenses (Amex vs MC) and normalizes to **expenses positive**.
- **Detail parser:** Handles unnamed Year/Month columns by **position** and computes income as the sum of `*salary` columns (abs), expenses from `Total expenses` (if present) or sum of positive non-salary columns.

## How to apply
1. Unzip this at repo root, overwriting files.
2. Run:
   ```bash
   npm run inspect:2024
   npm run compare:2024
   ```

## Expected
- `inspect:2024` stays the same (already working).
- `compare:2024` should now produce **sensible totals** for both Amex and MC vs Detail; 
  Amazon-heavy months may still show diffs until v0.1b Amazon linkage.

## Commit suggestion
fix(v0.1a4): handle Amex headerless export + amount polarity; improve Detail parser
