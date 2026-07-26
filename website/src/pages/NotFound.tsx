import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import AsciiFire from "@/components/originkit/ascii-flame";
import { Container } from "@/components/site/layout-primitives";
import { ScrambleHeadline } from "@/components/site/scramble-headline";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <section className="relative flex min-h-[80vh] items-center overflow-hidden pt-24">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-35 mask-fade-x"
      >
        <AsciiFire
          intensity={60}
          windDirection="left"
          windForce={22}
          decay={20}
          turbulence={52}
          embers
          sparks={false}
          palette="custom"
          shades={["#141618", "#1c2523", "#2b2f31", "#2f6d5d", "#4fa88f"]}
          charset="minimal"
          backgroundColor="transparent"
          style={{ width: "100%", height: "100%" }}
        />
      </div>
      <div
        aria-hidden
        className="from-background via-background/70 to-background pointer-events-none absolute inset-0 bg-gradient-to-b"
      />

      <Container className="relative z-10">
        <div className="mx-auto flex max-w-xl flex-col items-center gap-6 text-center">
          <ScrambleHeadline
            text="404"
            align="center"
            height={96}
            fontSize={88}
            weight={700}
            mono
            color="#4fa88f"
          />
          <h1 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
            Такой страницы нет
          </h1>
          <p className="text-muted-foreground text-[15px] leading-relaxed">
            Ссылка устарела или в адресе опечатка. Вернитесь на главную — оттуда
            видно всё остальное.
          </p>
          <Button asChild size="lg">
            <Link to="/">
              <ArrowLeft />
              На главную
            </Link>
          </Button>
        </div>
      </Container>
    </section>
  );
}
