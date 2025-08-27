# finance-v0.1b3-patch14

**Goal:** Stop the crash loop, remove flaky comparator coupling, and always emit a human-inspectable **Markdown** report plus **CSVs** from inside Codespaces.

## What changed
- New `scripts/recon/rollup-2024.ts` that **does not depend on `lib/comparator`**.
- New `lib/compare/mdReport.ts` that writes the Markdown + CSVs and computes the delta table.
- The script reads the **`Detail`** sheet in `Savings.xlsx` for 2024. For now, **Computed == Detail** (fallback) so Delta is zeros. This is intentional to unblock you; when the transaction parsers are stable we can plug them in to replace the `computed` table.

## How to apply
```bash
unzip -o /workspaces/finance-starter/finance-v0.1b3-patch14.zip

# Run (from repo root)
npm run recon:2024 -- --xlsx data/Savings.xlsx --out out/recon-2024.md
```

## Expected logs
```
[info] loading workbook: data/Savings.xlsx
[info] detail months loaded: 12
[info] computed months: 12
[info] delta rows: 12
[ok] wrote CSVs: out/computed-2024.csv, out/detail-2024.csv, out/delta-2024.csv
[ok] wrote out/recon-2024.md
```

Then open `out/recon-2024.md` in Codespaces. The three tables are inline. CSVs are next to it.

---
If you want me to wire the real transaction rollup back in, upload your **current** `lib/rollup.ts`, `lib/detail.ts`, and `lib/parse_cards.ts`, and I’ll produce a patch that computes a real `computed` table while keeping the same Markdown/CSV outputs.
