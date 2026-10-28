import { useEffect, useState, type RefObject } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { AskInput, type SubmitQuestion } from "./AskInput";
import { config } from "@/lib/config";

// Las preguntas vienen de ventanilla.config.json; las imágenes se asignan por posición.
const IMAGES = ["/slides/licencia.jpg", "/slides/acta.jpg", "/slides/tenencia.jpg", "/slides/domicilio.jpg"];
const SLIDES = config.ejemplos.map((question, i) => ({ src: IMAGES[i % IMAGES.length] ?? "", question }));

export function Hero({ onSubmit, value, onValueChange, inputRef }: { onSubmit: SubmitQuestion; value?: string; onValueChange?: (value: string) => void; inputRef?: RefObject<HTMLDivElement | null> }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [inputActive, setInputActive] = useState(false);

  useEffect(() => {
    if (!playing || inputActive) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), 6000);
    return () => clearInterval(id);
  }, [playing, inputActive]);

  const prev = () => setIndex((i) => (i - 1 + SLIDES.length) % SLIDES.length);
  const next = () => setIndex((i) => (i + 1) % SLIDES.length);

  return (
    <section className="mx-3 mb-3 md:mx-6 md:mb-6">
      <div className="rounded-[32px] bg-card px-2 pb-3 pt-14 md:px-4 md:pt-20">
        <div className="px-2 text-center">
          <h1 className="font-serif text-[56px] leading-none text-foreground md:text-[96px] lg:text-[112px]">Hola, {config.nombre}</h1>
          <p className="mx-auto mt-5 max-w-md text-base text-muted-foreground md:text-lg">
            {config.subtitulo}
          </p>
        </div>
        <div className="relative mt-10 h-[420px] overflow-hidden rounded-[28px] border border-border md:h-[520px] lg:mx-auto lg:mt-8 lg:h-[600px] lg:max-w-[920px] lg:rounded-[48px]">
          {SLIDES.map((slide, i) => (
            <div
              key={`${i}-${slide.src}`}
              aria-hidden={i !== index}
              className={`absolute inset-0 bg-gradient-to-b from-secondary to-background transition-opacity duration-700 ${i === index ? "opacity-100" : "opacity-0"}`}
            >
              <img
                src={slide.src}
                alt=""
                width={1536}
                height={864}
                loading={i === 0 ? "eager" : "lazy"}
                onError={(e) => { e.currentTarget.style.display = "none"; }}
                className="h-full w-full object-cover"
              />
            </div>
          ))}
          <div className="absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-overlay to-transparent lg:h-56" />
          <div id="hero-question" ref={inputRef} className="relative flex justify-center px-3 pt-6 md:px-8 md:pt-10 lg:px-4 lg:pt-4">
            <AskInput onSubmit={onSubmit} tall suggestion={SLIDES[index]?.question} onActivityChange={setInputActive} value={value} onValueChange={onValueChange} />
          </div>
        </div>
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            type="button"
            onClick={prev}
            aria-label="Pregunta anterior"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:border-white/30 hover:text-foreground"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? "Pausar carrusel" : "Reanudar carrusel"}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:border-white/30 hover:text-foreground"
          >
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="Siguiente pregunta"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:border-white/30 hover:text-foreground"
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="flex justify-start px-1 pb-1 pt-3">
          <span className="rounded-full border border-border bg-background/70 px-3 py-1 text-xs text-muted-foreground">
            Proyecto independiente · no oficial
          </span>
        </div>
      </div>
    </section>
  );
}
