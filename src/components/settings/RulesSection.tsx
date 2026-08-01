import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { IconFileText } from "@tabler/icons-react";
import { getBeide } from "../../lib/ipc";
import { cn } from "../../lib/utils";
import { useWorkspaceStore } from "../../stores/workspace";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Panel } from "./parts";

type RuleFileId = "beideMd" | "rulesMd";

interface RuleFileDef {
  id: RuleFileId;
  /** Workspace-relative path, read/written through window.beide.workspace. */
  path: string;
  labelKey: string;
}

// Mirrors getRulesCandidates(cwd) in electron/services/agent.ts — see
// docs/AGENT-RUNTIME.md. Both files are folded into the agent's system prompt.
const RULE_FILES: RuleFileDef[] = [
  { id: "beideMd", path: "BEIDE.md", labelKey: "settings.rulesBeideMd" },
  {
    id: "rulesMd",
    path: ".beide/rules.md",
    labelKey: "settings.rulesRulesMd",
  },
];

interface RuleFileState {
  content: string;
  /** Last content confirmed on disk — diffing against it drives the dirty flag. */
  saved: string;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

function emptyFileState(loading: boolean): RuleFileState {
  return { content: "", saved: "", loading, saving: false, error: null };
}

function initialFiles(): Record<RuleFileId, RuleFileState> {
  return {
    beideMd: emptyFileState(true),
    rulesMd: emptyFileState(true),
  };
}

export function RulesSection() {
  const { t } = useTranslation();
  const rootPath = useWorkspaceStore((s) => s.rootPath);
  const [active, setActive] = useState<RuleFileId>("beideMd");
  const [files, setFiles] = useState<Record<RuleFileId, RuleFileState>>(
    initialFiles,
  );

  useEffect(() => {
    if (!rootPath) {
      setFiles(initialFiles());
      return;
    }
    const api = getBeide();
    if (!api) return;
    let cancelled = false;
    setFiles(initialFiles());
    for (const def of RULE_FILES) {
      void (async () => {
        // A missing file is the common case (nothing authored yet) — treat
        // any read failure as a new, empty document rather than an error.
        let content = "";
        try {
          content = await api.workspace.readFile(def.path);
        } catch {
          content = "";
        }
        if (cancelled) return;
        setFiles((prev) => ({
          ...prev,
          [def.id]: {
            content,
            saved: content,
            loading: false,
            saving: false,
            error: null,
          },
        }));
      })();
    }
    return () => {
      cancelled = true;
    };
  }, [rootPath]);

  const setContent = useCallback((id: RuleFileId, content: string) => {
    setFiles((prev) => ({ ...prev, [id]: { ...prev[id], content } }));
  }, []);

  const save = useCallback((def: RuleFileDef) => {
    const api = getBeide();
    if (!api) return;
    setFiles((prev) => ({
      ...prev,
      [def.id]: { ...prev[def.id], saving: true, error: null },
    }));
    void (async () => {
      try {
        const content = files[def.id].content;
        await api.workspace.writeFile(def.path, content);
        setFiles((prev) => ({
          ...prev,
          [def.id]: { ...prev[def.id], saved: content, saving: false },
        }));
      } catch (e) {
        setFiles((prev) => ({
          ...prev,
          [def.id]: {
            ...prev[def.id],
            saving: false,
            error: e instanceof Error ? e.message : String(e),
          },
        }));
      }
    })();
  }, [files]);

  const disabled = !rootPath;

  return (
    <Panel
      icon={<IconFileText className="size-4" stroke={1.75} />}
      title={t("settings.rulesPanel")}
      description={t("settings.rulesPanelHint")}
    >
      {disabled ? (
        <div className="settings-empty">{t("settings.rulesNoWorkspace")}</div>
      ) : (
        <Tabs value={active} onValueChange={(v) => setActive(v as RuleFileId)}>
          <TabsList>
            {RULE_FILES.map((def) => {
              const state = files[def.id];
              const dirty = state.content !== state.saved;
              return (
                <TabsTrigger key={def.id} value={def.id}>
                  {t(def.labelKey)}
                  {dirty ? (
                    <span className="text-primary" aria-hidden>
                      {" "}
                      •
                    </span>
                  ) : null}
                </TabsTrigger>
              );
            })}
          </TabsList>
          {RULE_FILES.map((def) => {
            const state = files[def.id];
            const dirty = state.content !== state.saved;
            return (
              <TabsContent
                key={def.id}
                value={def.id}
                className="flex flex-col gap-2"
              >
                <textarea
                  className={cn(
                    "w-full min-w-0 resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 font-mono text-xs leading-relaxed transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30",
                  )}
                  rows={12}
                  spellCheck={false}
                  disabled={state.loading || state.saving}
                  value={state.content}
                  placeholder={t("settings.rulesPlaceholder")}
                  aria-label={t(def.labelKey)}
                  onChange={(e) => setContent(def.id, e.target.value)}
                />
                <div className="flex items-center justify-between gap-2">
                  {state.error ? (
                    <p className="settings-field__note text-destructive">
                      {state.error}
                    </p>
                  ) : (
                    <Badge variant="outline" className="font-normal">
                      {dirty
                        ? t("settings.rulesDirty")
                        : t("settings.rulesSaved")}
                    </Badge>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={state.loading || state.saving || !dirty}
                    onClick={() => save(def)}
                  >
                    {t("settings.rulesSaveAction")}
                  </Button>
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      )}
    </Panel>
  );
}
