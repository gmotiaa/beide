import { ArrowRight } from "lucide-react";

import AsciiFire from "@/components/originkit/ascii-flame";
import Orb from "@/components/originkit/cosmic-orb";
import ElectricBorder from "@/components/originkit/electric-border";
import EyeTicker from "@/components/originkit/eye-gallery";
import ImageBox from "@/components/originkit/gallery-tunnel";
import WaveBg from "@/components/originkit/pulse-lines";
import { AppPreview } from "@/components/site/app-preview";
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
import { EYE_BOTTOM, EYE_TOP, TUNNEL_IMAGES } from "@/data/shots";

const THEMES = [
  {
    name: "Dark",
    hint: "basalt — базальт и мята",
    colors: ["#141618", "#1c1f21", "#2b2f31", "#4fa88f", "#e9e7e2"],
  },
  {
    name: "Light",
    hint: "дневной режим без выжигания глаз",
    colors: ["#f7f6f3", "#eceae5", "#d6d3cb", "#2f6d5d", "#1c1f21"],
  },
  {
    name: "Midnight",
    hint: "почти чёрный, для ночных сессий",
    colors: ["#0b0d0e", "#111415", "#1e2224", "#6bc0a8", "#c9c6c0"],
  },
];

export default function Showcase() {
  return (
    <>
      <section className="relative overflow-hidden pt-32 pb-14">
        <GridLines />
        <Container className="relative z-10">
          <div className="flex max-w-2xl flex-col items-start gap-5">
            <ShinyBadge dot>Витрина</ShinyBadge>
            <ScrambleHeadline
              text="Витрина"
              height={64}
              fontSize={52}
              weight={600}
            />
            <p className="text-muted-foreground text-[15px] leading-relaxed sm:text-lg">
              Как beide выглядит и ощущается: панели редактора, темы, плотность
              интерфейса. Всё, что ниже, отрисовано прямо в браузере — ни одного
              загруженного скриншота.
            </p>
          </div>
        </Container>
      </section>

      {/* ── Gallery Tunnel ─────────────────────────────────────────────── */}
      <section className="border-border relative border-t">
        <div className="relative h-[68vh] min-h-[420px] w-full">
          {/* Gallery Tunnel — прогулка по коридору из панелей редактора. */}
          <ImageBox
            images={TUNNEL_IMAGES}
            background="#141618"
            lineColor="#2b2f31"
            lineOpacity={70}
            colors={["#4fa88f", "#6bc0a8", "#2f6d5d", "#d2a047", "#d2694e", "#82b173"]}
            grid={4}
            speed={70}
            boost={120}
            fade={78}
            label
            labelText="Нажмите и держите"
            labelFill="#e9e7e2"
            labelColor="#141618"
            labelFont={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 12,
              fontWeight: 500,
            }}
          />
          <div
            aria-hidden
            className="from-background pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b to-transparent"
          />
          <div
            aria-hidden
            className="from-background pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t to-transparent"
          />
        </div>

        <Container className="relative z-10 pt-8 pb-16">
          <div className="flex flex-col items-center gap-2 text-center">
            <Eyebrow>Gallery Tunnel</Eyebrow>
            <p className="text-muted-foreground max-w-md text-sm">
              Наведите курсор и зажмите кнопку мыши, чтобы ускориться.
            </p>
          </div>
        </Container>
      </section>

      {/* ── Real UI ────────────────────────────────────────────────────── */}
      <Section className="border-border border-t">
        <Container>
          <SectionHeader
            eyebrow="Интерфейс"
            title="Плотный, тихий, без лишней хромы"
            description="Дерево слева, редактор в центре, агент справа. Дифф открывается там же, где вы читаете код, — переключать контекст не нужно."
          />
          <Reveal className="mt-12">
            <AppPreview />
          </Reveal>
        </Container>
      </Section>

      {/* ── Themes ─────────────────────────────────────────────────────── */}
      <Section className="border-border border-t">
        <Container>
          <SectionHeader
            eyebrow="Темы"
            title="Три палитры на общих токенах"
            description="Цвета описаны переменными, а не хардкодом, поэтому темы переключаются целиком и без артефактов."
          />

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {THEMES.map((theme, i) => (
              <Reveal key={theme.name} delay={i * 80}>
                <div className="border-border bg-card flex h-full flex-col gap-4 rounded-xl border p-6">
                  <div className="flex items-baseline justify-between">
                    <h3 className="font-medium">{theme.name}</h3>
                    <span className="text-faint font-mono text-xs">
                      {theme.colors.length} токенов
                    </span>
                  </div>
                  <p className="text-muted-foreground text-sm">{theme.hint}</p>
                  <div className="mt-auto flex overflow-hidden rounded-lg">
                    {theme.colors.map((color) => (
                      <span
                        key={color}
                        className="h-12 flex-1"
                        style={{ background: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </Container>
      </Section>

      {/* ── Eye Gallery ────────────────────────────────────────────────── */}
      <section className="border-border overflow-hidden border-t py-16">
        <Container>
          <SectionHeader
            align="center"
            eyebrow="Eye Gallery"
            title="Панели проекта в движении"
          />
        </Container>
        <div className="mt-10 h-[380px] w-full sm:h-[460px]">
          <EyeTicker
            topImages={EYE_TOP}
            bottomImages={EYE_BOTTOM}
            topRow={{ direction: "left", gap: 24, arc: 72 }}
            bottomRow={{ direction: "right", gap: 24, arc: 72 }}
            speed={14}
            rowGap={40}
            cardWidth={180}
            cardHeight={240}
            rounded={5}
            fade
            fadeIntensity={92}
          />
        </div>
      </section>

      {/* ── Orb + Pulse Lines ──────────────────────────────────────────── */}
      <Section className="border-border border-t">
        <Container className="grid items-stretch gap-6 lg:grid-cols-2">
          <Reveal>
            <div className="border-border bg-card relative flex h-full min-h-[360px] flex-col items-center justify-center gap-4 overflow-hidden rounded-xl border p-8">
              <Orb
                size={280}
                archetype="core"
                background="#1a1d1f"
                speed={34}
                spin={40}
                lens
                lensAmount={60}
                palette={{
                  anchor: "#4fa88f",
                  colorA: "#6bc0a8",
                  colorB: "#d2a047",
                  colorC: "#2f6d5d",
                }}
                style={{ width: 280, height: 280 }}
              />
              <div className="text-center">
                <p className="font-medium">Cosmic Orb</p>
                <p className="text-muted-foreground text-sm">
                  Шейдер на WebGL — тот же слой, что рисует загрузку в IDE
                </p>
              </div>
            </div>
          </Reveal>

          <Reveal delay={100}>
            <div className="border-border bg-card relative flex h-full min-h-[360px] flex-col overflow-hidden rounded-xl border">
              <div className="relative min-h-[240px] flex-1">
                <WaveBg
                  type="vertical"
                  shape="square"
                  cornerRadius={2}
                  speed={96}
                  lineWidth={4}
                  gap={18}
                  scale={2.2}
                  backgroundColor="#1a1d1f"
                  lineColor="#232728"
                  colors={{
                    paletteCount: 4,
                    color1: "#4fa88f",
                    color2: "#6bc0a8",
                    color3: "#d2a047",
                    color4: "#2f6d5d",
                  }}
                />
              </div>
              <div className="border-border border-t p-6">
                <p className="font-medium">Pulse Lines</p>
                <p className="text-muted-foreground text-sm">
                  Индикатор фоновых задач — тот же ритм, что у прогресса агента
                </p>
              </div>
            </div>
          </Reveal>
        </Container>
      </Section>

      {/* ── Ascii Rain + Pixel Card ────────────────────────────────────── */}
      <Section className="border-border border-t">
        <Container className="grid items-stretch gap-6 lg:grid-cols-2">
          <Reveal>
            <div className="border-border bg-card relative flex h-full min-h-[360px] flex-col overflow-hidden rounded-xl border">
              {/* Ascii Rain — поток символов, из которого собран фон сайта. */}
              <div className="relative min-h-[240px] flex-1 bg-[#121415]">
                <RainBackdrop
                  className="opacity-70"
                  angle={8}
                  glyphSize={15}
                  speed={4}
                  density={30}
                  trail={18}
                  fade="none"
                />
              </div>
              <div className="border-border border-t p-6">
                <p className="font-medium">Ascii Rain</p>
                <p className="text-muted-foreground text-sm">
                  Фон шапок: те же скобки и операторы, что в редакторе, только
                  падающие
                </p>
              </div>
            </div>
          </Reveal>

          <Reveal delay={100}>
            <div className="flex h-full flex-col gap-6">
              {/* Pixel Card — поверхность плиток, проявляется под курсором. */}
              <PixelTile
                appearFrom="middle"
                className="flex h-full flex-col items-center justify-center gap-2 px-6 py-14 text-center"
              >
                <p className="font-mono text-2xl font-semibold tracking-tight">
                  Pixel Card
                </p>
                <p className="text-muted-foreground max-w-xs text-sm leading-relaxed">
                  Наведите курсор: поверхность заполняется пикселями от центра к
                  краям
                </p>
              </PixelTile>
              <div className="grid gap-6 sm:grid-cols-2">
                <PixelTile
                  appearFrom="left"
                  className="flex flex-col items-center justify-center gap-1 px-4 py-8 text-center"
                >
                  <p className="font-mono text-sm">appearFrom</p>
                  <p className="text-faint font-mono text-xs">left</p>
                </PixelTile>
                <PixelTile
                  appearFrom="bottom"
                  className="flex flex-col items-center justify-center gap-1 px-4 py-8 text-center"
                >
                  <p className="font-mono text-sm">appearFrom</p>
                  <p className="text-faint font-mono text-xs">bottom</p>
                </PixelTile>
              </div>
            </div>
          </Reveal>
        </Container>
      </Section>

      {/* ── Ascii Flame + CTA ──────────────────────────────────────────── */}
      <section className="border-border relative overflow-hidden border-t">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-45 mask-fade-x"
        >
          <AsciiFire
            intensity={96}
            windDirection="right"
            windForce={12}
            decay={14}
            turbulence={38}
            thickness={1}
            embers
            sparks
            pulse
            palette="custom"
            shades={["#141618", "#1c2523", "#2f6d5d", "#4fa88f", "#6bc0a8", "#e9e7e2"]}
            sparkColor="#d2a047"
            charset="blocks"
            backgroundColor="transparent"
            style={{ width: "100%", height: "100%" }}
          />
        </div>
        <div
          aria-hidden
          className="from-background via-background/60 to-background pointer-events-none absolute inset-0 bg-gradient-to-b"
        />

        <Container className="relative z-10 py-24">
          <Reveal>
            <ElectricBorder
              color="#6bc0a8"
              bgColor="rgba(20, 22, 24, 0.9)"
              speed={0.5}
              chaos={3}
              thickness={1.2}
              borderRadius={16}
              glow
              glowColor="#4fa88f"
              glowIntensity={3}
              style={{ height: "auto" }}
            >
              <div className="flex flex-col items-center gap-6 px-6 py-14 text-center">
                <Eyebrow>Ascii Flame</Eyebrow>
                <h2 className="text-balance max-w-xl text-3xl font-semibold tracking-tight">
                  Красиво — приятно. Работает — важнее
                </h2>
                <p className="text-muted-foreground max-w-lg text-balance text-[15px] leading-relaxed">
                  Вся анимация на странице уважает prefers-reduced-motion и
                  останавливается, когда система просит не двигаться.
                </p>
                <MagneticCta
                  label="Установить beide"
                  to="/download"
                  icon={<ArrowRight className="size-4" />}
                />
              </div>
            </ElectricBorder>
          </Reveal>
        </Container>
      </section>
    </>
  );
}
