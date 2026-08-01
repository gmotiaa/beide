import { app, BrowserWindow, dialog, nativeImage, shell } from "electron";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
// electron-updater is CJS; named imports break under the ESM main bundle.
import electronUpdater from "electron-updater";
import { createServices, disposeServices, registerIpc, type BeideServices } from "./ipc";

/**
 * Keys a .env is allowed to define. The file is picked up from `process.cwd()`,
 * which the app does not control, so importing it wholesale would let a stray
 * .env set things like ELECTRON_RENDERER_URL and decide what the window loads.
 */
// BEIDE_ADMIN_* and SUPABASE_SERVICE_ROLE_KEY are deliberately absent: only
// scripts/supabase-setup.mjs needs them and it reads .env itself. Loading them
// into the app's env would put admin credentials one `env` away from any child
// shell the agent drives.
const ENV_ALLOWLIST = new Set([
  "BEIDE_ECHOGATE_API_KEY",
  "BEIDE_OPEN_DEVTOOLS",
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
]);

// Load .env into process.env for main process (API keys, etc.)
function loadEnvFile(): void {
  const candidates = [
    join(process.cwd(), ".env"),
    join(app.getAppPath(), ".env"),
  ];
  for (const p of candidates) {
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf-8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i < 0) continue;
      const k = t.slice(0, i).trim();
      if (!ENV_ALLOWLIST.has(k)) continue;
      let v = t.slice(i + 1).trim();
      // KEY="value" / KEY='value' — dotenv convention; keeping the quotes
      // produces a key that fails provider auth with an opaque 401.
      if (v.length >= 2 && (v[0] === '"' || v[0] === "'") && v.endsWith(v[0])) {
        v = v.slice(1, -1);
      }
      if (!process.env[k]) process.env[k] = v;
    }
    return;
  }
}
loadEnvFile();

process.on("uncaughtException", (error) => {
  console.error("[Main Process Uncaught Exception]:", error);
});

process.on("unhandledRejection", (reason) => {
  console.error("[Main Process Unhandled Rejection]:", reason);
});

let mainWindow: BrowserWindow | null = null;
let services: BeideServices | null = null;

function resolveAppIcon(): string | undefined {
  const candidates = [
    // dev: project root
    join(process.cwd(), "build", "icon.png"),
    join(process.cwd(), "public", "icon.png"),
    // packaged / built relative to main
    join(__dirname, "../../build/icon.png"),
    join(__dirname, "../../public/icon.png"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return undefined;
}

/** True for the renderer's own document — dev server in dev, file:// when packaged. */
function isAppUrl(url: string, devUrl?: string): boolean {
  try {
    const target = new URL(url);
    if (devUrl) return target.origin === new URL(devUrl).origin;
    return target.protocol === "file:";
  } catch {
    return false;
  }
}

/**
 * `shell.openExternal` hands the URL to the OS, so a `file:` or custom-scheme
 * URL launches whatever is registered for it. Only ever open web links.
 */
function openExternalSafely(url: string): void {
  try {
    const { protocol } = new URL(url);
    if (protocol !== "http:" && protocol !== "https:") {
      console.warn(`[beide] blocked openExternal for scheme: ${protocol}`);
      return;
    }
    void shell.openExternal(url);
  } catch {
    /* malformed URL — ignore */
  }
}

function createWindow(): BrowserWindow {
  const iconPath = resolveAppIcon();
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    title: "beide",
    // Custom title bar (no native black chrome)
    frame: false,
    // Windows: keep rounded corners / shadow where supported
    thickFrame: true,
    backgroundColor: "#f7f7f8",
    show: false,
    autoHideMenuBar: true,
    ...(iconPath
      ? { icon: nativeImage.createFromPath(iconPath) }
      : {}),
    webPreferences: {
      // electron-vite: out/main/index.js → out/preload/index.js
      preload: join(__dirname, "../preload/index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.on("ready-to-show", () => {
    win.show();
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    openExternalSafely(url);
    return { action: "deny" };
  });

  // electron-vite sets ELECTRON_RENDERER_URL in dev
  const devUrl = process.env.ELECTRON_RENDERER_URL;

  // Without this, a link inside the app (or in agent-rendered markdown) can
  // navigate the window itself. The preload is re-injected into whatever loads,
  // handing `window.beide` — the whole filesystem/shell bridge — to a foreign
  // document. Only the app's own origin may occupy this window.
  win.webContents.on("will-navigate", (event, url) => {
    if (isAppUrl(url, devUrl)) return;
    event.preventDefault();
    openExternalSafely(url);
  });

  win.webContents.on("will-attach-webview", (event) => {
    event.preventDefault();
  });
  if (devUrl) {
    void win.loadURL(devUrl);
    if (process.env.BEIDE_OPEN_DEVTOOLS === "1") {
      win.webContents.openDevTools({ mode: "detach" });
    }
  } else {
    void win.loadFile(join(__dirname, "../renderer/index.html"));
  }

  return win;
}

/**
 * Auto-update against the generic feed configured in electron-builder.yml
 * (`publish.url` must serve latest.yml + the installers). Dev builds and
 * portable exes are skipped: only the NSIS install layout can be swapped.
 * Unsigned builds still update, but Windows shows the unknown-publisher
 * prompt on the swap — signing needs a real certificate (docs/KNOWN-GAPS.md).
 */
function setupAutoUpdate(): void {
  if (!app.isPackaged || process.env.PORTABLE_EXECUTABLE_FILE) return;
  const { autoUpdater } = electronUpdater;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on("update-downloaded", (info) => {
    const win = mainWindow;
    if (!win || win.isDestroyed()) return;
    void dialog
      .showMessageBox(win, {
        type: "info",
        title: "beide",
        message: `Доступно обновление ${info.version}`,
        detail: "Обновление скачано. Перезапустить сейчас или установить при выходе?",
        buttons: ["Перезапустить", "Позже"],
        defaultId: 0,
        cancelId: 1,
      })
      .then((r) => {
        if (r.response === 0) autoUpdater.quitAndInstall();
      });
  });
  autoUpdater.on("error", (error) => {
    // No update hosting yet is a normal state — never bother the user.
    console.warn("[beide updater]", error?.message ?? error);
  });
  void autoUpdater.checkForUpdates().catch(() => undefined);
}

function bootstrap(): void {
  if (services) {
    disposeServices(services);
    services = null;
  }
  services = createServices();

  mainWindow = createWindow();

  registerIpc(services, () => mainWindow);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// Single instance — second launch focuses the existing window
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    bootstrap();
    setupAutoUpdate();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        bootstrap();
      }
    });
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    if (services) {
      disposeServices(services);
      services = null;
    }
    app.quit();
  }
});

// `before-quit` fires before BrowserWindow close guards. Disposing here made
// the renderer's final transcript flush call into an already-dead service
// graph. Cleanup only once closing has actually been allowed.
app.on("will-quit", () => {
  if (services) {
    disposeServices(services);
    services = null;
  }
});
