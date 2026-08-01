import * as React from "react";

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

function PageEffects({ pathname }: { pathname: string }) {
  React.useEffect(() => {
    if (window.location.hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);

  React.useEffect(() => {
    document.title = TITLES[pathname] ?? "Страница не найдена — beide";
  }, [pathname]);

  return null;
}

const PAGES: Record<string, React.ComponentType> = {
  "/": Home,
  "/features": Features,
  "/agent": Agent,
  "/showcase": Showcase,
  "/docs": Docs,
  "/download": Download,
  "/changelog": Changelog,
};

function normalizePathname(pathname: string): string {
  const normalized = pathname.replace(/\/+$/, "");
  return normalized || "/";
}

export default function App() {
  const pathname = normalizePathname(window.location.pathname);
  const Page = PAGES[pathname] ?? NotFound;

  return (
    <div className="flex min-h-screen flex-col">
      <PageEffects pathname={pathname} />
      <Header />
      <main className="flex-1">
        <Page />
      </main>
      <Footer />
    </div>
  );
}
