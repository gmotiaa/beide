import { Github } from "lucide-react";

import WaveBg from "@/components/originkit/pulse-lines";
import { Container } from "@/components/site/layout-primitives";
import { Logo } from "@/components/site/logo";
import { NAV, SITE } from "@/data/site";

const SECONDARY = [
  { label: "Скачать", to: "/download" },
  { label: "Установка", to: "/docs#install" },
  { label: "Подключение моделей", to: "/docs#auth" },
  { label: "Разрешения и откат", to: "/docs#safety" },
];

export function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-border">
      {/* Pulse Lines — тихий фон, а не главный герой: полосы уходят вниз под контент. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-56 opacity-30"
      >
        <WaveBg
          type="vertical"
          shape="line"
          speed={70}
          lineWidth={2}
          gap={26}
          scale={2.4}
          backgroundColor="transparent"
          lineColor="#232728"
          colors={{
            paletteCount: 3,
            color1: "#4fa88f",
            color2: "#6bc0a8",
            color3: "#2b2f31",
          }}
        />
      </div>

      <Container className="relative z-10 py-16">
        <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr]">
          <div className="flex flex-col gap-4">
            <Logo />
            <p className="text-muted-foreground max-w-xs text-sm leading-relaxed">
              {SITE.claim}. Открытый исходный код, лицензия {SITE.license}.
            </p>
            <a
              href={SITE.repo}
              target="_blank"
              rel="noreferrer noopener"
              className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-2 text-sm transition-colors"
            >
              <Github className="size-4" />
              GitHub
            </a>
          </div>

          <nav className="flex flex-col gap-3">
            <p className="text-foreground text-sm font-medium">Продукт</p>
            {NAV.map((item) => (
              <a
                key={item.to}
                href={item.to}
                className="text-muted-foreground hover:text-foreground w-fit text-sm transition-colors"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <nav className="flex flex-col gap-3">
            <p className="text-foreground text-sm font-medium">Начать</p>
            {SECONDARY.map((item) => (
              <a
                key={item.to}
                href={item.to}
                className="text-muted-foreground hover:text-foreground w-fit text-sm transition-colors"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>

        <div className="border-border text-muted-foreground mt-12 flex flex-col gap-2 border-t pt-6 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {SITE.name} — {SITE.license} License
          </p>
          <p className="font-mono">
            v{SITE.version} · Windows 10/11 · Node.js 22+
          </p>
        </div>
      </Container>
    </footer>
  );
}
