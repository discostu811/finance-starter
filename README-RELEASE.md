Finance Release Toolkit — v1.3.0 (JS-only, optional GitHub Release upload)

What’s new
- Optional GitHub Release creation/upload via GitHub CLI (`gh`) with `--gh-release` flag.
- Still zip-only workflow; no inline file diffs.

Files
- scripts/fingerprint.mjs
- scripts/update-headers.mjs
- scripts/release.mjs
- scripts/package.json.merge.json
- README-RELEASE.md

Install
1) Unzip into your repo root.
2) Merge scripts/package.json.merge.json into package.json (adds scripts to run .mjs).
3) (Optional) Install GitHub CLI and authenticate: gh auth login
4) Ensure zip CLI exists: zip -v

Usage
- Dry run:
  npm run release -- --version v0.1b1 --changelog "slice: fix X" --dry-run
- Real release (no push):
  npm run release -- --version v0.1b1 --changelog "slice: fix X"
- Release + push:
  npm run release -- --version v0.1b1 --changelog "slice: fix X" --push
- Release + push + GitHub Release upload (requires gh configured):
  npm run release -- --version v0.1b1 --changelog "slice: fix X" --push --gh-release
  # optionally specify repo (owner/repo) if origin is not GitHub:
  npm run release -- --version v0.1b1 --changelog "slice: fix X" --push --gh-release --repo YOURORG/YOURREPO

Notes
- If gh is not installed or not logged in, the script will skip release upload with a warning.
- The same finance-vX.Y.Z.zip should also be uploaded to ChatGPT project space (separate from GitHub).
