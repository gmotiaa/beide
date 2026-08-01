import { useState } from "react";
import { useTranslation } from "react-i18next";
import { IconFolder } from "@tabler/icons-react";
import {
  getRecentProjects,
  projectFolderName,
} from "../../lib/recent-projects";
import { useWorkspaceStore } from "../../stores/workspace";

/**
 * Recent workspaces on the welcome screen (no folder open). Clicking an entry
 * opens that root through the same flow as the folder picker; a stale path
 * simply fails there and surfaces via the workspace store's `error`.
 */
export function RecentProjects() {
  const { t } = useTranslation();
  const openFolderPath = useWorkspaceStore((s) => s.openFolderPath);
  const loading = useWorkspaceStore((s) => s.loading);
  // Read once per mount: the list only changes on a successful open, which
  // replaces this screen with the editor anyway.
  const [projects] = useState(() => getRecentProjects());

  if (projects.length === 0) return null;

  return (
    <div className="w-full text-left">
      <div className="px-2.5 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {t("welcome.recentProjects")}
      </div>
      <ul className="flex flex-col">
        {projects.map((path) => (
          <li key={path}>
            <button
              type="button"
              disabled={loading}
              title={path}
              onClick={() => void openFolderPath(path)}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
            >
              <IconFolder size={16} stroke={1.75} className="shrink-0 text-primary" />
              <span className="shrink-0 font-medium">
                {projectFolderName(path)}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                {path}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
