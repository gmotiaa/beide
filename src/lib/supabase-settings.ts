import { getSupabase } from "./supabase";
import type { Json } from "./database.types";

export interface UserSettingsCloudData {
  onboarding_done?: boolean;
  last_workspace_path?: string | null;
  extras?: Record<string, unknown>;
}

export async function fetchUserSettingsCloud(): Promise<UserSettingsCloudData | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data: sessionData } = await sb.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) return null;

  try {
    const { data, error } = await sb
      .from("user_settings")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (error && error.code !== "PGRST116") {
      console.warn("[beide settings] fetch error:", error.message);
      return null;
    }

    if (!data) return null;

    return {
      onboarding_done: data.onboarding_done,
      last_workspace_path: data.last_workspace_path,
      extras: (data.extras ?? {}) as Record<string, unknown>,
    };
  } catch (e) {
    console.warn("[beide settings] exception:", e);
    return null;
  }
}

export async function saveUserSettingsCloud(
  settings: UserSettingsCloudData,
): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { data: sessionData } = await sb.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) return false;

  try {
    // Only send what the caller actually set: filling the gaps with defaults
    // turned every partial save into a silent wipe of the other columns.
    const payload: Record<string, unknown> = { user_id: user.id };
    if (settings.onboarding_done !== undefined) {
      payload.onboarding_done = settings.onboarding_done;
    }
    if (settings.last_workspace_path !== undefined) {
      payload.last_workspace_path = settings.last_workspace_path;
    }
    if (settings.extras !== undefined) payload.extras = settings.extras as Json;

    const { error } = await sb
      .from("user_settings")
      .upsert(payload as never, { onConflict: "user_id" });
    if (error) {
      console.warn("[beide settings] save error:", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn("[beide settings] save exception:", e);
    return false;
  }
}
