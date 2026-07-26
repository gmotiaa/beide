import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

let client: SupabaseClient<Database> | null = null;
let warned = false;

/** `.env.example` ships placeholders — treat them as "not configured". */
function readEnv(): { url: string; anon: string } | null {
  const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
  const anon = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();
  if (!url || !anon) return null;
  if (url.includes("YOUR_PROJECT") || anon.startsWith("your_")) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") return null;
  } catch {
    if (!warned) {
      warned = true;
      console.warn("[beide supabase] VITE_SUPABASE_URL is not a valid URL:", url);
    }
    return null;
  }
  return { url, anon };
}

export function getSupabase(): SupabaseClient<Database> | null {
  const env = readEnv();
  if (!env) return null;
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

export function isSupabaseConfigured(): boolean {
  return readEnv() !== null;
}
