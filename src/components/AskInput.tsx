import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowRight, Loader2, Mic, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useVoiceRecorder, type RecorderStatus } from "@/hooks/use-voice-recorder";

// `viaVoz`: la pregunta llegó por el micrófono y su respuesta se lee en voz alta.
export type SubmitQuestion = (question: string, options?: { viaVoz?: boolean }) => void;

function MicButton({ status, seconds, disabled, onClick, size, className }: {
  status: RecorderStatus;
  seconds: number;
  disabled: boolean;
  onClick: () => void;
  size: number;
  className: string;
}) {
  const label = status === "recording" ? "Detener grabación" : status === "transcribing" ? "Transcribiendo audio" : "Usar micrófono";
  return (
    <Button
      variant="ghost"
      size="icon"
      type="button"
      disabled={status === "transcribing" || (disabled && status === "idle")}
      onClick={onClick}
      aria-label={label}
      aria-pressed={status === "recording"}
      className={`${className} ${status === "recording" ? "w-auto gap-1.5 px-3 text-foreground" : ""}`}
    >
      {status === "recording" ? (
        <>
          <span aria-hidden className="h-2 w-2 rounded-full bg-destructive motion-safe:animate-pulse" />
          <span className="text-xs tabular-nums">0:{String(seconds).padStart(2, "0")}</span>
        </>
      ) : status === "transcribing" ? (
        <Loader2 size={size} className="motion-safe:animate-spin" />
      ) : (
        <Mic size={size} />
      )}
    </Button>
  );
}

export function AskInput({ onSubmit, disabled = false, tall = false, suggestion, onActivityChange, value: controlledValue, onValueChange }: {
  onSubmit: SubmitQuestion;
  disabled?: boolean;
  tall?: boolean;
  suggestion?: string | undefined;
  onActivityChange?: (active: boolean) => void;
  value?: string | undefined;
  onValueChange?: ((value: string) => void) | undefined;
}) {
  const [localValue, setLocalValue] = useState("");
  const value = controlledValue ?? localValue;
  const setValue = onValueChange ?? setLocalValue;
  const inputId = useId();
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

  const recorder = useVoiceRecorder((text) => onSubmit(text, { viaVoz: true }));
  const micProps = { status: recorder.status, seconds: recorder.seconds, disabled, onClick: recorder.toggle };

  const sendClass = "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:bg-primary/90 disabled:bg-primary/15 disabled:text-muted-foreground";
  const iconClass = "shrink-0 rounded-full p-2 text-muted-foreground hover:text-foreground";

  return (
    <>
      {/* Móvil (<640px): rectángulo de dos renglones */}
      <form
        onSubmit={submit}
        className="flex w-full flex-col gap-1 rounded-[24px] border border-white/70 bg-input-bg p-2.5 focus-within:ring-1 focus-within:ring-ring sm:hidden"
      >
        <div className="relative min-w-0 px-1">
          <label htmlFor={`${inputId}-mobile`} className="sr-only">Escribe tu pregunta</label>
          <textarea
            id={`${inputId}-mobile`}
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
          <MicButton {...micProps} size={18} className={iconClass} />
          <Button
            type="submit"
            aria-label="Enviar pregunta"
            disabled={!canSend}
            className={sendClass}
          >
            <ArrowRight size={18} />
          </Button>
        </div>
      </form>

      {/* Desktop (≥640px): píldora de un renglón */}
      <form
        onSubmit={submit}
        className={`relative mx-auto hidden w-full max-w-[640px] items-center gap-1 rounded-full border border-white/70 bg-input-bg py-2 pl-5 pr-2 focus-within:ring-1 focus-within:ring-ring sm:flex ${tall ? "lg:hidden" : ""}`}
      >
        <div className="relative min-w-0 flex-1">
          <label htmlFor={`${inputId}-standard`} className="sr-only">Escribe tu pregunta</label>
          <input
            id={`${inputId}-standard`}
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
        <MicButton {...micProps} size={18} className={iconClass} />
        <Button
          type="submit"
          aria-label="Enviar pregunta"
          disabled={!canSend}
          className={sendClass}
        >
          <ArrowRight size={18} />
        </Button>
      </form>

      {/* Desktop grande (≥1024px) dentro de la foto: píldora alta */}
      {tall && (
        <form
          onSubmit={submit}
          className="relative mx-auto hidden w-full min-h-[88px] items-center gap-2 rounded-full border border-white/70 bg-input-bg py-3 pl-6 pr-3 focus-within:ring-1 focus-within:ring-ring lg:flex"
        >
          <div className="relative min-w-0 flex-1">
            <label htmlFor={`${inputId}-wide`} className="sr-only">Escribe tu pregunta</label>
            <input
              id={`${inputId}-wide`}
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
          <MicButton {...micProps} size={22} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full p-0 text-muted-foreground hover:text-foreground" />
          <Button
            type="submit"
            aria-label="Enviar pregunta"
            disabled={!canSend}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:bg-primary/90 disabled:bg-primary/15 disabled:text-muted-foreground"
          >
            <ArrowRight size={22} />
          </Button>
        </form>
      )}

      {recorder.error && (
        <p role="alert" className="mx-auto mt-2 max-w-[640px] px-2 text-sm leading-5 text-muted-foreground">{recorder.error}</p>
      )}
    </>
  );
}
