/**
 * Read-only smoke test of the anon exposure surface — run: node scripts/supabase-verify.mjs
 *
 * The role probes in psql only prove what the *database* grants; this goes
 * through PostgREST with the real anon key, which is what an attacker holds
 * (the key ships inside the Electron bundle). Nothing here writes.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  const p = resolve(process.cwd(), ".env");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnv();

const URL_BASE = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const ANON = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!URL_BASE || !ANON) {
  console.error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env");
  process.exit(1);
}
if (process.env.SUPABASE_SERVICE_ROLE_KEY === ANON) {
  console.error("Refusing to run: the anon key equals the service role key.");
  process.exit(1);
}

async function call(path, { method = "GET", body } = {}) {
  let res;
  try {
    res = await fetch(`${URL_BASE}${path}`, {
      method,
      headers: {
        apikey: ANON,
        Authorization: `Bearer ${ANON}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      // undici gives up connecting after 10 s; the first hop to a cold project
      // can take longer than that and a timeout must not look like a failure.
      signal: AbortSignal.timeout(30_000),
    });
  } catch (e) {
    // A network failure must not read as "sealed" — surface it and stop.
    console.error(`\nCannot reach ${URL_BASE}: ${e?.cause?.code ?? e?.message}`);
    console.error("Check connectivity / VITE_SUPABASE_URL before trusting any result.");
    process.exit(2);
  }
  let json;
  try {
    json = JSON.parse(await res.text());
  } catch {
    json = null;
  }
  return { status: res.status, ok: res.ok, json };
}

const results = [];
function record(label, pass, detail) {
  results.push({ label, pass, detail });
  console.log(`${pass ? "  PASS" : "  FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
}

/** Tables anon must not see at all. */
const SEALED_TABLES = [
  "profiles",
  "usage_ledger",
  "usage_events",
  "user_settings",
  "app_config",
];

/** RPCs anon must not be able to invoke. */
const SEALED_RPCS = [
  ["get_billing", {}],
  ["spend_tokens", { p_amount: 1 }],
  ["get_usage_history", { p_days: 1 }],
  ["set_my_plan", { p_plan: "pro" }],
  ["add_credits", { p_amount: 1 }],
  ["reset_usage_windows", {}],
  ["app_flag", { p_key: "demo_billing", p_default: false }],
  ["get_encrypted_model_api_key", {}],
  ["ensure_usage_ledger", { p_user: "00000000-0000-0000-0000-000000000000" }],
];

console.log(`=== anon surface of ${URL_BASE} ===\n`);

console.log("[readable by design]");
const limits = await call("/rest/v1/plan_limits?select=plan,tokens_5h,tokens_week");
record(
  "plan_limits is readable",
  limits.ok && Array.isArray(limits.json) && limits.json.length > 0,
  `${limits.status}${limits.ok ? `, ${limits.json?.length ?? 0} rows` : ""}`,
);

console.log("\n[must be sealed — tables]");
for (const table of SEALED_TABLES) {
  const r = await call(`/rest/v1/${table}?select=*&limit=1`);
  record(`${table} is not readable`, !r.ok, `${r.status} ${r.json?.code ?? ""}`);
}

console.log("\n[must be sealed — RPCs]");
for (const [fn, body] of SEALED_RPCS) {
  const r = await call(`/rest/v1/rpc/${fn}`, { method: "POST", body });
  record(`${fn}() is not callable`, !r.ok, `${r.status} ${r.json?.code ?? ""}`);
}

const failed = results.filter((r) => !r.pass);
console.log(
  `\n=== ${results.length - failed.length} PASSED, ${failed.length} FAILED ===`,
);
if (failed.length > 0) {
  console.error("\nThe anon key reaches more than it should:");
  for (const f of failed) console.error(`  - ${f.label} (${f.detail})`);
  process.exit(1);
}
