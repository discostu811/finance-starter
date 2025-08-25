# Changes — finance-v0.1b (probe)
- Add **Amazon matching probe** (no ETL changes yet):
  - `lib/amazon.ts` with detection and matching helpers.
  - `scripts/amazon-match-report.ts` to report counts, sums, sample matched/unmatched, and a suppression preview.
- Matching rule: exact amount (to pennies) and date within **±5 days**.
- Restricts Amazon detail extraction to sheets whose names include the **year** (e.g., `Amazon 2024`).

Run:
```
npx tsx scripts/amazon-match-report.ts ./data/Savings.xlsx 2024
```
## v0.1b1 — 2025-08-25T08:51:33.522Z
- slice: fix Amex 2024 date parsing

## v0.1b1 — 2025-08-25T09:10:36.322Z
- slice: fix Amex 2024 date parsing

