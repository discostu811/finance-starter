finance-v0.1b1-patch1
- Updated scripts/inspect-amex.mjs to import TypeScript parser with explicit .ts extension.
- Run inspector with:
  node --loader ts-node/esm scripts/inspect-amex.mjs data/amex/2024/*.xlsx
