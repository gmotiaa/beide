import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  Button,
  Input,
  Label,
  Modal,
  TextField,
} from "@heroui/react";
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

const INDENT = 20;

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
  if (type === "folder") {
    return isExpanded ? (
      <FolderOpenIcon className="pointer-events-none size-4 text-amber-500" />
    ) : (
      <FolderIcon className="pointer-events-none size-4 text-amber-500" />
    );
  }
  if (type === "tsx" || type === "ts") {
    return (
      <FileCodeIcon className="pointer-events-none size-4 text-blue-500" />
    );
  }
  if (type === "css") {
    return (
      <PaletteIcon className="pointer-events-none size-4 text-purple-500" />
    );
  }
  if (type === "json") {
    return (
      <BracesIcon className="pointer-events-none size-4 text-yellow-500" />
    );
  }
  if (type === "md") {
    return (
      <FileTextIcon className="text-muted-foreground pointer-events-none size-4" />
    );
  }
  return (
    <FileIcon className="text-muted-foreground pointer-events-none size-4" />
  );
}

interface CtxMenu {
  x: number;
  y: number;
  node: FileNode;
}

interface TreeItemProps {
  node: FileNode;
  depth: number;
  onContext: (e: React.MouseEvent, node: FileNode) => void;
}

function TreeItem({ node, depth, onContext }: TreeItemProps) {
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
      <button
        type="button"
        data-slot="tree-item"
        data-folder={isFolder || undefined}
        data-selected={isActive || undefined}
        aria-expanded={isFolder ? expanded : undefined}
        title={node.path}
        style={{ paddingLeft: depth * INDENT }}
        className="z-10 w-full outline-hidden select-none not-last:pb-0.5 focus:z-20"
        onClick={onClick}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onContext(e, node);
        }}
      >
        <span
          data-slot="tree-item-label"
          className={cn(
            "relative flex w-full items-center gap-1 rounded-md bg-background px-2 py-1.5 text-sm transition-colors",
            "before:bg-background before:absolute before:inset-x-0 before:-inset-y-0.5 before:-z-10",
            "hover:bg-accent",
            "[&_svg]:pointer-events-none [&_svg]:shrink-0",
            isActive && "bg-accent text-accent-foreground",
            !isFolder && "ps-7"
          )}
        >
          {isFolder && (
            <ChevronDownIcon
              className={cn(
                "text-muted-foreground size-4 shrink-0 transition-transform",
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
      {isFolder && expanded && children && (
        <div className="flex flex-col">
          {children.map((child) => (
            <TreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              onContext={onContext}
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
  const openFile = useEditorStore((s) => s.openFile);

  const [menu, setMenu] = useState<CtxMenu | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FileNode | null>(null);
  const [renameTarget, setRenameTarget] = useState<FileNode | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const onContext = useCallback((e: React.MouseEvent, node: FileNode) => {
    setMenu({ x: e.clientX, y: e.clientY, node });
    setError(null);
  }, []);

  useEffect(() => {
    if (!menu) return;
    const close = (ev: MouseEvent) => {
      if (menuRef.current?.contains(ev.target as Node)) return;
      setMenu(null);
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setMenu(null);
    };
    window.addEventListener("mousedown", close, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("mousedown", close, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [menu]);

  const copyPath = async (path: string) => {
    try {
      await navigator.clipboard.writeText(path);
    } catch {
      /* ignore */
    }
    setMenu(null);
  };

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
      className="file-tree flex flex-col px-1.5 py-0.5"
      data-slot="tree"
      style={{ "--tree-indent": `${INDENT}px` } as React.CSSProperties}
      onContextMenu={(e) => {
        e.preventDefault();
      }}
    >
      {sorted.map((node) => (
        <TreeItem key={node.path} node={node} depth={0} onContext={onContext} />
      ))}

      {menu && (
        <div
          ref={menuRef}
          className="file-ctx-menu"
          style={{ left: menu.x, top: menu.y }}
          role="menu"
        >
          <div className="file-ctx-menu__header" title={menu.node.path}>
            {menu.node.name}
          </div>
          {menu.node.type === "file" && (
            <button
              type="button"
              className="file-ctx-menu__item"
              role="menuitem"
              onClick={() => {
                void openFile(menu.node.path);
                setMenu(null);
              }}
            >
              <IconFolderOpen size={15} stroke={1.75} />
              Открыть
            </button>
          )}
          <button
            type="button"
            className="file-ctx-menu__item"
            role="menuitem"
            onClick={() => {
              setRenameTarget(menu.node);
              setRenameValue(menu.node.name);
              setMenu(null);
            }}
          >
            <IconEdit size={15} stroke={1.75} />
            Переименовать
          </button>
          <button
            type="button"
            className="file-ctx-menu__item"
            role="menuitem"
            onClick={() => {
              void copyPath(menu.node.path);
            }}
          >
            <IconCopy size={15} stroke={1.75} />
            Копировать путь
          </button>
          <button
            type="button"
            className="file-ctx-menu__item"
            role="menuitem"
            onClick={() => {
              void revealInFolder(menu.node.path);
              setMenu(null);
            }}
          >
            <IconFolderOpen size={15} stroke={1.75} />
            Показать в проводнике
          </button>
          <div className="file-ctx-menu__sep" />
          <button
            type="button"
            className="file-ctx-menu__item file-ctx-menu__item--danger"
            role="menuitem"
            onClick={() => {
              setDeleteTarget(menu.node);
              setMenu(null);
            }}
          >
            <IconTrash size={15} stroke={1.75} />
            Удалить
          </button>
        </div>
      )}

      <AlertDialog.Backdrop
        isOpen={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialog.Container>
          <AlertDialog.Dialog className="sm:max-w-md">
            <AlertDialog.CloseTrigger />
            <AlertDialog.Header>
              <AlertDialog.Heading>Удалить?</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p className="text-sm text-muted">
                {deleteTarget?.type === "directory"
                  ? "Папка и всё содержимое будут удалены безвозвратно:"
                  : "Файл будет удалён безвозвратно:"}
              </p>
              <p className="mt-2 font-mono text-sm text-foreground break-all">
                {deleteTarget?.path}
              </p>
              {error && <p className="mt-2 text-sm text-danger">{error}</p>}
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button slot="close" variant="secondary" isDisabled={busy}>
                Отмена
              </Button>
              <Button
                variant="danger"
                isPending={busy}
                onPress={() => void confirmDelete()}
              >
                Удалить
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>

      <Modal.Backdrop
        isOpen={Boolean(renameTarget)}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null);
        }}
      >
        <Modal.Container size="sm" placement="center">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>Переименовать</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <TextField
                fullWidth
                value={renameValue}
                onChange={setRenameValue}
                variant="secondary"
              >
                <Label>Новое имя</Label>
                <Input
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void confirmRename();
                    }
                  }}
                />
              </TextField>
              {error && <p className="mt-2 text-sm text-danger">{error}</p>}
            </Modal.Body>
            <Modal.Footer>
              <Button slot="close" variant="secondary" isDisabled={busy}>
                Отмена
              </Button>
              <Button
                isDisabled={!renameValue.trim() || busy}
                isPending={busy}
                onPress={() => void confirmRename()}
              >
                Сохранить
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </div>
  );
}
