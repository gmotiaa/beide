import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { isAllowedSupabaseUrl } from "./supabase-url";

let client: SupabaseClient<Database> | null = null;
let warned = false;

/**
 * The hosted project baked into every build. Both values are public by
 * Supabase's design (the anon key only unlocks what RLS allows), so shipping
 * them in source is the supported distribution model — users must not need a
 * .env to sign in. `VITE_SUPABASE_*` in .env still overrides for local stacks.
 */
const DEFAULT_SUPABASE_URL = "https://opihhvfcykzdkqvpsqby.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "sb_publishable_rdB0pry0BN5cHjXCfPyIfg_CeC8gsV9";

/** `.env.example` ships placeholders — treat them as "not configured". */
function readEnv(): { url: string; anon: string } {
  let url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
  let anon = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();
  if (!url || url.includes("YOUR_PROJECT") || !isAllowedSupabaseUrl(url)) {
    if (url && !url.includes("YOUR_PROJECT") && !warned) {
      warned = true;
      console.warn("[beide supabase] VITE_SUPABASE_URL is not a valid URL:", url);
    }
    url = DEFAULT_SUPABASE_URL;
  }
  if (!anon || anon.startsWith("your_")) {
    anon = DEFAULT_SUPABASE_ANON_KEY;
  }
  return { url, anon };
}

export function getSupabase(): SupabaseClient<Database> | null {
  const env = readEnv();
  if (!client) {
    client = createClient<Database>(env.url, env.anon, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: "beide-auth",
      },
      global: {
        // Shows up in Supabase logs — makes it possible to tell app traffic
        // apart from dashboard/CLI traffic when debugging.
        headers: { "x-client-info": "beide-ide" },
      },
      // The renderer never subscribes to realtime; keep the budget minimal in
      // case a future feature opens a channel by accident.
      realtime: { params: { eventsPerSecond: 2 } },
    });
  }
  return client;
}

/** Always true now that the public project is baked in; kept for callers. */
export function isSupabaseConfigured(): boolean {
  return true;
}
