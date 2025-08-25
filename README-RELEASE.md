Finance Release Toolkit — v1.2.2 (JS-only)

This toolkit replaces the TypeScript runtime requirement (ts-node) with pure JS modules (*.mjs),
compatible with Node >= 18 (tested on Node 22).

Files
- scripts/fingerprint.mjs
- scripts/update-headers.mjs
- scripts/release.mjs
- README-RELEASE.md
- scripts/package.json.merge.json (JS-only scripts)

Install
1) Unzip at repo root.
2) Merge scripts/package.json.merge.json into your package.json.
3) Ensure 'zip' CLI is available (Linux/macOS). On Windows use PowerShell Compress-Archive or install zip.

Usage
- Dry run:
  npm run release -- --version v0.1b1 --changelog "bootstrap release automation" --dry-run
- Real:
  npm run release -- --version v0.1b1 --changelog "slice: fix X"
- Push:
  npm run release -- --version v0.1b1 --changelog "slice: fix X" --push

