import { ArrowRight, Plus, RefreshCw, Wrench } from "lucide-react";

import {
  Container,
  GridLines,
  Section,
  SectionHeader,
} from "@/components/site/layout-primitives";
import { RainBackdrop } from "@/components/site/rain-backdrop";
import { Reveal } from "@/components/site/reveal";
import { ScrambleHeadline } from "@/components/site/scramble-headline";
import { ShinyBadge } from "@/components/site/shiny-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CHANGELOG, SITE } from "@/data/site";

const KIND = {
  add: { label: "Добавлено", icon: Plus, className: "text-success" },
  fix: { label: "Исправлено", icon: Wrench, className: "text-warning" },
  change: { label: "Изменено", icon: RefreshCw, className: "text-primary" },
} as const;

export default function Changelog() {
  return (
    <>
      <section className="relative overflow-hidden pt-32 pb-12">
        <GridLines />
        {/* Ascii Rain — «лента коммитов» вдоль правого края. */}
        <RainBackdrop
          className="left-auto w-[34%] opacity-[0.12]"
          angle={0}
          glyphSize={12}
          speed={2.2}
          density={18}
          trail={20}
          fade="edges"
        />
        <Container className="relative z-10">
          <div className="flex max-w-2xl flex-col items-start gap-5">
            <ShinyBadge dot>Обновления</ShinyBadge>
            <ScrambleHeadline
              text="Обновления"
              height={64}
              fontSize={48}
              weight={600}
            />
            <p className="text-muted-foreground text-[15px] leading-relaxed sm:text-lg">
              История релизов beide. Полный список коммитов — в репозитории.
            </p>
          </div>
        </Container>
      </section>

      <Section className="pt-4 sm:pt-4">
        <Container>
          <div className="flex flex-col gap-12">
            {CHANGELOG.map((entry, i) => (
              <Reveal key={entry.version} delay={i * 80}>
                <div className="grid gap-6 lg:grid-cols-[200px_1fr] lg:gap-12">
                  <div className="flex flex-col gap-2 lg:sticky lg:top-24 lg:h-fit">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-lg font-semibold">
                        v{entry.version}
                      </span>
                      {entry.status === "current" ? (
                        <Badge variant="accent">актуальная</Badge>
                      ) : null}
                    </div>
                    <span className="text-faint font-mono text-xs">
                      {entry.date}
                    </span>
                    <p className="text-muted-foreground text-sm">
                      {entry.title}
                    </p>
                  </div>

                  <ul className="border-border flex flex-col divide-y divide-border rounded-xl border">
                    {entry.items.map((item) => {
                      const meta = KIND[item.kind];
                      const Icon = meta.icon;
                      return (
                        <li
                          key={item.text}
                          className="flex items-start gap-3 px-5 py-3.5"
                        >
                          <Icon
                            className={`mt-0.5 size-4 shrink-0 ${meta.className}`}
                          />
                          <span className="text-muted-foreground text-sm leading-relaxed">
                            {item.text}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>
        </Container>
      </Section>

      <Section className="border-border border-t">
        <Container>
          <SectionHeader
            align="center"
            eyebrow="Дальше"
            title="Следите за релизами на GitHub"
            description="Там же можно предложить идею или сообщить о баге."
          />
          <div className="mt-8 flex justify-center gap-3">
            <Button asChild>
              <a href={SITE.releases} target="_blank" rel="noreferrer noopener">
                Релизы
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href="/download">
                Установить
                <ArrowRight />
              </a>
            </Button>
          </div>
        </Container>
      </Section>
    </>
  );
}
