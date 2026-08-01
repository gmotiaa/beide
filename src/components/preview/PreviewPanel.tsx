import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

/* Last previewed URL survives a reload; one key for the whole app is enough. */
const STORAGE_KEY = "beide.previewUrl";
const DEFAULT_URL = "http://localhost:3000";
/* Cross-origin iframes barely report load failures, so "still no load event
   after this long" is the honest heuristic for "the dev server may be down". */
const LOAD_HINT_DELAY_MS = 3000;

/**
 * Accepts only http(s) URLs pointing at localhost / 127.0.0.1 — the same
 * boundary the CSP `frame-src` enforces. A bare `localhost:3000` gets the
 * scheme filled in; anything else returns null.
 */
function normalizePreviewUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `http://${trimmed}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") return null;
  return url.toString();
}

function readStoredUrl(): string {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && normalizePreviewUrl(stored)) return stored;
  } catch {
    /* storage unavailable — fall through to the default */
  }
  return DEFAULT_URL;
}

export function PreviewPanel() {
  const { t } = useTranslation();
  const [input, setInput] = useState(readStoredUrl);
  const [currentUrl, setCurrentUrl] = useState<string | null>(() =>
    normalizePreviewUrl(readStoredUrl()),
  );
  // Remounts the iframe so "reload the same URL" actually re-navigates.
  const [frameNonce, setFrameNonce] = useState(0);
  const [invalid, setInvalid] = useState(false);
  const [showLoadHint, setShowLoadHint] = useState(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    loadedRef.current = false;
    setShowLoadHint(false);
    if (!currentUrl) return;
    const timer = window.setTimeout(() => {
      if (!loadedRef.current) setShowLoadHint(true);
    }, LOAD_HINT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [currentUrl, frameNonce]);

  const navigate = useCallback(
    (raw: string) => {
      const normalized = normalizePreviewUrl(raw);
      if (!normalized) {
        setInvalid(true);
        return;
      }
      setInvalid(false);
      try {
        window.localStorage.setItem(STORAGE_KEY, normalized);
      } catch {
        /* storage unavailable — the session still works */
      }
      setInput(normalized);
      if (normalized === currentUrl) {
        setFrameNonce((n) => n + 1);
      } else {
        setCurrentUrl(normalized);
      }
    },
    [currentUrl],
  );

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    navigate(input);
  };

  const onReload = () => {
    if (currentUrl) {
      setFrameNonce((n) => n + 1);
    } else {
      navigate(input);
    }
  };

  const onFrameLoad = () => {
    loadedRef.current = true;
    setShowLoadHint(false);
  };

  return (
    <section className="preview-panel" aria-label={t("preview.title")}>
      <form className="preview-panel__toolbar" onSubmit={onSubmit}>
        <input
          className="preview-panel__url"
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setInvalid(false);
          }}
          placeholder={t("preview.urlPlaceholder")}
          aria-label={t("preview.urlLabel")}
          aria-invalid={invalid || undefined}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
        />
        <button type="submit" className="btn btn-primary preview-panel__btn">
          {t("preview.go")}
        </button>
        <button
          type="button"
          className="btn btn-ghost preview-panel__btn"
          onClick={onReload}
          title={t("preview.reload")}
          aria-label={t("preview.reload")}
        >
          {/* Straight lines and right angles, matching the shell icon language. */}
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M18.5 11V6.5H7" />
            <path d="M9.8 3.7 7 6.5l2.8 2.8" />
            <path d="M5.5 13v4.5H17" />
            <path d="M14.2 20.3 17 17.5l-2.8-2.8" />
          </svg>
        </button>
      </form>

      {invalid && (
        <div className="preview-panel__notice preview-panel__notice--error" role="alert">
          {t("preview.invalidUrl")}
        </div>
      )}
      {!invalid && showLoadHint && (
        <div className="preview-panel__notice" role="status">
          {t("preview.notLoadedHint")}
        </div>
      )}

      <div className="preview-panel__body">
        {currentUrl ? (
          <iframe
            key={`${currentUrl}#${frameNonce}`}
            className="preview-panel__frame"
            src={currentUrl}
            title={t("preview.frameTitle")}
            sandbox="allow-scripts allow-same-origin allow-forms"
            referrerPolicy="no-referrer"
            onLoad={onFrameLoad}
          />
        ) : (
          <div className="preview-panel__empty">{t("preview.urlPlaceholder")}</div>
        )}
      </div>
    </section>
  );
}
