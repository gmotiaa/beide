import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/global.css";
import "./styles/shell.css";
import "./styles/onboarding.css";
import "./styles/intro.css";
import "./i18n";
import "./monaco-setup";

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("#root element missing");
}

createRoot(rootEl).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
