import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { app } from "electron";

const ADMIN_ENV_FILE = ".beide-admin.env";

function parseEnvFile(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!existsSync(path)) return out;
  try {
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i < 0) continue;
      const k = t.slice(0, i).trim();
      const v = t.slice(i + 1).trim();
      if (k) out[k] = v;
    }
  } catch {
    /* ignore */
  }
  return out;
}

function adminEnvPath(): string {
  return join(app.getPath("userData"), ADMIN_ENV_FILE);
}

/** Public URL only — read from project .env (VITE_SUPABASE_URL is safe to expose). */
function projectUrl(): string | undefined {
  const candidates = [
    join(process.cwd(), ".env"),
    join(app.getAppPath(), ".env"),
  ];
  for (const p of candidates) {
    const env = parseEnvFile(p);
    if (env.VITE_SUPABASE_URL || env.SUPABASE_URL) {
      return env.VITE_SUPABASE_URL || env.SUPABASE_URL;
    }
  }
  return process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
}

function loadAdminEnv(): { url?: string; key?: string } {
  // 1. explicit env vars (e.g. CI / launch from shell)
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      url: process.env.SUPABASE_URL || projectUrl(),
      key: process.env.SUPABASE_SERVICE_ROLE_KEY,
    };
  }
  // 2. userData/.beide-admin.env — persists across runs, not in repo
  const file = parseEnvFile(adminEnvPath());
  return {
    url: file.SUPABASE_URL || projectUrl(),
    key: file.SUPABASE_SERVICE_ROLE_KEY,
  };
}

/** Persist the admin key into userData (called from Settings UI). */
export async function setAdminKey(key: string): Promise<void> {
  const p = adminEnvPath();
  mkdirSync(dirname(p), { recursive: true });
  const trimmed = key.trim();
  if (!trimmed) {
    // empty → remove file
    try {
      writeFileSync(p, "");
    } catch {
      /* ignore */
    }
    return;
  }
  writeFileSync(p, `SUPABASE_SERVICE_ROLE_KEY=${trimmed}\n`, { mode: 0o600 });
}

/** Whether the admin key is currently configured. */
export function hasAdminKey(): boolean {
  return Boolean(loadAdminEnv().key);
}

function cfg() {
  return loadAdminEnv();
}

export async function adminSignUp(
  email: string,
  password: string,
): Promise<{ ok: boolean; error?: string }> {
  const { url, key } = cfg();
  if (!url || !key) {
    return {
      ok: false,
      error: "Supabase admin key не задан. Положите SUPABASE_SERVICE_ROLE_KEY в Settings → Admin.",
    };
  }
  try {
    const res = await fetch(`${url}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { app: "beide" },
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      msg?: string;
      message?: string;
      error_code?: string;
      id?: string;
    };
    if (res.ok) return { ok: true };
    const msg = String(json.msg || json.message || res.statusText);
    if (
      res.status === 422 ||
      /already|exists|registered/i.test(msg) ||
      json.error_code === "email_exists"
    ) {
      return { ok: true };
    }
    return { ok: false, error: msg };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
