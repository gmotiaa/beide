import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, Cpu, Github, MonitorSmartphone, Package } from "lucide-react";

import ElectricBorder from "@/components/originkit/electric-border";
import WaveBg from "@/components/originkit/pulse-lines";
import { CodeBlock } from "@/components/site/code-block";
import {
  Container,
  Eyebrow,
  GridLines,
  Section,
  SectionHeader,
} from "@/components/site/layout-primitives";
import { MagneticCta } from "@/components/site/magnetic-cta";
import { PixelTile } from "@/components/site/pixel-feature-card";
import { RainBackdrop } from "@/components/site/rain-backdrop";
import { Reveal } from "@/components/site/reveal";
import { ScrambleHeadline } from "@/components/site/scramble-headline";
import { ShinyBadge } from "@/components/site/shiny-badge";
import { Button } from "@/components/ui/button";
import { SITE } from "@/data/site";

const REQUIREMENTS = [
  {
    icon: MonitorSmartphone,
    title: "Windows 10 или 11",
    body: "Приложение собрано под Windows. Сборок под macOS и Linux пока нет.",
  },
  {
    icon: Cpu,
    title: "Node.js 22 и выше",
    body: "Проверить версию: node -v. Более старые ветки Node не поддерживаются.",
  },
  {
    icon: Package,
    title: "Ключ провайдера",
    body: "Достаточно одного: Anthropic, xAI, NVIDIA или Google. Без ключа агент не ответит.",
  },
];

/** Pixels fill from a different edge per tile so the row reads left to right. */
const REQUIREMENT_APPEAR = ["left", "middle", "right"] as const;

const STEPS = [
  {
    n: "01",
    title: "Клонировать и установить зависимости",
    code: "git clone https://github.com/Gmotia/beide\ncd beide\nnpm install",
  },
  {
    n: "02",
    title: "Подключить провайдера",
    code: "# Anthropic и xAI — через профиль pi\nnpx pi auth login\n\n# NVIDIA и Google — ключами в .env\ncopy .env.example .env",
  },
  {
    n: "03",
    title: "Запустить в режиме разработки",
    code: "npm run dev",
  },
  {
    n: "04",
    title: "Собрать установщик",
    code: "npm run build\nnpm run dist",
  },
];

export default function Download() {
  return (
    <>
      <section className="relative overflow-hidden pt-32 pb-14">
        <GridLines />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-20 h-72 opacity-20 mask-fade-x"
        >
          <WaveBg
            type="vertical"
            shape="circle"
            speed={80}
            lineWidth={3}
            gap={30}
            scale={2}
            backgroundColor="transparent"
            lineColor="#232728"
            colors={{
              paletteCount: 2,
              color1: "#4fa88f",
              color2: "#6bc0a8",
            }}
          />
        </div>

        {/* Ascii Rain — «поток загрузки» справа от текста. */}
        <RainBackdrop
          className="left-auto w-[42%] opacity-[0.15]"
          angle={16}
          glyphSize={13}
          speed={4.2}
          density={24}
          trail={16}
          fade="edges"
        />

        <Container className="relative z-10">
          <div className="flex max-w-2xl flex-col items-start gap-5">
            <ShinyBadge dot>Установка</ShinyBadge>
            <ScrambleHeadline
              text="Скачать beide"
              height={64}
              fontSize={48}
              weight={600}
            />
            <p className="text-muted-foreground text-[15px] leading-relaxed sm:text-lg">
              Готовых бинарников пока нет — beide собирается из исходников. Это
              четыре команды и пара минут.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <MagneticCta
                label="Открыть репозиторий"
                to={SITE.repo}
                icon={<Github className="size-4" />}
              />
              <MagneticCta
                label="Подробная инструкция"
                to="/docs#install"
                variant="ghost"
                icon={<ArrowRight className="size-4" />}
              />
            </div>
          </div>
        </Container>
      </section>

      <Section className="pt-6 sm:pt-6">
        <Container>
          {/* Pixel Card — требования как три «слота» под установку. */}
          <div className="grid gap-4 md:grid-cols-3">
            {REQUIREMENTS.map((item, i) => (
              <Reveal key={item.title} delay={i * 80} className="h-full">
                <PixelTile
                  appearFrom={REQUIREMENT_APPEAR[i]}
                  className="flex h-full flex-col gap-3 p-6"
                >
                  <div className="flex items-center justify-between">
                    <span className="border-border bg-panel text-primary inline-flex size-10 items-center justify-center rounded-lg border">
                      <item.icon className="size-[18px]" />
                    </span>
                    <span className="text-faint font-mono text-[11px] tracking-[0.2em]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h3 className="text-[17px] font-medium">{item.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {item.body}
                  </p>
                </PixelTile>
              </Reveal>
            ))}
          </div>
        </Container>
      </Section>

      <Section className="border-border border-t">
        <Container>
          <SectionHeader
            eyebrow="Шаги"
            title="От клона до собранного установщика"
          />

          <div className="mt-12 flex flex-col gap-10">
            {STEPS.map((step, i) => (
              <Reveal key={step.n} delay={i * 70}>
                <div className="grid gap-4 lg:grid-cols-[220px_1fr] lg:gap-10">
                  <div className="flex items-baseline gap-3">
                    <span className="text-primary font-mono text-sm">
                      {step.n}
                    </span>
                    <h3 className="text-[15px] font-medium">{step.title}</h3>
                  </div>
                  <CodeBlock code={step.code} />
                </div>
              </Reveal>
            ))}
          </div>
        </Container>
      </Section>

      <Section className="border-border border-t">
        <Container className="max-w-3xl">
          <Reveal>
            <div className="border-warning/30 bg-warning/5 flex gap-4 rounded-xl border p-6">
              <AlertTriangle className="text-warning mt-0.5 size-5 shrink-0" />
              <div className="flex flex-col gap-2">
                <p className="font-medium">Ключи не кладите в репозиторий</p>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Anthropic и xAI хранят авторизацию в профиле pi
                  (<span className="font-mono">~/.pi/agent</span>), NVIDIA и
                  Google читаются из <span className="font-mono">.env</span>,
                  который уже добавлен в{" "}
                  <span className="font-mono">.gitignore</span>. beide не
                  пересылает ключи никуда, кроме самого провайдера.
                </p>
              </div>
            </div>
          </Reveal>
        </Container>
      </Section>

      <Section className="border-border border-t">
        <Container className="max-w-3xl">
          <Reveal>
            <ElectricBorder
              color="#4fa88f"
              bgColor="rgba(26, 29, 31, 0.9)"
              speed={0.55}
              chaos={2.2}
              thickness={1.3}
              borderRadius={16}
              glow
              glowColor="#6bc0a8"
              glowIntensity={3}
              style={{ height: "auto" }}
            >
              <div className="flex flex-col items-center gap-5 px-6 py-12 text-center">
                <Eyebrow>Что-то не запускается?</Eyebrow>
                <h2 className="text-balance text-2xl font-semibold tracking-tight">
                  Типовые проблемы разобраны в документации
                </h2>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button asChild variant="outline">
                    <Link to="/docs#troubleshooting">
                      Раздел «Если что-то не работает»
                    </Link>
                  </Button>
                  <Button asChild variant="ghost">
                    <a
                      href={SITE.issues}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      Завести issue
                    </a>
                  </Button>
                </div>
              </div>
            </ElectricBorder>
          </Reveal>
        </Container>
      </Section>
    </>
  );
}
