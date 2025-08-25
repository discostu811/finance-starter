// version: v0.1b1
// date: 2025-08-25 09:10 Europe/London
// changelog: slice: fix Amex 2024 date parsing

import fs from "node:fs/promises";
import path from "node:path";

const FILE_GLOOS = ["lib", "scripts"];
const EXT_ALLOW = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

function nowLondon() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())} Europe/London`;
}

function headerBlock(version, changelog) {
  return `// version: ${version}\n// date: ${nowLondon()}\n// changelog: ${changelog}\n`;
}

async function walk(dir, acc) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await walk(p, acc);
    else if (e.isFile() && EXT_ALLOW.has(path.extname(p))) acc.push(p);
  }
}

async function processFile(fp, version, changelog) {
  const src = await fs.readFile(fp, "utf8");
  const lines = src.split(/\r?\n/);
  const head = headerBlock(version, changelog).trimEnd();

  const headerStart =
    lines[0]?.startsWith("// version:") ? 0 :
    lines[1]?.startsWith("// version:") ? 1 :
    -1;

  let out;
  if (headerStart >= 0) {
    const before = lines.slice(0, headerStart);
    const after = lines.slice(headerStart + 3);
    out = [...before, head, ...after].join("\n");
  } else {
    out = head + "\n" + src;
  }

  if (out !== src) {
    await fs.writeFile(fp, out, "utf8");
    console.log(`[diag] updated header: ${fp}`);
  }
}

async function main() {
  const version = process.env.REL_VERSION;
  const changelog = process.env.REL_CHANGELOG || "release update";
  if (!version) throw new Error("REL_VERSION env required");

  const files = [];
  for (const g of FILE_GLOOS) {
    try {
      const st = await fs.stat(g);
      if (st.isDirectory()) await walk(g, files);
      else files.push(g);
    } catch {}
  }

  for (const f of files) await processFile(f, version, changelog);
}

main().catch((err) => { console.error(err); process.exit(1); });
