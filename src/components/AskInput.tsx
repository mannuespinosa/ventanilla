import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowUp, Mic, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AskInput({ onSubmit, disabled = false, tall = false, suggestion, onActivityChange }: {
  onSubmit: (question: string) => void;
  disabled?: boolean;
  tall?: boolean;
  suggestion?: string | undefined;
  onActivityChange?: (active: boolean) => void;
}) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    onActivityChange?.(focused || value.length > 0);
  }, [focused, value, onActivityChange]);

  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  const trimmed = value.trim();
  const placeholder = suggestion ? `Prueba: ${suggestion}` : "Escribe tu pregunta...";
  const canSend = Boolean(trimmed || suggestion) && !disabled;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    sendNow();
  };
  const sendNow = () => {
    const text = trimmed || suggestion?.trim() || "";
    if (!text || disabled) return;
    onSubmit(text);
    setValue("");
  };

  const sendClass = "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-neutral-900 transition hover:bg-white/90 disabled:bg-white/15 disabled:text-neutral-400";
  const iconClass = "shrink-0 rounded-full p-2 text-muted-foreground hover:text-foreground";

  return (
    <>
      {/* Móvil (<640px): rectángulo de dos renglones */}
      <form
        onSubmit={submit}
        className="flex w-full flex-col gap-1 rounded-[24px] border border-border bg-input-bg p-2.5 focus-within:ring-1 focus-within:ring-white/30 sm:hidden"
      >
        <div className="relative min-w-0 px-1">
          <label htmlFor="ask-mobile" className="sr-only">Escribe tu pregunta</label>
          <textarea
            id="ask-mobile"
            ref={taRef}
            rows={1}
            disabled={disabled}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                sendNow();
              }
            }}
            className={`block max-h-[104px] w-full resize-none overflow-y-auto bg-transparent py-1 text-base leading-6 text-foreground outline-none disabled:opacity-60 ${!value ? "min-h-14" : ""}`}
            autoComplete="off"
          />
          {!value && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-1 top-1 text-base leading-6 text-muted-foreground"
            >
              {placeholder}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center justify-end gap-1">
          <Button variant="ghost" size="icon" disabled={disabled} type="button" aria-label="Adjuntar archivo" className={iconClass}>
            <Paperclip size={18} />
          </Button>
          <Button variant="ghost" size="icon" disabled={disabled} type="button" aria-label="Usar micrófono" className={iconClass}>
            <Mic size={18} />
          </Button>
          <Button
            type="submit"
            aria-label="Enviar pregunta"
            disabled={!canSend}
            className={sendClass}
          >
            <ArrowUp size={18} />
          </Button>
        </div>
      </form>

      {/* Desktop (≥640px): píldora de un renglón */}
      <form
        onSubmit={submit}
        className={`relative mx-auto hidden w-full max-w-[640px] items-center gap-1 rounded-full border border-border bg-input-bg py-2 pl-5 pr-2 focus-within:ring-1 focus-within:ring-white/30 sm:flex ${tall ? "lg:hidden" : ""}`}
      >
        <div className="relative min-w-0 flex-1">
          <label htmlFor="ask" className="sr-only">Escribe tu pregunta</label>
          <input
            id="ask"
            disabled={disabled}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            className="w-full bg-transparent py-2 text-base text-foreground outline-none"
            autoComplete="off"
          />
          {!value && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 right-0 flex items-center truncate text-muted-foreground"
            >
              {placeholder}
            </span>
          )}
        </div>
        <Button variant="ghost" size="icon" disabled={disabled} type="button" aria-label="Adjuntar archivo" className={iconClass}>
          <Paperclip size={18} />
        </Button>
        <Button variant="ghost" size="icon" disabled={disabled} type="button" aria-label="Usar micrófono" className={iconClass}>
          <Mic size={18} />
        </Button>
        <Button
          type="submit"
          aria-label="Enviar pregunta"
          disabled={!canSend}
          className={sendClass}
        >
          <ArrowUp size={18} />
        </Button>
      </form>

      {/* Desktop grande (≥1024px) dentro de la foto: píldora alta */}
      {tall && (
        <form
          onSubmit={submit}
          className="relative mx-auto hidden w-full min-h-[88px] items-center gap-2 rounded-full border border-border bg-input-bg py-3 pl-6 pr-3 focus-within:ring-1 focus-within:ring-white/30 lg:flex"
        >
          <div className="relative min-w-0 flex-1">
            <label htmlFor="ask-wide" className="sr-only">Escribe tu pregunta</label>
            <input
              id="ask-wide"
              disabled={disabled}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              className="w-full bg-transparent py-2 text-xl text-foreground outline-none"
              autoComplete="off"
            />
            {!value && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-0 right-0 flex items-center truncate text-xl text-muted-foreground"
              >
                {placeholder}
              </span>
            )}
          </div>
          <Button variant="ghost" size="icon" disabled={disabled} type="button" aria-label="Adjuntar archivo" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full p-0 text-muted-foreground hover:text-foreground">
            <Paperclip size={22} />
          </Button>
          <Button variant="ghost" size="icon" disabled={disabled} type="button" aria-label="Usar micrófono" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full p-0 text-muted-foreground hover:text-foreground">
            <Mic size={22} />
          </Button>
          <Button
            type="submit"
            aria-label="Enviar pregunta"
            disabled={!canSend}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-neutral-900 transition hover:bg-white/90 disabled:bg-white/15 disabled:text-neutral-400"
          >
            <ArrowUp size={22} />
          </Button>
        </form>
      )}
    </>
  );
}
