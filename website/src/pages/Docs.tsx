import * as React from "react";

import { CodeBlock } from "@/components/site/code-block";
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { DOCS, FAQ } from "@/data/site";
import { cn } from "@/lib/utils";

export default function Docs() {
  const hash = window.location.hash;
  const [active, setActive] = React.useState(DOCS[0].id);

  React.useEffect(() => {
    const id = hash.replace("#", "");
    if (!id) return;
    setActive(id);

    // Smooth scrolling started from an effect gets cancelled by the layout that
    // still settles around it (web fonts, reveal transitions), so jump instantly
    // and re-pin once the page has stopped moving.
    const jump = () => {
      const node = document.getElementById(id);
      if (!node) return;
      window.scrollTo({
        top: node.getBoundingClientRect().top + window.scrollY - 96,
        behavior: "instant" as ScrollBehavior,
      });
    };

    const raf = window.requestAnimationFrame(jump);
    const timer = window.setTimeout(jump, 260);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, [hash]);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible?.target.id) setActive(visible.target.id);
      },
      { rootMargin: "-96px 0px -70% 0px", threshold: 0 }
    );
    DOCS.forEach((section) => {
      const node = document.getElementById(section.id);
      if (node) observer.observe(node);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <section className="relative overflow-hidden pt-32 pb-12">
        <GridLines />
        {/* Ascii Rain — тонкий поток вдоль левого поля. */}
        <RainBackdrop
          className="right-auto w-[30%] opacity-[0.1]"
          angle={-6}
          glyphSize={12}
          speed={2}
          density={16}
          trail={22}
          fade="edges"
        />
        <Container className="relative z-10">
          <div className="flex max-w-2xl flex-col items-start gap-5">
            <ShinyBadge>Документация</ShinyBadge>
            <ScrambleHeadline
              text="Документация"
              height={64}
              fontSize={48}
              weight={600}
            />
            <p className="text-muted-foreground text-[15px] leading-relaxed sm:text-lg">
              Короткое практическое руководство: как собрать, чем подключить
              модели, как удержать агента в рамках.
            </p>
          </div>
        </Container>
      </section>

      <Section className="pt-6 sm:pt-6">
        <Container>
          <div className="grid gap-12 lg:grid-cols-[200px_1fr]">
            {/* оглавление */}
            <nav className="hidden lg:block">
              <div className="sticky top-24 flex flex-col gap-1">
                <p className="text-faint mb-2 font-mono text-xs tracking-widest uppercase">
                  Разделы
                </p>
                {DOCS.map((section) => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-sm transition-colors",
                      active === section.id
                        ? "bg-panel-hover text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {section.title}
                  </a>
                ))}
              </div>
            </nav>

            <div className="flex min-w-0 flex-col gap-16">
              {DOCS.map((section) => (
                <article
                  key={section.id}
                  id={section.id}
                  className="scroll-mt-24"
                >
                  <Reveal>
                    <div className="flex flex-col gap-2">
                      <h2 className="text-2xl font-semibold tracking-tight">
                        {section.title}
                      </h2>
                      <p className="text-muted-foreground text-sm">
                        {section.blurb}
                      </p>
                    </div>

                    <div className="mt-6 flex flex-col gap-5">
                      {section.blocks.map((block, i) => (
                        <div key={i} className="flex flex-col gap-3">
                          {block.heading ? (
                            <h3 className="text-[15px] font-medium">
                              {block.heading}
                            </h3>
                          ) : null}
                          {block.text ? (
                            <p className="text-muted-foreground text-[15px] leading-relaxed">
                              {block.text}
                            </p>
                          ) : null}
                          {block.list ? (
                            <ul className="flex flex-col gap-2">
                              {block.list.map((item) => (
                                <li
                                  key={item}
                                  className="text-muted-foreground flex gap-3 text-[15px] leading-relaxed"
                                >
                                  <span className="bg-primary mt-2.5 size-1.5 shrink-0 rounded-full" />
                                  {item}
                                </li>
                              ))}
                            </ul>
                          ) : null}
                          {block.code ? <CodeBlock code={block.code} /> : null}
                        </div>
                      ))}
                    </div>
                  </Reveal>
                </article>
              ))}
            </div>
          </div>
        </Container>
      </Section>

      <Section className="border-border border-t">
        <Container className="max-w-3xl">
          <SectionHeader
            eyebrow="FAQ"
            title="Частые вопросы"
            description="Если ответа нет — заведите issue в репозитории."
          />
          <Accordion type="single" collapsible className="mt-10">
            {FAQ.map((item) => (
              <AccordionItem key={item.q} value={item.q}>
                <AccordionTrigger>{item.q}</AccordionTrigger>
                <AccordionContent>{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Container>
      </Section>
    </>
  );
}
