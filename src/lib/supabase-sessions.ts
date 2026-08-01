import type { AgentMode, ChatMessage } from "./types";
import type { Json } from "./database.types";
import { getSupabase } from "./supabase";

/**
 * Write-through cloud backup of chat sessions (public.chat_sessions).
 * Everything here is best-effort and silent: the local .beide/sessions files
 * remain the source of truth; the cloud copy exists so a fresh machine (or a
 * deleted workspace) can pull conversations back.
 */

export interface CloudSessionInfo {
  id: string;
  title: string;
  mode: AgentMode;
  updatedAt: number;
}

/** Stable, non-reversible key for a workspace path (djb2 hex — not a secret). */
export function workspaceKey(rootPath: string): string {
  const normalized = rootPath.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
  let hash = 5381;
  for (let i = 0; i < normalized.length; i++) {
    hash = ((hash << 5) + hash + normalized.charCodeAt(i)) >>> 0;
  }
  return `ws_${hash.toString(16)}`;
}

const MAX_CLOUD_CHARS = 1_500_000;

export async function upsertCloudSession(
  rootPath: string,
  session: { id: string; title: string; mode: AgentMode; messages: ChatMessage[] },
): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  try {
    const { data } = await sb.auth.getSession();
    if (!data.session) return;
    const body = JSON.stringify(session.messages);
    if (body.length > MAX_CLOUD_CHARS) return; // oversized — local copy only
    await sb.from("chat_sessions").upsert(
      {
        workspace_key: workspaceKey(rootPath),
        id: session.id,
        title: session.title.slice(0, 200),
        mode: session.mode,
        messages: session.messages as unknown as Json,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,workspace_key,id" },
    );
  } catch {
    // offline / RLS / quota — the local file is the source of truth
  }
}

export async function deleteCloudSession(rootPath: string, id: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  try {
    const { data } = await sb.auth.getSession();
    if (!data.session) return;
    await sb
      .from("chat_sessions")
      .delete()
      .eq("workspace_key", workspaceKey(rootPath))
      .eq("id", id);
  } catch {
    /* best-effort */
  }
}

export async function listCloudSessions(rootPath: string): Promise<CloudSessionInfo[]> {
  const sb = getSupabase();
  if (!sb) return [];
  try {
    const { data: auth } = await sb.auth.getSession();
    if (!auth.session) return [];
    const { data, error } = await sb
      .from("chat_sessions")
      .select("id,title,mode,updated_at")
      .eq("workspace_key", workspaceKey(rootPath))
      .order("updated_at", { ascending: false })
      .limit(80);
    if (error || !data) return [];
    return data.map((row) => ({
      id: String(row.id),
      title: String(row.title ?? "New chat"),
      mode: row.mode === "plan" ? "plan" : "agent",
      updatedAt: Date.parse(String(row.updated_at)) || 0,
    }));
  } catch {
    return [];
  }
}

export async function fetchCloudSessionMessages(
  rootPath: string,
  id: string,
): Promise<ChatMessage[] | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data: auth } = await sb.auth.getSession();
    if (!auth.session) return null;
    const { data, error } = await sb
      .from("chat_sessions")
      .select("messages")
      .eq("workspace_key", workspaceKey(rootPath))
      .eq("id", id)
      .maybeSingle();
    if (error || !data || !Array.isArray(data.messages)) return null;
    return data.messages as unknown as ChatMessage[];
  } catch {
    return null;
  }
}
