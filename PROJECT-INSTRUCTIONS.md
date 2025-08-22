# 📌 Project Instructions — Finance ETL MVP

**Context**  
- Build an **ETL + reconciliation** pipeline for messy `.xlsx` exports (Amex, MC, Amazon, Detail).  
- Goal: robust web app to ingest, dedupe, reconcile, categorize, and produce locked, auditable yearly accounts.  
- Work iteratively via versioned zips; test in Codespaces; deploy later on Vercel.

---

## 🔹 How I want ChatGPT to behave

1) **Consistency & Clarity**  
- Generate **complete files** (no partials).  
- Preserve folder structure (`lib/`, `scripts/`, `data/`).  
- Always include **README**, **CHANGES.md**, **PATCHLIST.txt**, and **MANIFEST.json** in full releases.  
- Provide numbered **step-by-step** run instructions.

2) **Efficiency**  
- Propose the **smallest next slice**; avoid overbuilding.  
- Include exact run commands and what to inspect in the output.

3) **Quality & Robustness**  
- Assume heterogeneous headers, date formats, Debit/Credit.  
- Include diagnostics and log clear errors.  
- Treat the **Detail** tab as ground truth.

4) **Iteration Process**  
- Versioned zips with a short changelog.  
- Each slice states its **goal**, **files**, **how to run**, and **expected green/red** outcomes.  
- Only advance when reconciliation is confirmed.

5) **Communication Style**  
- Concise, structured, with headings and code blocks.  
- Call out pitfalls (Node version, double counting).  
- If a sheet schema is unclear, ask to run the inspector and paste headers.

6) **Commit Message Convention (lightweight Conventional Commits)**  
- Format: `<type>: <short description>`  
- Types: `feat`, `fix`, `docs`, `chore`  
- Prefer prefixing version: `feat(v0.1b): add Amazon adapter`  
- Keep under ~72 chars.

---

## 🔹 Naming Convention for Bundles

`finance-v<version><slice>-<label>.zip`  
Examples:  
- `finance-v0.1a-harness.zip`  
- `finance-v0.1a3-harness.zip`  
- `finance-v0.1b-amazon.zip`

---

## 🔹 Release Protocol (Zip-based workflow)

- **Baseline**: User uploads the **latest full zip** (preferred) or its `MANIFEST.json`.  
- **Assistant MUST patch only changed files** against that baseline (no wholesale regeneration).  
- Each release ships **two zips**:  
  - **Full** → everything (for convenience). Must include: `README.md`, `CHANGES.md`, `PATCHLIST.txt`, `MANIFEST.json`.  
  - **Delta** → only changed files + `PATCHLIST.txt` + `CHANGES.md`.  
- All bundles include `MANIFEST.json` (file hashes) for verification.  
- `CHANGES.md` explains *what changed* and *how to upgrade from previous*.  
- `PATCHLIST.txt` lists changed file paths relative to repo root.

---

## 🔹 Version Roadmap

**v0.1 — Baseline ingestion & reconciliation**  
- Parse Amex + MC (2024), monthly rollup, compare to Detail (2024).  
- Expect red on Amazon-heavy months.

**v0.2 — Amazon detail linkage**  
- Parse Amazon tabs, link children to parent card lines, avoid double counting, use children for categorization.  
- Expect Amazon months to turn green.

**v0.3 — Multi-year + Freeze**  
- Generalize parsers to more years; implement “freeze” for confirmed years; import-only-new each month.

**v0.4 — Categorization**  
- Manual categorization UI and predictive suggestions; audit log.

**v0.5 — Web app polish**  
- Next.js app, upload UI, dashboards, drilldowns, Vercel deploy.
