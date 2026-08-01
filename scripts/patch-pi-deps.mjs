// pi ships an npm-shrinkwrap.json pinning brace-expansion@5.0.7 (vulnerable:
// GHSA-mh99-v99m-4gvg). npm honors the shrinkwrap for that subtree, so the
// root `overrides` entry cannot reach it and EVERY `npm install` silently
// reverts the fix. This postinstall re-applies the patched release; TEST 11
// in verification.test.ts is the tripwire if this ever stops running.

import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PATCHED = "5.0.9";
const NESTED = join(
  "node_modules",
  "@earendil-works",
  "pi-coding-agent",
  "node_modules",
  "brace-expansion",
);

function nestedVersion() {
  try {
    return JSON.parse(readFileSync(join(NESTED, "package.json"), "utf-8")).version;
  } catch {
    return null;
  }
}

const current = nestedVersion();
if (current === PATCHED) {
  process.exit(0);
}
if (current === null) {
  // pi not installed (partial install) — nothing to patch.
  process.exit(0);
}

console.log(`[patch-pi-deps] brace-expansion ${current} -> ${PATCHED}`);
const tmp = mkdtempSync(join(tmpdir(), "beide-be-"));
try {
  execSync(`npm pack brace-expansion@${PATCHED} --silent`, { cwd: tmp, stdio: "pipe" });
  execSync(`tar -xzf brace-expansion-${PATCHED}.tgz`, { cwd: tmp, stdio: "pipe" });
  rmSync(NESTED, { recursive: true, force: true });
  cpSync(join(tmp, "package"), NESTED, { recursive: true });

  // Keep the lockfile telling the truth (and TEST 11 green).
  const lockPath = "package-lock.json";
  if (existsSync(lockPath)) {
    const lock = JSON.parse(readFileSync(lockPath, "utf-8"));
    const key = NESTED.replace(/\\/g, "/");
    if (lock.packages?.[key] && lock.packages[key].version !== PATCHED) {
      lock.packages[key].version = PATCHED;
      lock.packages[key].resolved =
        `https://registry.npmjs.org/brace-expansion/-/brace-expansion-${PATCHED}.tgz`;
      delete lock.packages[key].integrity;
      writeFileSync(lockPath, JSON.stringify(lock, null, 2) + "\n");
    }
  }
  console.log("[patch-pi-deps] done");
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
