/// <reference types="vite/client" />

import type { BeideApi } from "./lib/types";

declare global {
  interface Window {
    beide: BeideApi;
  }
}

export {};
