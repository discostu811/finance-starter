# NOTES — Finance ETL MVP

## Current Scope
- Goal: robust ETL + reconciliation pipeline for personal finance data.
- Sources: Amex, MC, Amazon detail, Bank exports, plus ground truth in `Detail`.
- Destination: locked, auditable yearly accounts.

---

## Roadmap (updated)
- **v0.1 – Credit card ingestion & Amazon overlay**
  - Amex + MC parsers (2024 baseline).
  - Amazon detail linkage: match to parent card lines, suppress parents.
  - Reconcile against `Detail` (cards portion only).

- **v0.2 – Bank ingestion**
  - Add bank account adapters (CSV/Excel/OFX).
  - Handle debit card transactions, wires, direct debits.
  - Merge into unified transaction table.
  - Reconcile against `Detail` (full household coverage).

- **v0.3 – Multi-year + freeze**
  - Generalize parsers to handle historical formats.
  - Lock confirmed years (“freeze”).

- **v0.4 – Categorization**
  - Manual tagging UI.
  - Predictive model trained on tagged history.

- **v0.5 – Web app polish**
  - File upload UI.
  - Reconciliation dashboard.
  - Category drilldowns.

---

## Iteration Process
- Each version delivered as a tagged commit (`v0.1a4`, `v0.1b2`, etc.).
- Delivery format: full zip or patch zip with `PATCHLIST.txt`.
- Always includes:
  - updated `CHANGES.md`
  - scripts to run
  - expected green/red outcomes

---

## Verification Policy (Option A — Git is Source of Truth)
- **Git is canonical**: every patch committed + tagged.
- **Manifest verification**: `scripts/fingerprint.ts` → `MANIFEST.json` with SHA256 checksums.
- **Mismatch handling**: roll back with Git, not by regeneration.
- **Commit convention**: Conventional Commits, prefixed with version when relevant.
- **Tags**: Always `git tag vX && git push --tags`.

---

## Commit Message Examples
- `feat(v0.2a1): add parser for HSBC CSV bank export`
- `fix(v0.1b4): fallback to category-sum when Total expenses missing`
- `chore: update NOTES.md with new roadmap`
