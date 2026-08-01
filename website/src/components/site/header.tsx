import * as React from "react";
import { Download, Github, Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Container } from "@/components/site/layout-primitives";
import { Logo } from "@/components/site/logo";
import { NAV, SITE } from "@/data/site";
import { cn } from "@/lib/utils";

export function Header() {
  const [scrolled, setScrolled] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const pathname = window.location.pathname.replace(/\/+$/, "") || "/";

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-colors duration-300",
        scrolled
          ? "border-b border-border bg-background/80 backdrop-blur-xl"
          : "border-b border-transparent"
      )}
    >
      <Container className="flex h-16 items-center justify-between gap-6">
        <a href="/" aria-label="beide — на главную">
          <Logo />
        </a>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <a
              key={item.to}
              href={item.to}
              aria-current={pathname === item.to ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-2 text-sm transition-colors",
                pathname === item.to
                  ? "text-foreground bg-panel-hover"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="hidden sm:inline-flex"
          >
            <a
              href={SITE.repo}
              target="_blank"
              rel="noreferrer noopener"
              aria-label="Репозиторий на GitHub"
            >
              <Github />
            </a>
          </Button>

          <Button asChild size="sm" className="hidden sm:inline-flex">
            <a href="/download">
              <Download />
              Скачать
            </a>
          </Button>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu />
                <span className="sr-only">Меню</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle>
                  <Logo />
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 px-4">
                {NAV.map((item) => (
                  <SheetClose asChild key={item.to}>
                    <a
                      href={item.to}
                      aria-current={pathname === item.to ? "page" : undefined}
                      className={cn(
                        "rounded-md px-3 py-2.5 text-[15px] transition-colors",
                        pathname === item.to
                          ? "text-foreground bg-panel-hover"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {item.label}
                    </a>
                  </SheetClose>
                ))}
              </nav>
              <div className="mt-auto flex flex-col gap-2 p-6">
                <Button asChild>
                  <a href="/download">
                    <Download />
                    Скачать beide
                  </a>
                </Button>
                <Button asChild variant="outline">
                  <a href={SITE.repo} target="_blank" rel="noreferrer noopener">
                    <Github />
                    GitHub
                  </a>
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </Container>
    </header>
  );
}
