/**
 * Run a TypeScript entry point in plain Node.
 *
 * The repo has no test framework, and Node's own type stripping cannot resolve
 * the extensionless relative imports used across `electron/services`. esbuild
 * (already present via vite) bundles the entry to a temp ESM file and Node runs
 * that — enough to execute the backend invariant harness without adding a
 * dependency.
 *
 * Usage: node scripts/run-ts.mjs <entry.ts> [...args]
 */
import { build } from "esbuild";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const [entry, ...rest] = process.argv.slice(2);
if (!entry) {
  console.error("usage: node scripts/run-ts.mjs <entry.ts> [...args]");
  process.exit(2);
}

const dir = await mkdtemp(join(tmpdir(), "beide-run-ts-"));
const outfile = join(dir, "entry.mjs");

try {
  await build({
    entryPoints: [resolve(entry)],
    outfile,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
    // Anything from node_modules stays external — this only bundles our sources.
    packages: "external",
    logLevel: "warning",
  });

  const code = await new Promise((res) => {
    spawn(process.execPath, [outfile, ...rest], { stdio: "inherit" }).on(
      "close",
      (c) => res(c ?? 1),
    );
  });
  process.exitCode = code;
} finally {
  await rm(dir, { recursive: true, force: true });
}
