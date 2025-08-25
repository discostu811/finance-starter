// version: v0.1b1
// date: 2025-08-25 09:10 Europe/London
// changelog: slice: fix Amex 2024 date parsing

import { execSync } from "node:child_process";
import { existsSync, writeFileSync, readFileSync } from "node:fs";

function sh(cmd) {
  console.log(`[sh] ${cmd}`);
  return execSync(cmd, { stdio: "inherit" });
}

function shOut(cmd) {
  return execSync(cmd, { stdio: ["ignore", "pipe", "pipe"] }).toString().trim();
}

function requireCleanGit() {
  const status = shOut("git status --porcelain");
  if (status) throw new Error("Git tree not clean. Commit or stash first.");
}

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (k, def) => {
    const i = args.findIndex(a => a === k || a.startsWith(k + "="));
    if (i < 0) return def;
    const a = args[i];
    if (a.includes("=")) return a.split("=")[1];
    return args[i + 1];
  };
  const version = get("--version");
  const changelog = get("--changelog", "release update");
  const include = (get("--include", "lib,scripts,data,package.json,package-lock.json,tsconfig.json,CHANGES.md") || "")
    .split(",").map(s => s.trim()).filter(Boolean);
  const push = args.includes("--push");
  const dry = args.includes("--dry-run");
  const ghRelease = args.includes("--gh-release");
  const repo = get("--repo");
  return { version, changelog, include, push, dry, ghRelease, repo };
}

function ensureZipCli() {
  try { shOut("zip -v"); } catch { throw new Error("System 'zip' CLI not found. Install 'zip'."); }
}

function appendChangesMd(version, changelog) {
  const now = new Date().toISOString();
  const entry = `## ${version} — ${now}\n- ${changelog}\n\n`;
  if (!existsSync("CHANGES.md")) writeFileSync("CHANGES.md", "# Changes\n\n");
  const prev = readFileSync("CHANGES.md", "utf8");
  writeFileSync("CHANGES.md", prev + entry, "utf8");
  console.log(`[diag] appended CHANGES.md entry for ${version}`);
}

function detectRepo() {
  try {
    const url = shOut("git config --get remote.origin.url");
    const m = url.match(/[:/]([^\/]+)\/([^\/]+?)(\.git)?$/);
    if (m) return `${m[1]}/${m[2]}`;
  } catch {}
  return null;
}

function maybeCreateGithubRelease(version, zipName, notes, repo, dry) {
  let ghOk = false;
  try { shOut("gh --version"); ghOk = true; } catch {}
  const targetRepo = repo || detectRepo();
  if (!targetRepo) {
    console.log("[warn] Could not detect repo for GitHub Release. Skip.");
    return;
  }
  if (dry) {
    console.log(`[diag] DRY-RUN: would run -> gh release create ${version} ${zipName} --notes "$${notes}" --title "${version}" -R ${targetRepo}`);
    return;
  }
  if (ghOk) {
    try {
      sh(`gh release create ${version} ${zipName} --notes "${notes.replace(/"/g, '\\"')}" --title "${version}" -R ${targetRepo}`);
      console.log("[ok] GitHub Release created via gh CLI.");
      return;
    } catch (e) {
      console.log("[warn] gh CLI failed, not fatal. Error:", e?.message || e);
    }
  } else {
    console.log("[warn] gh CLI not found. Skipping GitHub Release step.");
  }
}

async function main() {
  const { version, changelog, include, push, dry, ghRelease, repo } = parseArgs();
  if (!version) throw new Error("--version vX.Y.Z required");

  requireCleanGit();
  ensureZipCli();
  const existingTag = shOut("git tag --list " + version);
  if (existingTag === version) throw new Error(`Tag ${version} already exists`);

  // 1) Update headers
  sh(`REL_VERSION=${version} REL_CHANGELOG="${changelog.replace(/"/g, '\\"')}" node scripts/update-headers.mjs`);

  // 2) Fingerprint repo (code only)
  sh(`node scripts/fingerprint.mjs`);

  // 3) Build zip artifact
  const zipName = `finance-${version}.zip`;
  const inc = include.map(p => `\"${p}\"`).join(" ");
  sh(`zip -r ${zipName} ${inc}`);
  console.log(`[diag] built ${zipName}`);

  // 4) Commit and tag
  appendChangesMd(version, changelog);
  sh(`git add MANIFEST.json CHANGES.md ${zipName}`);
  sh(`git add lib scripts data || true`);
  if (dry) {
    console.log("[diag] dry-run: skipping commit/tag");
  } else {
    sh(`git commit -m "chore(release): ${version}"`);
    sh(`git tag ${version}`);
    if (push) sh(`git push && git push --tags`);
  }

  // 5) Optional: GitHub Release upload
  if (ghRelease) {
    maybeCreateGithubRelease(version, zipName, changelog, repo, dry);
  }

  // 6) Optional: re-fingerprint including artifacts for audit
  sh(`node scripts/fingerprint.mjs --include-artifacts`);

  console.log(`[ok] release flow completed for ${version}`);
}

main().catch((err) => { console.error(err.message || err); process.exit(1); });
