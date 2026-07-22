import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import { useTranslation } from "react-i18next";
import { useChatStore } from "../../stores/chat";
import { useAgentStore } from "../../stores/agent";
import { useWorkspaceStore } from "../../stores/workspace";
import { fileNameFromPath } from "../../lib/language";
import type { ChatImage, ChatMention } from "../../lib/types";
import { Icons, IconButton } from "../common/IconButton";

function readFileAsImage(file: File): Promise<ChatImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const match = /^data:([^;]+);base64,(.+)$/.exec(result);
      if (!match) {
        reject(new Error("Invalid image data"));
        return;
      }
      resolve({
        mimeType: match[1],
        data: match[2],
        name: file.name,
      });
    };
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

export function Composer() {
  const { t } = useTranslation();
  const draft = useChatStore((s) => s.draft);
  const setDraft = useChatStore((s) => s.setDraft);
  const images = useChatStore((s) => s.images);
  const addImage = useChatStore((s) => s.addImage);
  const removeImage = useChatStore((s) => s.removeImage);
  const addMention = useChatStore((s) => s.addMention);
  const streaming = useAgentStore((s) => s.streaming);
  const send = useAgentStore((s) => s.send);
  const abort = useAgentStore((s) => s.abort);
  const searchFiles = useWorkspaceStore((s) => s.searchFiles);
  const rootPath = useWorkspaceStore((s) => s.rootPath);

  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionItems, setMentionItems] = useState<string[]>([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  const mentionStart = useRef<number | null>(null);

  useEffect(() => {
    if (!mentionOpen) return;
    let cancelled = false;
    const q = mentionQuery;
    const handle = window.setTimeout(() => {
      void searchFiles(q || "").then((paths) => {
        if (!cancelled) {
          setMentionItems(paths.slice(0, 12));
          setMentionIndex(0);
        }
      });
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [mentionOpen, mentionQuery, searchFiles]);

  const resizeTa = useCallback(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(160, Math.max(56, el.scrollHeight))}px`;
  }, []);

  useEffect(() => {
    resizeTa();
  }, [draft, resizeTa]);

  const closeMention = () => {
    setMentionOpen(false);
    setMentionQuery("");
    mentionStart.current = null;
  };

  const applyMention = (path: string) => {
    const el = taRef.current;
    const start = mentionStart.current;
    if (el == null || start == null) {
      closeMention();
      return;
    }
    const name = fileNameFromPath(path);
    const before = draft.slice(0, start);
    const after = draft.slice(el.selectionStart);
    const insertion = `@${name} `;
    const next = before + insertion + after;
    setDraft(next);
    const mention: ChatMention = {
      type: "file",
      path,
      name,
    };
    addMention(mention);
    closeMention();
    requestAnimationFrame(() => {
      const pos = before.length + insertion.length;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };

  const onChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setDraft(value);

    const caret = e.target.selectionStart;
    const upto = value.slice(0, caret);
    const at = upto.lastIndexOf("@");
    if (at >= 0) {
      const token = upto.slice(at + 1);
      if (!/\s/.test(token) && (at === 0 || /\s/.test(upto[at - 1] ?? " "))) {
        mentionStart.current = at;
        setMentionQuery(token);
        setMentionOpen(true);
        return;
      }
    }
    closeMention();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionOpen && mentionItems.length) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((i) => (i + 1) % mentionItems.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((i) => (i - 1 + mentionItems.length) % mentionItems.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        applyMention(mentionItems[mentionIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        closeMention();
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!streaming) void send();
    }
  };

  const onPaste = async (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;
        try {
          const img = await readFileAsImage(file);
          addImage(img);
        } catch {
          /* ignore bad paste */
        }
      }
    }
  };

  const onPickFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      try {
        addImage(await readFileAsImage(file));
      } catch {
        /* ignore */
      }
    }
    e.target.value = "";
  };

  const canSend = (!!draft.trim() || images.length > 0) && !streaming;

  return (
    <div className="composer">
      {mentionOpen && rootPath && (
        <div className="mention-menu" role="listbox">
          <div className="mention-menu__label">{t("chat.mentionFiles")}</div>
          {mentionItems.length === 0 ? (
            <div className="search-empty">{t("common.noResults")}</div>
          ) : (
            mentionItems.map((path, i) => (
              <button
                key={path}
                type="button"
                role="option"
                aria-selected={i === mentionIndex}
                className={`mention-menu__item${i === mentionIndex ? " is-active" : ""}`}
                onMouseDown={(ev) => {
                  ev.preventDefault();
                  applyMention(path);
                }}
              >
                {fileNameFromPath(path)}
                <span style={{ color: "var(--text-faint)", marginLeft: 8 }}>{path}</span>
              </button>
            ))
          )}
        </div>
      )}

      {images.length > 0 && (
        <div className="composer__images">
          {images.map((img, i) => (
            <div key={`${img.name ?? "img"}_${i}`} className="composer__image">
              <img src={`data:${img.mimeType};base64,${img.data}`} alt={img.name ?? t("chat.imageAttached")} />
              <button
                type="button"
                className="composer__image-remove"
                title={t("chat.removeImage")}
                onClick={() => removeImage(i)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="composer__input-row">
        <textarea
          id="chat-composer"
          ref={taRef}
          value={draft}
          onChange={onChange}
          onKeyDown={onKeyDown}
          onPaste={(e) => void onPaste(e)}
          placeholder={t("chat.placeholder")}
          rows={2}
          disabled={false}
        />
      </div>

      <div className="composer__actions" style={{ justifyContent: "space-between" }}>
        <div className="composer__toolbar">
          <IconButton
            label={t("chat.attachImage")}
            onClick={() => fileRef.current?.click()}
          >
            {Icons.image}
          </IconButton>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => void onPickFiles(e)}
          />
        </div>
        <div className="composer__toolbar">
          {streaming ? (
            <button type="button" className="btn btn-danger" onClick={() => void abort()}>
              {Icons.stop}
              {t("chat.abort")}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              disabled={!canSend}
              onClick={() => void send()}
            >
              {Icons.send}
              {t("chat.send")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
