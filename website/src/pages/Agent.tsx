import { Check, ImageIcon, ShieldCheck, X } from "lucide-react";

import AsciiFire from "@/components/originkit/ascii-flame";
import Orb from "@/components/originkit/cosmic-orb";
import { CodeBlock } from "@/components/site/code-block";
import {
  Container,
  Eyebrow,
  GridLines,
  Section,
  SectionHeader,
} from "@/components/site/layout-primitives";
import { PixelTile } from "@/components/site/pixel-feature-card";
import { RainBackdrop } from "@/components/site/rain-backdrop";
import { Reveal } from "@/components/site/reveal";
import { ScrambleHeadline } from "@/components/site/scramble-headline";
import { ShinyBadge } from "@/components/site/shiny-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { MODELS, MODES, WORKFLOW } from "@/data/site";

const GUARDS = [
  {
    title: "Разрешения",
    body: "Режим ask спрашивает перед записью файла и запуском команды. Auto включается вручную и только там, где это уместно.",
  },
  {
    title: "Превью диффа",
    body: "Правка сначала показывается как дифф. Apply записывает, Reject отбрасывает — записи вслепую не бывает.",
  },
  {
    title: "Чекпоинт",
    body: "Перед серией изменений снимается снимок в .beide/checkpoints/. Откат возвращает файлы к состоянию до вмешательства.",
  },
];

/** Each guard fills from a different edge so the row does not read as a loop. */
const GUARD_APPEAR = ["left", "middle", "right"] as const;

export default function Agent() {
  return (
    <>
      <section className="relative overflow-hidden pt-32 pb-16">
        <GridLines />

        {/* Ascii Flame — «шум процесса» вдоль правого края шапки. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 hidden w-[46%] opacity-30 lg:block"
          style={{
            maskImage: "linear-gradient(to left, black, transparent 85%)",
            WebkitMaskImage: "linear-gradient(to left, black, transparent 85%)",
          }}
        >
          <AsciiFire
            intensity={70}
            windDirection="left"
            windForce={18}
            decay={18}
            turbulence={44}
            embers
            sparks={false}
            palette="custom"
            shades={["#1a1d1f", "#2b2f31", "#2f6d5d", "#4fa88f", "#6bc0a8"]}
            charset="dense"
            backgroundColor="transparent"
            style={{ width: "100%", height: "100%" }}
          />
        </div>

        {/* Ascii Rain — встречный поток слева, чтобы шапка не была пустой. */}
        <RainBackdrop
          className="right-auto w-[38%] opacity-[0.14]"
          angle={-10}
          glyphSize={12}
          speed={2.6}
          density={20}
          trail={12}
          fade="edges"
        />

        <Container className="relative z-10">
          <div className="flex max-w-2xl flex-col items-start gap-5">
            <ShinyBadge dot>Агент</ShinyBadge>
            <ScrambleHeadline
              text="Агент"
              height={64}
              fontSize={52}
              weight={600}
            />
            <p className="text-muted-foreground text-[15px] leading-relaxed sm:text-lg">
              Агент работает в main-процессе Electron и имеет прямой доступ к
              файловой системе проекта. Поэтому вопрос не «умеет ли он править
              код», а «что ему разрешено».
            </p>
          </div>
        </Container>
      </section>

      {/* ── Modes ──────────────────────────────────────────────────────── */}
      <Section className="border-border border-t">
        <Container>
          <SectionHeader
            eyebrow="Режимы"
            title="Plan исследует, Agent исполняет"
            description="Переключение живёт прямо в композере — менять режим можно посреди диалога, не теряя контекст."
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
                  <Separator />
                  <div className="grid gap-6 px-6 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <p className="text-success text-xs font-medium tracking-wide uppercase">
                        Может
                      </p>
                      {mode.can.map((item) => (
                        <p
                          key={item}
                          className="text-muted-foreground flex gap-2 text-sm leading-relaxed"
                        >
                          <Check className="text-success mt-0.5 size-4 shrink-0" />
                          {item}
                        </p>
                      ))}
                    </div>
                    <div className="flex flex-col gap-2">
                      <p className="text-destructive text-xs font-medium tracking-wide uppercase">
                        Не может
                      </p>
                      {mode.cannot.map((item) => (
                        <p
                          key={item}
                          className="text-faint flex gap-2 text-sm leading-relaxed"
                        >
                          <X className="text-destructive mt-0.5 size-4 shrink-0" />
                          {item}
                        </p>
                      ))}
                    </div>
                  </div>
                </Card>
              </Reveal>
            ))}
          </div>
        </Container>
      </Section>

      {/* ── Guards ─────────────────────────────────────────────────────── */}
      <Section className="border-border border-t">
        <Container>
          <SectionHeader
            eyebrow="Предохранители"
            title="Три независимых слоя между моделью и вашим диском"
          />

          {/* Pixel Card — слой «прорастает» под курсором, как и сам предохранитель. */}
          <div className="mt-14 grid gap-4 md:grid-cols-3">
            {GUARDS.map((guard, i) => (
              <Reveal key={guard.title} delay={i * 80} className="h-full">
                <PixelTile
                  appearFrom={GUARD_APPEAR[i]}
                  className="flex h-full flex-col gap-3 p-6"
                >
                  <div className="flex items-center justify-between">
                    <span className="border-border bg-panel text-primary inline-flex size-10 items-center justify-center rounded-lg border">
                      <ShieldCheck className="size-[18px]" />
                    </span>
                    <span className="text-faint font-mono text-3xl leading-none font-semibold">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h3 className="text-[17px] font-medium">{guard.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {guard.body}
                  </p>
                </PixelTile>
              </Reveal>
            ))}
          </div>
        </Container>
      </Section>

      {/* ── Context ────────────────────────────────────────────────────── */}
      <Section className="border-border border-t">
        <Container className="grid items-center gap-12 lg:grid-cols-2">
          <div className="flex flex-col gap-5">
            <Eyebrow>Контекст</Eyebrow>
            <h2 className="text-balance text-3xl font-semibold tracking-tight">
              Точечный контекст вместо «прочитай весь репозиторий»
            </h2>
            <p className="text-muted-foreground text-[15px] leading-relaxed">
              Упоминания <span className="text-primary font-mono">@file</span> и{" "}
              <span className="text-primary font-mono">@folder</span> вставляют
              в запрос конкретные пути. Скриншот макета или ошибки прикладывается
              вложением — модели с поддержкой изображений его увидят.
            </p>
            <p className="text-muted-foreground flex items-center gap-2 text-sm">
              <ImageIcon className="text-primary size-4" />
              Картинки поддерживают Claude, Gemini, MiniMax и Kimi
            </p>
            <CodeBlock
              caption="BEIDE.md"
              code={`# Правила проекта\n- Стек менять нельзя\n- Комментарии на английском\n- Перед завершением: npm run typecheck`}
            />
          </div>

          {/* Cosmic Orb — компактный «мозг» рядом с текстом про контекст. */}
          <Reveal delay={100}>
            <div className="flex justify-center">
              <Orb
                size={360}
                archetype="nebula"
                background="#141618"
                speed={30}
                spin={22}
                lens
                lensAmount={52}
                palette={{
                  anchor: "#2f6d5d",
                  colorA: "#4fa88f",
                  colorB: "#6bc0a8",
                  colorC: "#979c9d",
                }}
                style={{ width: 360, height: 360 }}
              />
            </div>
          </Reveal>
        </Container>
      </Section>

      {/* ── Models ─────────────────────────────────────────────────────── */}
      <Section className="border-border border-t">
        <Container>
          <SectionHeader
            eyebrow="Модели"
            title="Десять моделей, четыре провайдера"
            description="Каталог живёт в src/lib/models.ts — один источник правды для пикера в интерфейсе и резолвера в main-процессе."
          />

          <Reveal className="mt-12">
            <div className="border-border overflow-x-auto rounded-xl border">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="bg-panel text-faint font-mono text-[11px] tracking-[0.16em] uppercase">
                  <tr>
                    <th className="px-4 py-3 font-medium">Модель</th>
                    <th className="px-4 py-3 font-medium">Провайдер</th>
                    <th className="px-4 py-3 font-medium">Контекст</th>
                    <th className="px-4 py-3 font-medium">Картинки</th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {MODELS.map((model) => (
                    <tr
                      key={`${model.name}-${model.version}`}
                      className="hover:bg-panel/50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className="text-foreground font-medium">
                          {model.name}
                        </span>{" "}
                        <span className="text-faint font-mono text-xs">
                          {model.version}
                        </span>
                      </td>
                      <td className="text-muted-foreground px-4 py-3">
                        {model.provider}
                      </td>
                      <td className="text-muted-foreground px-4 py-3 font-mono text-xs">
                        {model.context}
                      </td>
                      <td className="px-4 py-3">
                        {model.images ? (
                          <Check className="text-success size-4" />
                        ) : (
                          <X className="text-faint size-4" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>
        </Container>
      </Section>

      {/* ── Workflow ───────────────────────────────────────────────────── */}
      <Section className="border-border border-t">
        <Container>
          <SectionHeader eyebrow="Цикл" title="Как проходит одна задача" />
          <ol className="mt-12 flex flex-col">
            {WORKFLOW.map((step, i) => (
              <Reveal key={step.n} delay={i * 60} as="li">
                <div className="border-border flex gap-6 border-b py-6 last:border-b-0">
                  <span className="text-primary w-10 shrink-0 font-mono text-sm">
                    {step.n}
                  </span>
                  <div className="flex flex-col gap-1.5">
                    <h3 className="text-[15px] font-medium">{step.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {step.body}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </ol>
        </Container>
      </Section>
    </>
  );
}
