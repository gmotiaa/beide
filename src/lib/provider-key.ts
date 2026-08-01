import { getBeide } from "./ipc";
import { getSupabase } from "./supabase";

/**
 * Fetch the encrypted provider key from Supabase (authenticated users only)
 * and hand it to the main process, which decrypts it in memory and arms the
 * model runtime. The renderer never sees the plaintext.
 */
export async function deliverProviderKey(): Promise<boolean> {
  const sb = getSupabase();
  const api = getBeide();
  if (!sb || !api) return false;
  try {
    const { data, error } = await sb.rpc("get_encrypted_model_api_key");
    if (error || !data || typeof data !== "object" || Array.isArray(data)) {
      if (error) console.warn("[beide] provider key fetch failed:", error.message);
      return false;
    }
    const payload = data as { ok?: boolean; ciphertext?: string; error?: string };
    if (!payload.ok || typeof payload.ciphertext !== "string") {
      console.warn("[beide] provider key not available:", payload.error ?? "unknown");
      return false;
    }
    const res = await api.agent.installProviderKey(payload.ciphertext);
    if (!res.ok) console.warn("[beide] provider key install failed:", res.error);
    return res.ok;
  } catch (e) {
    console.warn("[beide] provider key delivery failed", e);
    return false;
  }
}
