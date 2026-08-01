import { ArrowRight, Check, Download, Github, X } from "lucide-react";

import AsciiFire from "@/components/originkit/ascii-flame";
import Orb from "@/components/originkit/cosmic-orb";
import EyeTicker from "@/components/originkit/eye-gallery";
import ElectricBorder from "@/components/originkit/electric-border";
import { AppPreview } from "@/components/site/app-preview";
import {
  Container,
  Eyebrow,
  GridLines,
  Section,
  SectionHeader,
} from "@/components/site/layout-primitives";
import { MagneticCta } from "@/components/site/magnetic-cta";
import { PixelFeatureCard } from "@/components/site/pixel-feature-card";
import { RainBackdrop } from "@/components/site/rain-backdrop";
import { Reveal } from "@/components/site/reveal";
import { ScrambleHeadline } from "@/components/site/scramble-headline";
import { ShinyBadge } from "@/components/site/shiny-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EYE_BOTTOM, EYE_TOP } from "@/data/shots";
import { FEATURES, METRICS, MODES, SITE, WORKFLOW } from "@/data/site";

const BOOT_LINES = [
  { prompt: "$", text: "git clone github.com/Gmotia/beide" },
  { prompt: "$", text: "npm install" },
  { prompt: "$", text: "npm run dev" },
];

export default function Home() {
  return (
    <>
      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-32 pb-16 sm:pt-40">
        <GridLines />

        {/* Ascii Rain — «поток кода» позади всего блока. */}
        <RainBackdrop
          className="opacity-[0.16]"
          angle={14}
          glyphSize={13}
          speed={3}
          density={22}
          trail={16}
          fade="bottom"
        />

        {/* Cosmic Orb — источник света, сдвинутый за плечо заголовка. */}
        <div
          aria-hidden
          className="pointer-events-none absolute top-[-220px] left-1/2 -translate-x-1/2 opacity-60 blur-[3px] sm:top-[-260px]"
        >
          <Orb
            size={720}
            archetype="spiral"
            background="#141618"
            speed={22}
            spin={30}
            lens
            lensAmount={42}
            palette={{
              anchor: "#4fa88f",
              colorA: "#6bc0a8",
              colorB: "#2f6d5d",
              colorC: "#d2a047",
            }}
            style={{ width: 720, height: 720 }}
          />
        </div>
        <div
          aria-hidden
          className="from-background/30 via-background/85 to-background pointer-events-none absolute inset-0 bg-gradient-to-b"
        />

        <Container className="relative z-10">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
            <Reveal>
              <ShinyBadge dot>{`v${SITE.version} · Windows · ${SITE.license}`}</ShinyBadge>
            </Reveal>

            <Reveal delay={60} className="w-full">
              {/* Scramble Text — имя продукта собирается из шума. */}
              <ScrambleHeadline
                text="beide"
                align="center"
                height={104}
                fontSize={96}
                weight={700}
                letterSpacing="-0.03em"
                color="#e9e7e2"
              />
            </Reveal>

            <Reveal delay={120}>
              <h1 className="text-balance text-3xl leading-tight font-semibold tracking-tight sm:text-5xl">
                IDE, в которой агент{" "}
                <span className="text-primary">правит код</span>, а не советует
              </h1>
            </Reveal>

            <Reveal delay={180}>
              <p className="text-muted-foreground max-w-2xl text-balance text-[15px] leading-relaxed sm:text-lg">
                {SITE.description}
              </p>
            </Reveal>

            <Reveal delay={240}>
              <div className="flex flex-col items-center gap-3 sm:flex-row">
                <MagneticCta
                  label="Скачать для Windows"
                  to="/download"
                  icon={<Download className="size-4" />}
                />
                <MagneticCta
                  label="Исходный код"
                  to={SITE.repo}
                  variant="ghost"
                  icon={<Github className="size-4" />}
                />
              </div>
            </Reveal>
          </div>

          {/* Мини-терминал вместо строки с командами. */}
          <Reveal delay={300} className="mt-14">
            <div className="border-border bg-code-bg/80 mx-auto max-w-md overflow-hidden rounded-xl border backdrop-blur-sm">
              <div className="border-border/70 flex items-center gap-1.5 border-b px-3 py-2">
                <span className="bg-destructive/70 size-2 rounded-full" />
                <span className="bg-warning/70 size-2 rounded-full" />
                <span className="bg-success/70 size-2 rounded-full" />
                <span className="text-faint ml-2 font-mono text-[11px]">
                  powershell
                </span>
              </div>
              <div className="flex flex-col gap-1.5 px-4 py-3.5 font-mono text-xs">
                {BOOT_LINES.map((line) => (
                  <div key={line.text} className="flex gap-2">
                    <span className="text-primary">{line.prompt}</span>
                    <span className="text-muted-foreground">{line.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal delay={360} className="mt-14">
            <AppPreview className="mx-auto max-w-5xl" />
          </Reveal>
        </Container>
      </section>

      {/* ── Metrics ────────────────────────────────────────────────────── */}
      <section className="border-border relative border-y">
        <Container className="px-0 sm:px-0">
          <dl className="divide-border grid grid-cols-2 divide-x divide-y lg:grid-cols-4 lg:divide-y-0">
            {METRICS.map((metric, i) => (
              <Reveal key={metric.label} delay={i * 60}>
                <div className="group relative flex flex-col gap-2 px-6 py-9">
                  <span className="text-faint font-mono text-[10px] tracking-[0.2em]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <dt className="text-foreground font-mono text-4xl leading-none font-semibold tracking-tight">
                    {metric.value}
                  </dt>
                  <dd className="text-muted-foreground text-sm">
                    {metric.label}
                  </dd>
                  <span className="bg-primary absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 transition-transform duration-500 group-hover:scale-x-100" />
                </div>
              </Reveal>
            ))}
          </dl>
        </Container>
      </section>

      {/* ── Features ───────────────────────────────────────────────────── */}
      <Section>
        <Container>
          <SectionHeader
            eyebrow="Что внутри"
            title="Всё, что нужно для работы, и ничего для витрины"
            description="beide не пытается быть платформой. Это редактор, терминал, файловый проводник и агент, который умеет с ними работать напрямую."
          />

          {/* Pixel Card — плитки, поверхность которых собирается из пикселей. */}
          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.slice(0, 6).map((feature, i) => (
              <Reveal key={feature.id} delay={i * 70} className="h-full">
                <PixelFeatureCard
                  index={i}
                  icon={feature.icon}
                  title={feature.title}
                  description={feature.description}
                  tag={feature.tag}
                />
              </Reveal>
            ))}
          </div>

          <div className="mt-10 flex justify-center">
            <Button asChild variant="ghost">
              <a href="/features">
                Все возможности
                <ArrowRight />
              </a>
            </Button>
          </div>
        </Container>
      </Section>

      {/* ── Modes ──────────────────────────────────────────────────────── */}
      <Section className="border-border border-t">
        <Container>
          <SectionHeader
            eyebrow="Два режима"
            title="Сначала план, потом правки"
            description="Разделение не косметическое: в Plan запись на диск невозможна на уровне механики, а не договорённости с моделью."
          />

          <div className="mt-14 grid gap-5 lg:grid-cols-2">
            {MODES.map((mode, i) => (
              <Reveal key={mode.name} delay={i * 90}>
                <Card className="h-full">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <CardTitle className="font-mono text-lg">
                        {mode.name}
                      </CardTitle>
                      <Badge variant="outline">{mode.badge}</Badge>
                    </div>
                    <CardDescription>{mode.summary}</CardDescription>
                  </CardHeader>
                  <div className="grid gap-6 px-6 sm:grid-cols-2">
                    <ul className="flex flex-col gap-2">
                      {mode.can.map((item) => (
                        <li
                          key={item}
                          className="text-muted-foreground flex gap-2 text-sm leading-relaxed"
                        >
                          <Check className="text-success mt-0.5 size-4 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                    <ul className="flex flex-col gap-2">
                      {mode.cannot.map((item) => (
                        <li
                          key={item}
                          className="text-faint flex gap-2 text-sm leading-relaxed"
                        >
                          <X className="text-destructive mt-0.5 size-4 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </Card>
              </Reveal>
            ))}
          </div>
        </Container>
      </Section>

      {/* ── Eye Gallery ────────────────────────────────────────────────── */}
      <section className="border-border relative overflow-hidden border-t py-16">
        <Container className="relative z-10">
          <div className="flex flex-col items-center gap-3 text-center">
            <Eyebrow>Один интерфейс</Eyebrow>
            <h2 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
              Дерево, редактор, диффы, агент — в одном окне
            </h2>
          </div>
        </Container>

        {/* Eye Gallery — две встречные ленты панелей редактора. */}
        <div className="mt-10 h-[340px] w-full sm:h-[420px]">
          <EyeTicker
            topImages={EYE_TOP}
            bottomImages={EYE_BOTTOM}
            topRow={{ direction: "right", gap: 28, arc: 58 }}
            bottomRow={{ direction: "left", gap: 28, arc: 58 }}
            speed={16}
            rowGap={24}
            cardWidth={168}
            cardHeight={224}
            rounded={4}
            fade
            fadeIntensity={100}
          />
        </div>
      </section>

      {/* ── Workflow ───────────────────────────────────────────────────── */}
      <Section className="border-border border-t">
        <Container>
          <SectionHeader
            eyebrow="Как это выглядит"
            title="Пять шагов от задачи до применённого диффа"
          />

          {/* Рельс: шаги нанизаны на одну линию, а не разложены по карточкам. */}
          <ol className="relative mt-16 grid gap-10 md:grid-cols-5 md:gap-6">
            <span
              aria-hidden
              className="via-primary/30 absolute inset-x-0 top-[7px] hidden h-px bg-gradient-to-r from-transparent to-transparent md:block"
            />
            {WORKFLOW.map((step, i) => (
              <Reveal key={step.n} delay={i * 80} as="li">
                <div className="relative flex flex-col gap-3">
                  <span
                    aria-hidden
                    className="border-primary/60 bg-background relative z-10 flex size-[15px] items-center justify-center rounded-full border"
                  >
                    <span className="bg-primary size-[5px] rounded-full" />
                  </span>
                  <span className="text-primary font-mono text-xs tracking-[0.2em]">
                    {step.n}
                  </span>
                  <h3 className="text-[15px] leading-snug font-medium">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {step.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </ol>
        </Container>
      </Section>

      {/* ── CTA ────────────────────────────────────────────────────────── */}
      <section className="border-border relative overflow-hidden border-t">
        {/* Ascii Flame — «агент горит работой»: живой шум под CTA. */}
        <div
          aria-hidden
          className="mask-fade-x pointer-events-none absolute inset-x-0 bottom-0 h-[420px] opacity-40"
        >
          <AsciiFire
            intensity={82}
            windDirection="right"
            windForce={14}
            decay={16}
            turbulence={34}
            thickness={1}
            embers
            sparks
            palette="custom"
            shades={["#1c2523", "#2f6d5d", "#4fa88f", "#6bc0a8", "#d2a047"]}
            sparkColor="#d2a047"
            charset="minimal"
            backgroundColor="transparent"
            style={{ width: "100%", height: "100%" }}
          />
        </div>
        <div
          aria-hidden
          className="from-background via-background/70 pointer-events-none absolute inset-0 bg-gradient-to-b to-transparent"
        />

        <Container className="relative z-10 py-24">
          <Reveal>
            <ElectricBorder
              color="#4fa88f"
              bgColor="rgba(26, 29, 31, 0.86)"
              speed={0.6}
              chaos={2.4}
              thickness={1.4}
              borderRadius={16}
              glow
              glowColor="#6bc0a8"
              glowIntensity={4}
              style={{ height: "auto" }}
            >
              <div className="flex flex-col items-center gap-6 px-6 py-14 text-center sm:px-12">
                <ShinyBadge>Готовы попробовать?</ShinyBadge>
                <h2 className="text-balance max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
                  Клонируйте репозиторий и запустите за пару минут
                </h2>
                <p className="text-muted-foreground max-w-xl text-balance text-[15px] leading-relaxed">
                  Node.js 22+, Windows 10 или 11. Ключ провайдера подключается
                  одной командой, всё остальное уже собрано.
                </p>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <MagneticCta
                    label="Инструкция по установке"
                    to="/download"
                    icon={<Download className="size-4" />}
                  />
                  <MagneticCta
                    label="Документация"
                    to="/docs"
                    variant="ghost"
                    icon={<ArrowRight className="size-4" />}
                  />
                </div>
              </div>
            </ElectricBorder>
          </Reveal>
        </Container>
      </section>
    </>
  );
}
