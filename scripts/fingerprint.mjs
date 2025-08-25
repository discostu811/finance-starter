// version: v0.1b1
// date: 2025-08-25 08:50 Europe/London
// changelog: slice: fix Amex 2024 date parsing

import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_INCLUDE = [
  'lib',
  'scripts',
  'data',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'CHANGES.md'
];

const DEFAULT_EXCLUDE = new Set([
  '.git',
  'node_modules',
  '.DS_Store',
  '.idea',
  '.vscode',
  'dist',
  'build',
  'coverage'
]);

const normalize = (p) => p.split(path.sep).join('/');

async function isDir(p) {
  try {
    const st = await fs.stat(p);
    return st.isDirectory();
  } catch { return false; }
}

async function walk(dir, base, exclude, files) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const rel = normalize(path.relative(base, path.join(dir, e.name)));
    const name = e.name;
    if (exclude.has(name) || exclude.has(rel)) continue;
    if (e.isDirectory()) await walk(path.join(dir, name), base, exclude, files);
    else if (e.isFile()) files.push(rel);
  }
}

async function hashFile(fp) {
  const buf = await fs.readFile(fp);
  const h = createHash('sha256').update(buf).digest('hex');
  return { sha256: h, bytes: buf.byteLength };
}

async function main() {
  const includeArtifacts = process.argv.includes('--include-artifacts');
  const includeArgs = process.argv
    .filter(a => a.startsWith('--include='))
    .flatMap(a => a.replace('--include=', '').split(','))
    .filter(Boolean);

  const include = includeArgs.length ? includeArgs : [...DEFAULT_INCLUDE];
  const candidates = [];
  const exclude = new Set(DEFAULT_EXCLUDE);

  const root = process.cwd();
  for (const i of include) {
    const p = path.join(root, i);
    if (await isDir(p)) await walk(p, root, exclude, candidates);
    else candidates.push(normalize(i));
  }

  if (includeArtifacts) {
    const entries = await fs.readdir(root);
    for (const e of entries) if (/^finance-.*\.zip$/.test(e)) candidates.push(e);
  }

  const uniq = [...new Set(candidates)].filter(p => !p.endsWith('~')).sort();

  const out = [];
  for (const rel of uniq) {
    try {
      const full = path.join(root, rel);
      const { sha256, bytes } = await hashFile(full);
      out.push({ path: rel, sha256, bytes });
      console.log(`[diag] hashed ${rel} (${bytes} bytes)`);
    } catch (err) {
      console.warn(`[warn] skipping ${rel}: ${err.message}`);
    }
  }

  const manifest = {
    generated_at: new Date().toISOString(),
    entries: out,
    total_files: out.length,
    total_bytes: out.reduce((a, e) => a + e.bytes, 0)
  };

  await fs.writeFile('MANIFEST.json', JSON.stringify(manifest, null, 2) + '\n');
  console.log(`[diag] wrote MANIFEST.json with ${out.length} entries`);
}

main().catch(err => { console.error(err); process.exit(1); });
