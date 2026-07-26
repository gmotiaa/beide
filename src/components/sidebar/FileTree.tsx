import { useCallback, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  IconCopy,
  IconEdit,
  IconFolderOpen,
  IconTrash,
} from "@tabler/icons-react";
import {
  BracesIcon,
  ChevronDownIcon,
  FileCodeIcon,
  FileIcon,
  FileTextIcon,
  FolderIcon,
  FolderOpenIcon,
  PaletteIcon,
} from "lucide-react";
import type { FileNode } from "../../lib/types";
import { cn } from "../../lib/utils";
import { useWorkspaceStore } from "../../stores/workspace";
import { useEditorStore } from "../../stores/editor";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

const INDENT = 16;

type FileVisualType =
  | "folder"
  | "ts"
  | "tsx"
  | "css"
  | "json"
  | "md"
  | "config"
  | "file";

function sortNodes(nodes: FileNode[]): FileNode[] {
  return [...nodes].sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

function getFileVisualType(node: FileNode): FileVisualType {
  if (node.type === "directory") return "folder";
  const name = node.name.toLowerCase();
  if (name.endsWith(".tsx")) return "tsx";
  if (name.endsWith(".ts") || name.endsWith(".mts") || name.endsWith(".cts"))
    return "ts";
  if (name.endsWith(".css") || name.endsWith(".scss") || name.endsWith(".sass"))
    return "css";
  if (name.endsWith(".json") || name.endsWith(".jsonc")) return "json";
  if (name.endsWith(".md") || name.endsWith(".mdx")) return "md";
  if (
    name.endsWith(".ico") ||
    name.endsWith(".png") ||
    name.endsWith(".svg") ||
    name.startsWith(".") ||
    name.endsWith(".config.js") ||
    name.endsWith(".config.ts") ||
    name.endsWith(".config.mjs")
  ) {
    return "config";
  }
  return "file";
}

function getFileIcon(
  type: FileVisualType,
  isExpanded?: boolean
): ReactNode {
  // No raw Tailwind palette here — the tree keys its file-type tints off the
  // theme tokens (themes.css) so they follow light/dark/midnight.
  if (type === "folder") {
    return isExpanded ? (
      <FolderOpenIcon className="pointer-events-none size-4 text-[color:var(--warning)] shrink-0" />
    ) : (
      <FolderIcon className="pointer-events-none size-4 text-[color:var(--warning)] shrink-0" />
    );
  }
  if (type === "tsx" || type === "ts") {
    return (
      <FileCodeIcon className="pointer-events-none size-4 text-[color:var(--accent)] shrink-0" />
    );
  }
  if (type === "css") {
    return (
      <PaletteIcon className="pointer-events-none size-4 text-[color:var(--success)] shrink-0" />
    );
  }
  if (type === "json") {
    return (
      <BracesIcon className="pointer-events-none size-4 text-[color:var(--warning)] shrink-0" />
    );
  }
  if (type === "md") {
    return (
      <FileTextIcon className="text-muted-foreground pointer-events-none size-4 shrink-0" />
    );
  }
  return (
    <FileIcon className="text-muted-foreground pointer-events-none size-4 shrink-0" />
  );
}

interface TreeItemProps {
  node: FileNode;
  depth: number;
  onRename: (node: FileNode) => void;
  onDelete: (node: FileNode) => void;
  onCopyPath: (path: string) => void;
  onRevealInFolder: (path: string) => void;
}

function TreeItem({
  node,
  depth,
  onRename,
  onDelete,
  onCopyPath,
  onRevealInFolder,
}: TreeItemProps) {
  const { t } = useTranslation();
  const expanded = useWorkspaceStore((s) => !!s.expanded[node.path]);
  const childrenCache = useWorkspaceStore((s) => s.childrenCache);
  const toggleDir = useWorkspaceStore((s) => s.toggleDir);
  const openFile = useEditorStore((s) => s.openFile);
  const activePath = useEditorStore((s) => s.activePath);

  const rawChildren =
    node.children ??
    childrenCache[node.path] ??
    (expanded ? [] : undefined);
  const children = rawChildren ? sortNodes(rawChildren) : undefined;
  const isFolder = node.type === "directory";
  const isActive = activePath === node.path;
  const visualType = getFileVisualType(node);

  const onClick = useCallback(() => {
    if (node.type === "directory") {
      void toggleDir(node.path);
    } else {
      void openFile(node.path);
    }
  }, [node.path, node.type, toggleDir, openFile]);

  return (
    <div>
      <ContextMenu>
        <ContextMenuTrigger className="w-full">
          <button
            type="button"
            data-slot="tree-item"
            data-folder={isFolder || undefined}
            data-selected={isActive || undefined}
            aria-expanded={isFolder ? expanded : undefined}
            title={node.path}
            style={{ paddingLeft: depth * INDENT }}
            className="group z-10 w-full outline-hidden select-none py-0.5 focus-visible:ring-1 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:rounded-md"
            onClick={onClick}
          >
            <span
              data-slot="tree-item-label"
              className={cn(
                "relative flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-all duration-150",
                "hover:bg-accent/40 hover:text-accent-foreground",
                "[&_svg]:pointer-events-none [&_svg]:shrink-0",
                isActive && "bg-accent/80 font-medium text-accent-foreground shadow-xs glow-border-subtle",
                !isFolder && "ps-6"
              )}
            >
              {isFolder && (
                <ChevronDownIcon
                  className={cn(
                    "text-muted-foreground size-3.5 shrink-0 transition-transform duration-150",
                    !expanded && "-rotate-90"
                  )}
                />
              )}
              <span className="flex min-w-0 items-center gap-2">
                {getFileIcon(visualType, expanded)}
                <span className="truncate">{node.name}</span>
              </span>
            </span>
          </button>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-52">
          {/* Base UI's GroupLabel reads MenuGroupContext and throws when it is
              missing, which took the whole renderer down on every right click.
              The label has to sit inside a Group. */}
          <ContextMenuGroup>
            <ContextMenuLabel className="truncate font-normal text-muted-foreground">
              {node.name}
            </ContextMenuLabel>
          </ContextMenuGroup>
          <ContextMenuSeparator />
          {!isFolder && (
            <ContextMenuItem
              onClick={() => {
                void openFile(node.path);
              }}
            >
              <IconFolderOpen size={14} className="mr-1.5" />
              {t("fileTree.openFile")}
            </ContextMenuItem>
          )}
          <ContextMenuItem onClick={() => onRename(node)}>
            <IconEdit size={14} className="mr-1.5" />
            {t("fileTree.rename")}
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onCopyPath(node.path)}>
            <IconCopy size={14} className="mr-1.5" />
            {t("fileTree.copyPath")}
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onRevealInFolder(node.path)}>
            <IconFolderOpen size={14} className="mr-1.5" />
            {t("fileTree.reveal")}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            variant="destructive"
            onClick={() => onDelete(node)}
          >
            <IconTrash size={14} className="mr-1.5" />
            {t("fileTree.delete")}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {isFolder && expanded && children && (
        <div className="relative flex flex-col before:absolute before:left-[11px] before:top-0 before:bottom-0 before:w-px before:bg-border/40">
          {children.map((child) => (
            <TreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              onRename={onRename}
              onDelete={onDelete}
              onCopyPath={onCopyPath}
              onRevealInFolder={onRevealInFolder}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FileTree() {
  const { t } = useTranslation();
  const rootPath = useWorkspaceStore((s) => s.rootPath);
  const tree = useWorkspaceStore((s) => s.tree);
  const loading = useWorkspaceStore((s) => s.loading);
  const openFolder = useWorkspaceStore((s) => s.openFolder);
  const deletePath = useWorkspaceStore((s) => s.deletePath);
  const renamePath = useWorkspaceStore((s) => s.renamePath);
  const revealInFolder = useWorkspaceStore((s) => s.revealInFolder);

  const [deleteTarget, setDeleteTarget] = useState<FileNode | null>(null);
  const [renameTarget, setRenameTarget] = useState<FileNode | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCopyPath = useCallback(async (path: string) => {
    try {
      await navigator.clipboard.writeText(path);
    } catch {
      /* ignore */
    }
  }, []);

  const handleRevealInFolder = useCallback(
    (path: string) => {
      void revealInFolder(path);
    },
    [revealInFolder]
  );

  const handleStartRename = useCallback((node: FileNode) => {
    setRenameTarget(node);
    setRenameValue(node.name);
    setError(null);
  }, []);

  const handleStartDelete = useCallback((node: FileNode) => {
    setDeleteTarget(node);
    setError(null);
  }, []);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    setError(null);
    try {
      await deletePath(deleteTarget.path);
      setDeleteTarget(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const confirmRename = async () => {
    if (!renameTarget || !renameValue.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await renamePath(renameTarget.path, renameValue.trim());
      setRenameTarget(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!rootPath) {
    return (
      <div className="editor-empty" style={{ padding: 20 }}>
        <p>{t("sidebar.noWorkspace")}</p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void openFolder()}
        >
          {t("common.openFolder")}
        </button>
      </div>
    );
  }

  if (loading) {
    return <div className="search-empty">{t("common.loading")}</div>;
  }

  if (!tree.length) {
    return <div className="search-empty">{t("sidebar.emptyFolder")}</div>;
  }

  const sorted = sortNodes(tree);

  return (
    <div
      className="file-tree scrollbar-custom flex flex-col overflow-y-auto px-1.5 py-1"
      data-slot="tree"
      style={{ "--tree-indent": `${INDENT}px` } as React.CSSProperties}
    >
      {sorted.map((node) => (
        <TreeItem
          key={node.path}
          node={node}
          depth={0}
          onRename={handleStartRename}
          onDelete={handleStartDelete}
          onCopyPath={handleCopyPath}
          onRevealInFolder={handleRevealInFolder}
        />
      ))}

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("fileTree.deleteTitle")}</DialogTitle>
          </DialogHeader>
          <div>
            <p className="text-sm text-muted-foreground">
              {deleteTarget?.type === "directory"
                ? t("fileTree.deleteFolderWarning")
                : t("fileTree.deleteFileWarning")}
            </p>
            <p className="mt-2 font-mono text-sm text-foreground break-all">
              {deleteTarget?.path}
            </p>
            {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <DialogClose
              render={<Button type="button" variant="secondary" disabled={busy} />}
            >
              {t("common.cancel")}
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              disabled={busy}
              onClick={() => void confirmDelete()}
            >
              {busy && <Spinner size="sm" />}
              {t("fileTree.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(renameTarget)}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("fileTree.rename")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="file-tree-rename-input">{t("fileTree.newName")}</Label>
            <Input
              id="file-tree-rename-input"
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void confirmRename();
                }
              }}
            />
            {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <DialogClose
              render={<Button type="button" variant="secondary" disabled={busy} />}
            >
              {t("common.cancel")}
            </DialogClose>
            <Button
              type="button"
              disabled={!renameValue.trim() || busy}
              onClick={() => void confirmRename()}
            >
              {busy && <Spinner size="sm" />}
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
