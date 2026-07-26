/// <reference types="vite/client" />

import type { BeideApi } from "./lib/types";

declare global {
  interface Window {
    beide: BeideApi;
  }

  // Merged here from the former src/vite-env.d.ts — two ambient files both
  // referencing vite/client and both augmenting ImportMeta was redundant.
  interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL?: string;
    readonly VITE_SUPABASE_ANON_KEY?: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

export {};
