import * as React from "react";
import { Outlet, Route, Routes, useLocation } from "react-router-dom";

import { Footer } from "@/components/site/footer";
import { Header } from "@/components/site/header";
import Agent from "@/pages/Agent";
import Changelog from "@/pages/Changelog";
import Docs from "@/pages/Docs";
import Download from "@/pages/Download";
import Features from "@/pages/Features";
import Home from "@/pages/Home";
import NotFound from "@/pages/NotFound";
import Showcase from "@/pages/Showcase";

const TITLES: Record<string, string> = {
  "/": "beide — IDE с AI-агентом внутри",
  "/features": "Возможности — beide",
  "/agent": "Агент — beide",
  "/showcase": "Витрина — beide",
  "/docs": "Документация — beide",
  "/download": "Скачать — beide",
  "/changelog": "Обновления — beide",
};

/** Router does not reset scroll between routes; anchors keep their own jump. */
function ScrollToTop() {
  const { pathname, hash } = useLocation();

  React.useEffect(() => {
    if (hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname, hash]);

  React.useEffect(() => {
    document.title = TITLES[pathname] ?? "Страница не найдена — beide";
  }, [pathname]);

  return null;
}

function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <ScrollToTop />
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/features" element={<Features />} />
        <Route path="/agent" element={<Agent />} />
        <Route path="/showcase" element={<Showcase />} />
        <Route path="/docs" element={<Docs />} />
        <Route path="/download" element={<Download />} />
        <Route path="/changelog" element={<Changelog />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
