# finance-v0.1b3-patch15

Fix: use ESM build of `xlsx` to avoid `XLSX.readFile is not a function` in Codespaces / tsx.

Changes:
- `scripts/recon/rollup-2024.ts`: switch `import * as XLSX from "xlsx"` to the ESM module `xlsx/xlsx.mjs` and enable Node FS via `XLSX.set_fs(fs)`.

How to apply:
```bash
unzip -o /workspaces/finance-starter/finance-v0.1b3-patch15.zip
npm run recon:2024 -- --xlsx data/Savings.xlsx --out out/recon-2024.md
```
