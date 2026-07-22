/**
 * One-shot setup against live Supabase project.
 * Uses SERVICE ROLE from env — run: node scripts/supabase-setup.mjs
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

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!URL || !KEY) {
  console.error("Missing SUPABASE_URL / SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(`${URL}${path}`, {
    method,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { ok: res.ok, status: res.status, json };
}

console.log("→ health");
const health = await api("/auth/v1/health");
console.log(health.status, health.json);

console.log("→ settings");
const settings = await api("/auth/v1/settings");
console.log({
  email: settings.json?.external?.email,
  disable_signup: settings.json?.disable_signup,
  mailer_autoconfirm: settings.json?.mailer_autoconfirm,
});

// Ensure demo admin user (confirmed)
const demoEmail = "beide@test.local";
// test.local might be blocked — use confirmed admin create
const demo = {
  email: "owner@beide.app",
  password: "BeideOwner123!",
  email_confirm: true,
  user_metadata: { display_name: "Beide Owner", app: "beide" },
};

console.log("→ ensure user", demo.email);
const created = await api("/auth/v1/admin/users", {
  method: "POST",
  body: demo,
});
if (created.ok) {
  console.log("created", created.json?.id, created.json?.email);
} else if (
  String(created.json?.msg || created.json?.message || "")
    .toLowerCase()
    .includes("already") ||
  created.status === 422
) {
  console.log("user may already exist:", created.status, created.json);
} else {
  console.log("create result:", created.status, created.json);
}

// Verify password login
console.log("→ login test");
const login = await api("/auth/v1/token?grant_type=password", {
  method: "POST",
  body: { email: demo.email, password: demo.password },
});
if (login.ok) {
  console.log("login OK, user:", login.json?.user?.email);
} else {
  // try list users and update password
  console.log("login failed:", login.status, login.json);
  const list = await api("/auth/v1/admin/users?page=1&per_page=50");
  const users = list.json?.users || [];
  const found = users.find((u) => u.email === demo.email);
  if (found) {
    console.log("→ update password for", found.id);
    const upd = await api(`/auth/v1/admin/users/${found.id}`, {
      method: "PUT",
      body: { password: demo.password, email_confirm: true },
    });
    console.log(upd.status, upd.ok ? "updated" : upd.json);
    const login2 = await api("/auth/v1/token?grant_type=password", {
      method: "POST",
      body: { email: demo.email, password: demo.password },
    });
    console.log("login2", login2.ok ? "OK" : login2.json);
  } else {
    console.log("users sample:", users.slice(0, 5).map((u) => u.email));
  }
}

console.log("\nDone. Use in app:");
console.log("  email:", demo.email);
console.log("  password:", demo.password);
console.log("  url:", URL);
