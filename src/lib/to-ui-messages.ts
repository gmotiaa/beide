import type { UIMessage } from "ai";
import type { ChatMessage } from "./types";

/** Map pi / beide tool names → Agent Elements tool-* part types */
function toolPartType(toolName: string): string {
  const key = toolName.trim().toLowerCase().replace(/[\s_-]+/g, "");
  const map: Record<string, string> = {
    bash: "tool-Bash",
    shell: "tool-Bash",
    edit: "tool-Edit",
    write: "tool-Write",
    read: "tool-Read",
    grep: "tool-Grep",
    find: "tool-Glob",
    glob: "tool-Glob",
    ls: "tool-Glob",
    list: "tool-Glob",
    search: "tool-WebSearch",
    websearch: "tool-WebSearch",
    thinking: "tool-Thinking",
    todo: "tool-TodoWrite",
    todowrite: "tool-TodoWrite",
    plan: "tool-PlanWrite",
    planwrite: "tool-PlanWrite",
    task: "tool-Task",
    agent: "tool-Agent",
    gitstatus: "tool-GitStatus",
    workspacemap: "tool-WorkspaceMap",
    projectinfo: "tool-ProjectInfo",
  };
  if (map[key]) return map[key];
  const pascal = toolName
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
  return `tool-${pascal || "Unknown"}`;
}

function basenamePath(p: string): string {
  const norm = p.replace(/\\/g, "/");
  const parts = norm.split("/").filter(Boolean);
  return parts[parts.length - 1] || p;
}

/** Reject file-body / CSS / JSON dumps as "path" for tool cards */
function looksLikePath(s: string): boolean {
  const t = s.trim();
  if (!t || t.length > 260) return false;
  if (t === "готово" || t === "ok" || t === "ошибка" || t === "done") return false;
  if (t.startsWith("{") || t.startsWith("[")) return false;
  if (t.includes("\n") && t.length > 80) return false;
  if (/^#?[0-9a-fA-F]{3,8}$/.test(t)) return false;
  if (t.includes("--") && t.includes(":")) return false;
  if (/^(const|let|var|function|import|export|return)\b/.test(t)) return false;
  if (t.includes("document.") || t.includes("createRoot")) return false;
  if (/[/\\]/.test(t) || /\.[a-zA-Z0-9]{1,8}$/.test(t)) return true;
  if (/^[\w.-]+$/.test(t) && t.length < 80) return true;
  return false;
}

function toolInput(
  toolName: string,
  detail?: string,
  args?: Record<string, unknown>,
): Record<string, unknown> {
  // Structured args from store win
  if (args && Object.keys(args).length > 0) {
    const pathLike =
      (typeof args.path === "string" && args.path) ||
      (typeof args.file_path === "string" && args.file_path) ||
      (typeof args.filePath === "string" && args.filePath) ||
      (typeof args.filename === "string" && args.filename) ||
      "";
    const out: Record<string, unknown> = { ...args };
    if (pathLike) {
      out.path = pathLike;
      out.file_path = pathLike;
      out._basename = basenamePath(pathLike);
    }
    if (typeof args.command === "string") out.command = args.command;
    if (typeof args.cmd === "string" && !out.command) out.command = args.cmd;
    return out;
  }

  const key = toolName.trim().toLowerCase();
  const d = detail ?? "";

  if (d.trim().startsWith("{") || d.trim().startsWith("[")) {
    try {
      const parsed = JSON.parse(d) as Record<string, unknown>;
      if (parsed && typeof parsed === "object") {
        const pathLike =
          (typeof parsed.path === "string" && parsed.path) ||
          (typeof parsed.file_path === "string" && parsed.file_path) ||
          (typeof parsed.filePath === "string" && parsed.filePath) ||
          (typeof parsed.filename === "string" && parsed.filename) ||
          "";
        if (pathLike && looksLikePath(pathLike)) {
          return { ...parsed, path: pathLike, file_path: pathLike, _basename: basenamePath(pathLike) };
        }
        const cmd =
          (typeof parsed.command === "string" && parsed.command) ||
          (typeof parsed.cmd === "string" && parsed.cmd) ||
          "";
        if (cmd) return { ...parsed, command: cmd };
        if (Array.isArray(parsed.todos)) return parsed;
        if (parsed.plan && typeof parsed.plan === "object") return parsed;
        if (key === "read" || key === "write" || key === "edit") {
          return pathLike ? { path: pathLike, file_path: pathLike } : {};
        }
        return parsed;
      }
    } catch {
      /* fall through */
    }
  }

  if (key === "bash" || key === "shell") {
    if (d === "готово" || d === "ok" || d === "ошибка" || d === "done" || !d)
      return { command: "" };
    return { command: d.length > 2000 ? `${d.slice(0, 2000)}…` : d };
  }
  if (key === "edit" || key === "write" || key === "read") {
    if (!looksLikePath(d)) return {};
    return { file_path: d, path: d, _basename: basenamePath(d) };
  }
  if (key === "grep" || key === "find" || key === "glob" || key === "ls") {
    if (looksLikePath(d)) return { pattern: d, path: d };
    return { pattern: d };
  }
  if (key === "todo" || key === "todowrite") {
    return { todos: [] };
  }
  if (key === "plan" || key === "planwrite") {
    return {
      plan: {
        id: "plan",
        title: d || "План",
        summary: d,
      },
    };
  }
  if (key === "thinking") return { thought: d };
  if (key === "git_status" || key === "gitstatus") return { scope: d || "status" };
  if (key === "workspace_map" || key === "workspacemap")
    return { path: d || "." };
  if (key === "project_info" || key === "projectinfo") return { target: "package.json" };
  return looksLikePath(d) ? { detail: d, path: d } : { detail: d.slice(0, 120) };
}

type MessagePart = {
  type: string;
  text?: string;
  state?: string;
  toolCallId?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
  mediaType?: string;
  filename?: string;
  url?: string;
  [key: string]: unknown;
};

type DraftMessage = {
  id: string;
  role: "user" | "assistant";
  parts: MessagePart[];
};

/**
 * Convert beide ChatMessage[] into UIMessage[] for Agent Elements.
 * Preserves timeline: text → tools → more text (interleaved parts).
 */
export function toUIMessages(messages: ChatMessage[]): UIMessage[] {
  const out: DraftMessage[] = [];
  const bag: { draft: DraftMessage | null } = { draft: null };

  const flush = () => {
    if (bag.draft) {
      out.push(bag.draft);
      bag.draft = null;
    }
  };

  const ensureAssistant = (seed?: ChatMessage): DraftMessage => {
    const cur = bag.draft;
    if (!cur || cur.role !== "assistant") {
      bag.draft = {
        id: seed?.id ?? `asst_${Date.now()}`,
        role: "assistant",
        parts: [],
      };
    }
    return bag.draft as DraftMessage;
  };

  /** Attach tools to the open draft, or reopen the last assistant in `out`. */
  const ensureAssistantForTool = (): DraftMessage => {
    if (bag.draft && bag.draft.role === "assistant") return bag.draft;
    const last = out[out.length - 1];
    if (last && last.role === "assistant") {
      bag.draft = last;
      out.pop();
      return last;
    }
    return ensureAssistant();
  };

  for (const m of messages) {
    if (m.role === "user") {
      flush();
      const parts: MessagePart[] = [];
      if (m.content) {
        parts.push({ type: "text", text: m.content });
      }
      for (const img of m.images ?? []) {
        parts.push({
          type: "file",
          mediaType: img.mimeType || "image/png",
          filename: img.name ?? "image",
          url: `data:${img.mimeType || "image/png"};base64,${img.data}`,
        });
      }
      if (m.mentions?.length) {
        const mentionText = m.mentions
          .map((x) => `@${x.type}:${x.path}`)
          .join(" ");
        if (!m.content.includes("@")) {
          parts.unshift({ type: "text", text: mentionText });
        }
      }
      if (!parts.length) {
        parts.push({ type: "text", text: "" });
      }
      out.push({ id: m.id, role: "user", parts });
      continue;
    }

    if (m.role === "assistant") {
      const cur = bag.draft;
      const lastPart = cur?.parts[cur.parts.length - 1];
      const lastIsTool =
        !!lastPart && String(lastPart.type ?? "").startsWith("tool-");

      if (!cur || cur.role !== "assistant") {
        ensureAssistant(m);
      } else if (lastIsTool) {
        // text after tools — stay on same draft
      } else if (cur.id !== m.id && cur.parts.some((p) => p.type === "text")) {
        const onlyStreamingText =
          cur.parts.length === 1 &&
          cur.parts[0]?.type === "text" &&
          cur.parts[0]?.state === "streaming";
        if (!onlyStreamingText && m.id !== cur.id) {
          flush();
          ensureAssistant(m);
        }
      }

      const a = bag.draft as DraftMessage;
      if (m.content || m.streaming) {
        const last = a.parts[a.parts.length - 1];
        if (
          last &&
          last.type === "text" &&
          (last.state === "streaming" || m.streaming) &&
          !String(last.type).startsWith("tool-")
        ) {
          last.text = m.content ?? "";
          last.state = m.streaming ? "streaming" : "done";
        } else {
          a.parts.push({
            type: "text",
            text: m.content ?? "",
            state: m.streaming ? "streaming" : "done",
          });
        }
      }
      continue;
    }

    if (m.role === "tool") {
      const a = ensureAssistantForTool();
      const last = a.parts[a.parts.length - 1];
      if (last?.type === "text" && last.state === "streaming") {
        last.state = "done";
      }

      const name = m.toolName ?? "tool";
      const type = toolPartType(name);
      const state =
        m.toolStatus === "running"
          ? "input-streaming"
          : m.toolStatus === "error"
            ? "output-error"
            : "output-available";
      const input = toolInput(name, m.toolDetail ?? m.content, m.toolArgs);
      let output: unknown =
        m.toolResult ?? { ok: true, detail: m.toolDetail ?? m.content };
      if (type === "tool-TodoWrite") {
        output = {
          oldTodos: [],
          ...(typeof input === "object" ? input : {}),
        };
      }
      if (type === "tool-PlanWrite") {
        output = input;
      }
      if (type === "tool-Edit" || type === "tool-Write") {
        if (m.toolResult) output = m.toolResult;
        else if (m.toolDetail?.startsWith("{")) {
          try {
            output = JSON.parse(m.toolDetail);
          } catch {
            /* keep */
          }
        }
      }
      if (type === "tool-Grep" || type === "tool-Glob") {
        // Help SearchTool / registry show counts when available
        if (m.toolResult && typeof m.toolResult === "object") {
          output = m.toolResult;
        }
      }

      const part: MessagePart = {
        type,
        toolCallId: m.id,
        state,
        input,
        ...(state === "output-available" ? { output } : {}),
        ...(state === "output-error"
          ? { errorText: m.toolDetail ?? m.content ?? "ошибка" }
          : {}),
      };

      // Match only by toolCallId — never by type alone (concurrent tools)
      const idx = a.parts.findIndex((p) => p.toolCallId === m.id);
      if (idx >= 0) a.parts[idx] = part;
      else a.parts.push(part);
      continue;
    }
  }

  flush();
  return out as unknown as UIMessage[];
}
