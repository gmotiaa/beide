import { ArrowRight } from "lucide-react";

import WaveBg from "@/components/originkit/pulse-lines";
import {
  Container,
  GridLines,
  Section,
  SectionHeader,
} from "@/components/site/layout-primitives";
import { MagneticCta } from "@/components/site/magnetic-cta";
import { PixelFeatureCard } from "@/components/site/pixel-feature-card";
import { Reveal } from "@/components/site/reveal";
import { ScrambleHeadline } from "@/components/site/scramble-headline";
import { ShinyBadge } from "@/components/site/shiny-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FEATURES } from "@/data/site";

const GROUPS = ["Всё", "Ядро", "Контроль", "Безопасность", "Редактор", "Модели", "Настройка"];

export default function Features() {
  return (
    <>
      <section className="relative overflow-hidden pt-32 pb-14">
        <GridLines />

        {/* Pulse Lines — горизонтальный «пульс» под шапкой раздела. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-16 h-64 opacity-25 mask-fade-x"
        >
          <WaveBg
            type="horizontal"
            shape="line"
            speed={110}
            lineWidth={1.5}
            gap={22}
            scale={3}
            backgroundColor="transparent"
            lineColor="#232728"
            colors={{
              paletteCount: 3,
              color1: "#2b2f31",
              color2: "#4fa88f",
              color3: "#2b2f31",
            }}
          />
        </div>

        <Container className="relative z-10">
          <div className="flex max-w-3xl flex-col items-start gap-5">
            <ShinyBadge>Возможности</ShinyBadge>
            <ScrambleHeadline
              text="Возможности"
              height={64}
              fontSize={52}
              weight={600}
            />
            <p className="text-muted-foreground max-w-2xl text-[15px] leading-relaxed sm:text-lg">
              Двенадцать вещей, из которых состоит beide. Ничего из списка не
              «в планах» — всё это работает в текущей сборке.
            </p>
          </div>
        </Container>
      </section>

      <Section className="pt-4 sm:pt-4">
        <Container>
          <Tabs defaultValue="Всё">
            <TabsList className="mb-10 flex-wrap">
              {GROUPS.map((group) => (
                <TabsTrigger key={group} value={group}>
                  {group}
                </TabsTrigger>
              ))}
            </TabsList>

            {GROUPS.map((group) => {
              const list =
                group === "Всё"
                  ? FEATURES
                  : FEATURES.filter((feature) => feature.tag === group);
              return (
                <TabsContent key={group} value={group}>
                  {list.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      В этой группе пока пусто.
                    </p>
                  ) : (
                    // Pixel Card — та же поверхность, что на главной.
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {list.map((feature, i) => (
                        <Reveal key={feature.id} delay={i * 50} className="h-full">
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
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        </Container>
      </Section>

      <Section className="border-border border-t">
        <Container>
          <SectionHeader
            align="center"
            eyebrow="Дальше"
            title="Посмотрите, как агент устроен изнутри"
            description="Режимы, разрешения, чекпоинты и каталог моделей — на отдельной странице."
          />
          <div className="mt-10 flex justify-center">
            <MagneticCta
              label="Про агента"
              to="/agent"
              icon={<ArrowRight className="size-4" />}
            />
          </div>
        </Container>
      </Section>
    </>
  );
}
