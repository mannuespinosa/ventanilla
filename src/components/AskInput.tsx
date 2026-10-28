import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowUp, Mic, Paperclip } from "lucide-react";

const PROMPTS = [
  "Prueba: ¿cómo renuevo mi licencia de conducir?",
  "Prueba: ¿qué necesito para sacar el acta de nacimiento?",
  "Prueba: ¿cómo pago la tenencia?",
  "Prueba: ¿dónde tramito mi constancia de domicilio?",
];

export function AskInput({ onSubmit }: { onSubmit: (question: string) => void }) {
  const [value, setValue] = useState("");
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const id = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx((i) => (i + 1) % PROMPTS.length);
        setVisible(true);
      }, 300);
    }, 3000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  const trimmed = value.trim();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!trimmed) return;
    onSubmit(trimmed);
  };
  const sendNow = () => {
    if (!trimmed) return;
    onSubmit(trimmed);
  };

  return (
    <>
      {/* Móvil (<640px): rectángulo de dos renglones */}
      <form
        onSubmit={submit}
        className="ask-glow flex w-full flex-col gap-1 rounded-[24px] border border-border bg-input-bg p-2.5 sm:hidden"
      >
        <div className="relative min-w-0 px-1">
          <label htmlFor="ask-mobile" className="sr-only">Escribe tu pregunta</label>
          <textarea
            id="ask-mobile"
            ref={taRef}
            rows={1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendNow();
              }
            }}
            className="block max-h-28 w-full resize-none overflow-y-auto bg-transparent py-1 text-base text-foreground outline-none"
            autoComplete="off"
          />
          {!value && (
            <span
              aria-hidden
              className={`pointer-events-none absolute inset-x-1 top-1 text-muted-foreground transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}
            >
              {PROMPTS[idx]}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center justify-end gap-1">
          <button type="button" aria-label="Adjuntar archivo" className="shrink-0 rounded-full p-2 text-muted-foreground hover:text-foreground">
            <Paperclip size={18} />
          </button>
          <button type="button" aria-label="Usar micrófono" className="shrink-0 rounded-full p-2 text-muted-foreground hover:text-foreground">
            <Mic size={18} />
          </button>
          <button
            type="submit"
            aria-label="Enviar pregunta"
            disabled={!trimmed}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:brightness-110 disabled:opacity-40"
          >
            <ArrowUp size={18} />
          </button>
        </div>
      </form>

      {/* Desktop (≥640px): píldora de un renglón */}
      <form
        onSubmit={submit}
        className="ask-glow relative mx-auto hidden w-full max-w-[640px] items-center gap-1 rounded-full border border-border bg-input-bg py-2 pl-5 pr-2 sm:flex"
      >
        <div className="relative min-w-0 flex-1">
          <label htmlFor="ask" className="sr-only">Escribe tu pregunta</label>
          <input
            id="ask"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full bg-transparent py-2 text-base text-foreground outline-none"
            autoComplete="off"
          />
          {!value && (
            <span
              aria-hidden
              className={`pointer-events-none absolute inset-y-0 left-0 right-0 flex items-center truncate text-muted-foreground transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}
            >
              {PROMPTS[idx]}
            </span>
          )}
        </div>
        <button type="button" aria-label="Adjuntar archivo" className="shrink-0 rounded-full p-2 text-muted-foreground hover:text-foreground">
          <Paperclip size={18} />
        </button>
        <button type="button" aria-label="Usar micrófono" className="shrink-0 rounded-full p-2 text-muted-foreground hover:text-foreground">
          <Mic size={18} />
        </button>
        <button
          type="submit"
          aria-label="Enviar pregunta"
          disabled={!trimmed}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:brightness-110 disabled:opacity-40"
        >
          <ArrowUp size={18} />
        </button>
      </form>
    </>
  );
}
