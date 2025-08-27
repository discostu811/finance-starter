#!/usr/bin/env bash
set -euo pipefail

echo "[info] removing HTML generator and assets (idempotent)"
rm -f lib/compare/htmlReport.ts || true
rm -f out/report.css || true

# remove any previously generated HTML reports
find out -maxdepth 1 -type f -name "*.html" -print -exec rm -f {} \; || true

echo "[ok] HTML reporting removed. Use Markdown + CSV outputs."
