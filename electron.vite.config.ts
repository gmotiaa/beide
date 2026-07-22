import { resolve } from "node:path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  main: {
    plugins: [
      externalizeDepsPlugin({
        // pi is ESM-only; keep external but load from ESM main
        exclude: [],
      }),
    ],
    build: {
      // ESM so require() is not used for @earendil-works/pi-coding-agent
      rollupOptions: {
        input: {
          index: resolve(__dirname, "electron/main.ts"),
        },
        output: {
          format: "es",
          entryFileNames: "[name].js",
        },
      },
    },
  },
  preload: {
    // preload must stay CJS for contextBridge in Electron
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, "electron/preload.ts"),
        },
        output: {
          format: "cjs",
          entryFileNames: "[name].cjs",
        },
      },
    },
  },
  renderer: {
    root: ".",
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, "index.html"),
        },
      },
    },
    resolve: {
      alias: {
        "@": resolve("src"),
      },
    },
    plugins: [react(), tailwindcss()],
  },
});
