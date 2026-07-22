import { app, BrowserWindow, nativeImage, shell } from "electron";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createServices, disposeServices, registerIpc, type BeideServices } from "./ipc";

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
    void shell.openExternal(url);
    return { action: "deny" };
  });

  // electron-vite sets ELECTRON_RENDERER_URL in dev
  const devUrl = process.env.ELECTRON_RENDERER_URL;
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

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        bootstrap();
      }
    });
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    if (services) disposeServices(services);
    app.quit();
  }
});

app.on("before-quit", () => {
  if (services) {
    disposeServices(services);
    services = null;
  }
});
