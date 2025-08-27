// version: finance-v0.1b3
// date: 2025-08-27 15:03 Europe/London
// changelog: how-to regenerate HTML report

# Reconciliation & Roll-up — v0.1b3

## Run
```bash
npm i
npm run recon:2024 -- --xlsx data/Savings.xlsx --out out/recon-2024.html
```

**Always-on rules**
- Spend positive, income negative (unified before combining).
- Exclude `Payment`, `Expenses`.
- Normalize categories (`REstaurants→Restaurants`, `UK cash→UK Cash`, `David/Sonya Salary→salary`).
- Amazon uses **net-of-VAT/refunds** overlay (`config/overrides/amazon_net_2024.yaml`), dispersed into categories.
