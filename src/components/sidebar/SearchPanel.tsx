import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useWorkspaceStore } from "../../stores/workspace";
import { useEditorStore } from "../../stores/editor";
import { fileNameFromPath } from "../../lib/language";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

export function SearchPanel() {
  const { t } = useTranslation();
  const rootPath = useWorkspaceStore((s) => s.rootPath);
  const searchFiles = useWorkspaceStore((s) => s.searchFiles);
  const openFile = useEditorStore((s) => s.openFile);
  const openFolder = useWorkspaceStore((s) => s.openFolder);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!rootPath || !query.trim()) {
      // Clearing the query mid-debounce left `searching` stuck on true — the
      // panel showed the loading row under an empty input forever.
      setResults([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const handle = window.setTimeout(() => {
      searchFiles(query).then(
        (paths) => {
          if (!cancelled) {
            setResults(paths);
            setSearching(false);
          }
        },
        () => {
          if (!cancelled) {
            setResults([]);
            setSearching(false);
          }
        },
      );
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [query, rootPath, searchFiles]);

  if (!rootPath) {
    return (
      <div className="editor-empty" style={{ padding: 20 }}>
        <p>{t("sidebar.noWorkspace")}</p>
        <Button type="button" size="sm" onClick={() => void openFolder()}>
          {t("common.openFolder")}
        </Button>
      </div>
    );
  }

  return (
    <div className="search-panel">
      <div className="search-panel__input-wrap">
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("sidebar.searchPlaceholder")}
          autoFocus
        />
      </div>
      <div className="search-results">
        {searching && <div className="search-empty">{t("common.loading")}</div>}
        {!searching && query.trim() && results.length === 0 && (
          <div className="search-empty">{t("common.noResults")}</div>
        )}
        {results.map((path) => (
          <button
            key={path}
            type="button"
            className="search-result"
            title={path}
            onClick={() => void openFile(path)}
          >
            {fileNameFromPath(path)}
            <div className="mt-0.5 truncate text-[11px] text-[color:var(--text-faint)]">
              {path}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
