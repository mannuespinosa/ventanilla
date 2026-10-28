import { useEffect, useRef } from "react";
import { ArrowUpRight, BadgeCheck, Ban, Gift, Laptop, Lock, Smartphone, Tablet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { config } from "@/lib/config";

const PROCEDURES = [
  ["Licencia de conducir", "Acta de nacimiento", "Tenencia", "Predial"],
  ["Constancia de domicilio", "Agua", "Verificación vehicular", "Placas"],
  ["Licencia de funcionamiento", "CURP", "Uso de suelo", "Pensión"],
];

export function HomeSections({ onAsk }: { onAsk: () => void }) {
  const sectionsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = sectionsRef.current;
    if (!container || typeof IntersectionObserver === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.setAttribute("data-revealed", "true");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    container.querySelectorAll("[data-reveal]").forEach((section) => {
      section.setAttribute("data-revealed", "false");
      observer.observe(section);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={sectionsRef} className="px-6 pb-52 sm:px-8 sm:pb-36">
      <section data-reveal aria-label="Manifiesto" className="mx-auto max-w-[1000px] py-24 text-center md:py-36">
        <p className="font-serif text-[40px] leading-[1.15] text-foreground md:text-[64px]">
          Respuestas simples <BadgeCheck aria-hidden className="manifesto-icon" /> solo de fuentes oficiales. Gratis <Gift aria-hidden className="manifesto-icon" />, sin anuncios <Ban aria-hidden className="manifesto-icon" /> y sin cuenta <Lock aria-hidden className="manifesto-icon" />.
        </p>
      </section>

      <section data-reveal className="mx-auto grid max-w-[1080px] items-center gap-10 border-t border-border py-16 md:grid-cols-2 md:gap-20 md:py-24">
        <div aria-label="Trámites" className="order-2 min-w-0 overflow-hidden rounded-lg border border-border bg-card py-12 md:order-1">
          <div className="space-y-4" aria-hidden="true">
            {PROCEDURES.map((row, index) => (
              <div key={index} className="marquee-window">
                <div className={`procedure-track ${index === 1 ? "procedure-track-reverse" : ""}`}>
                  {[0, 1].map((copy) => <div key={copy} className="procedure-group">{row.map((name) => <span key={name} className="shrink-0 whitespace-nowrap rounded-full border border-border bg-background px-4 py-2.5 text-sm text-muted-foreground">{name}</span>)}</div>)}
                </div>
              </div>
            ))}
          </div>
          <ul className="sr-only">{PROCEDURES.flat().map((name) => <li key={name}>{name}</li>)}</ul>
        </div>
        <div className="order-1 md:order-2">
          <h2 className="max-w-sm font-serif text-[32px] leading-tight text-foreground">Cientos de trámites, una sola pregunta</h2>
          <p className="mt-5 max-w-sm text-base leading-7 text-muted-foreground">No más saltar de portal en portal. Pregunta como le preguntarías a alguien y te llevamos a la fuente oficial.</p>
        </div>
      </section>

      <section data-reveal className="mx-auto grid max-w-[1080px] items-center gap-10 border-t border-border py-16 md:grid-cols-2 md:gap-20 md:py-24">
        <div>
          <h2 className="font-serif text-[32px] leading-tight text-foreground">No hay app que descargar</h2>
          <p className="mt-5 max-w-sm text-base leading-7 text-muted-foreground">Abre Ventanilla en el navegador de tu teléfono, tableta o computadora.</p>
          <Button variant="link" asChild className="mt-5 h-auto p-0 text-base font-normal text-foreground underline-offset-4">
            <a href="#hero-question" onClick={(event) => { event.preventDefault(); onAsk(); }}>Haz una pregunta <ArrowUpRight size={17} aria-hidden /></a>
          </Button>
        </div>
        <div className="flex min-h-[244px] items-center justify-center gap-6 rounded-lg border border-border bg-card text-muted-foreground sm:gap-8" aria-label="Teléfono, tableta y computadora">
          <Smartphone className="h-14 w-10 shrink-0" strokeWidth={1.2} aria-hidden />
          <Tablet className="h-20 w-16 shrink-0" strokeWidth={1.2} aria-hidden />
          <Laptop className="h-24 w-24 shrink-0" strokeWidth={1.2} aria-hidden />
        </div>
      </section>

      <footer data-reveal className="mx-auto max-w-[1080px] border-t border-border pb-6 pt-16 md:pt-24">
        <p className="font-serif text-[64px] leading-none text-foreground md:text-[96px]">Ventanilla</p>
        <div className="mt-7 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <p className="max-w-md text-sm leading-6 text-muted-foreground">Proyecto independiente y open source. No está afiliado al Gobierno de la Ciudad de México.</p>
          <nav aria-label="Enlaces del proyecto" className="flex gap-6 text-sm text-muted-foreground">
            <a href={config.repo} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-foreground">GitHub <ArrowUpRight size={13} className="inline" aria-hidden /></a>
            <a href={`${config.repo}/blob/main/LICENSE`} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-foreground">Licencia AGPL-3.0 <ArrowUpRight size={13} className="inline" aria-hidden /></a>
          </nav>
        </div>
      </footer>
    </div>
  );
}