// Encrypt the model-provider key and upsert it into public.model_credentials.
//
// Usage: npm run supabase:secrets
// Reads from .env (never committed):
//   SUPABASE_URL (or VITE_SUPABASE_URL)  — project URL
//   SUPABASE_SERVICE_ROLE_KEY            — service role (bypasses RLS)
//   BEIDE_ECHOGATE_API_KEY               — the plaintext key to publish
//
// The app fetches the ciphertext via get_encrypted_model_api_key() (signed-in
// users only) and decrypts it in the main process.

import { createCipheriv, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// LEGACY: the app now reaches models through the model-proxy Edge Function
// and no longer decrypts this ciphertext (provider-key.ts was removed). Kept
// only to (re)publish model_credentials for older builds. For the proxy,
// rotate the key with:
//   update public.app_config set value = to_jsonb('<new-key>'::text)
//     where key = 'echogate_api_key';
const BEIDE_PROVIDER_KEY_HEX =
  "5c662bc7e788be2d91984423254a834fa2d74f6e1edfee8e6146457721817c84";

function loadEnv() {
  const env = { ...process.env };
  try {
    for (const line of readFileSync(join(process.cwd(), ".env"), "utf-8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i < 0) continue;
      const k = t.slice(0, i).trim();
      let v = t.slice(i + 1).trim();
      if (v.length >= 2 && (v[0] === '"' || v[0] === "'") && v.endsWith(v[0])) {
        v = v.slice(1, -1);
      }
      if (!env[k]) env[k] = v;
    }
  } catch {
    /* no .env — rely on process env */
  }
  return env;
}

function encrypt(plaintext) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(
    "aes-256-gcm",
    Buffer.from(BEIDE_PROVIDER_KEY_HEX, "hex"),
    iv,
  );
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, ct, cipher.getAuthTag()]).toString("base64");
}

const env = loadEnv();
const url = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || "";
const providerKey = (env.BEIDE_ECHOGATE_API_KEY || "").trim();

if (!url || !serviceKey || !providerKey) {
  console.error(
    "Need SUPABASE_URL (or VITE_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY and BEIDE_ECHOGATE_API_KEY in .env",
  );
  process.exit(1);
}

const ciphertext = encrypt(providerKey);
const res = await fetch(`${url}/rest/v1/model_credentials`, {
  method: "POST",
  headers: {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
    Prefer: "resolution=merge-duplicates",
  },
  body: JSON.stringify({
    provider: "echogate",
    ciphertext,
    updated_at: new Date().toISOString(),
  }),
});

if (!res.ok) {
  console.error(`Upsert failed: ${res.status} ${await res.text()}`);
  process.exit(1);
}
console.log("model_credentials upserted for provider=echogate (ciphertext only).");
