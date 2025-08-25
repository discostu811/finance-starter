// version: finance-v1.2.1
// date: 2025-08-25 08:24 Europe/London
// changelog: deterministic repo-wide SHA256 manifest generator (zip-only workflow)

import { createHash } from "crypto";
import { promises as fs } from "fs";
import * as path from "path";

type Entry = { path: string; sha256: string; bytes: number };

const DEFAULT_INCLUDE = [
  "lib",
  "scripts",
  "data",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "CHANGES.md"
];

const DEFAULT_EXCLUDE = [
  ".git",
  "node_modules",
  ".DS_Store",
  ".idea",
  ".vscode",
  "dist",
  "build",
  "coverage"
];

function normalize(p: string) {
  return p.split(path.sep).join("/");
}

async function isDir(p: string) {
  try {
    const st = await fs.stat(p);
    return st.isDirectory();
  } catch {
    return false;
  }
}

async function walk(dir: string, base: string, exclude: Set<string>, files: string[]) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const rel = normalize(path.relative(base, path.join(dir, e.name)));
    const name = e.name;

    if (exclude.has(name) || exclude.has(rel)) continue;

    if (e.isDirectory()) {
      await walk(path.join(dir, name), base, exclude, files);
    } else if (e.isFile()) {
      files.push(rel);
    }
  }
}

async function hashFile(fp: string): Promise<{ sha256: string; bytes: number }> {
  const buf = await fs.readFile(fp);
  const h = createHash("sha256").update(buf).digest("hex");
  return { sha256: h, bytes: buf.byteLength };
}

async function main() {
  const root = process.cwd();

  const includeArtifacts = process.argv.includes("--include-artifacts");
  const includeArgs = process.argv
    .filter(a => a.startsWith("--include="))
    .flatMap(a => a.replace("--include=", "").split(","))
    .filter(Boolean);

  const include = includeArgs.length ? includeArgs : DEFAULT_INCLUDE.slice();
  const exclude = new Set(DEFAULT_EXCLUDE);

  const candidates: string[] = [];
  for (const i of include) {
    const p = path.join(root, i);
    if (await isDir(p)) {
      await walk(p, root, exclude, candidates);
    } else {
      candidates.push(normalize(i));
    }
  }

  if (includeArtifacts) {
    const entries = await fs.readdir(root);
    for (const e of entries) {
      if (/^finance-.*\.zip$/.test(e)) candidates.push(e);
    }
  }

  const uniq = Array.from(new Set(candidates))
    .filter(p => !p.endsWith("~"))
    .sort((a, b) => a.localeCompare(b));

  const out: Entry[] = [];
  for (const rel of uniq) {
    try {
      const full = path.join(root, rel);
      const { sha256, bytes } = await hashFile(full);
      out.push({ path: rel, sha256, bytes });
      console.log(`[diag] hashed ${rel} (${bytes} bytes)`);
    } catch (err) {
      console.warn(`[warn] skipping ${rel}: ${(err as Error).message}`);
    }
  }

  const manifest = {
    generated_at: new Date().toISOString(),
    entries: out,
    total_files: out.length,
    total_bytes: out.reduce((a, e) => a + e.bytes, 0)
  };

  await fs.writeFile("MANIFEST.json", JSON.stringify(manifest, null, 2) + "\n");
  console.log(`[diag] wrote MANIFEST.json with ${out.length} entries`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
