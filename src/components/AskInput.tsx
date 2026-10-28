import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowRight, Check, Loader2, Mic, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useVoiceRecorder } from "@/hooks/use-voice-recorder";

// `viaVoz`: la pregunta llegó por el micrófono y su respuesta se lee en voz alta.
export type SubmitQuestion = (question: string, options?: { viaVoz?: boolean }) => void;

type Recorder = ReturnType<typeof useVoiceRecorder>;

// Barras de nivel del micrófono: se dibujan fuera de React para no re-renderizar a 60 fps.
function LevelBars({ analyser }: { analyser: AnalyserNode | null }) {
  const barsRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const container = barsRef.current;
    if (!analyser || !container) return;
    const bars = Array.from(container.children) as HTMLElement[];
    const data = new Uint8Array(analyser.frequencyBinCount);
    let frame = 0;
    const draw = () => {
      analyser.getByteFrequencyData(data);
      bars.forEach((bar, i) => {
        // Cada barra promedia tres bandas de ~190 Hz dentro del rango de la voz.
        const level = ((data[1 + i * 3] ?? 0) + (data[2 + i * 3] ?? 0) + (data[3 + i * 3] ?? 0)) / 765;
        bar.style.transform = `scaleY(${Math.max(0.15, Math.min(1, level * 1.4))})`;
      });
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [analyser]);

  return (
    <span ref={barsRef} aria-hidden className="flex h-5 shrink-0 items-center gap-[3px]">
      {[0, 1, 2, 3, 4].map((bar) => (
        <span key={bar} className="h-full w-[3px] origin-center scale-y-[0.15] rounded-full bg-foreground" />
      ))}
    </span>
  );
}

// El composer en modo grabación: "Escuchando…" + nivel + contador, ✕ cancela y ✓ envía.
function RecordingControls({ recorder, size, large = false }: { recorder: Recorder; size: number; large?: boolean }) {
  const transcribing = recorder.status === "transcribing";
  return (
    <>
      <div role="status" className={`flex min-w-0 flex-1 items-center gap-3 ${large ? "text-xl" : "text-base"}`}>
        {recorder.liveText ? (
          // RTL + texto LTR aislado: si no cabe, se ve el final (lo último que dijiste).
          <span className="min-w-0 flex-1 truncate text-left text-foreground [direction:rtl]">
            <span dir="ltr" className="[unicode-bidi:isolate]">{recorder.liveText}</span>
          </span>
        ) : (
          <span className="truncate text-foreground">{transcribing ? "Transcribiendo…" : "Escuchando…"}</span>
        )}
        {!transcribing && <LevelBars analyser={recorder.analyser} />}
        <span className="shrink-0 text-sm tabular-nums text-muted-foreground">0:{String(recorder.seconds).padStart(2, "0")}</span>
      </div>
      <Button
        variant="ghost"
        size="icon"
        type="button"
        onClick={recorder.cancel}
        aria-label="Cancelar grabación"
        className={large ? "flex h-11 w-11 shrink-0 items-center justify-center rounded-full p-0 text-muted-foreground hover:text-foreground" : "shrink-0 rounded-full p-2 text-muted-foreground hover:text-foreground"}
      >
        <X size={size} />
      </Button>
      <button
        type="button"
        onClick={recorder.confirm}
        disabled={transcribing}
        autoFocus
        aria-label={transcribing ? "Transcribiendo audio" : "Enviar audio"}
        className={`flex shrink-0 items-center justify-center rounded-full bg-confirm text-white transition hover:bg-confirm/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${large ? "h-12 w-12" : "h-10 w-10"}`}
      >
        {transcribing ? <Loader2 size={size} className="motion-safe:animate-spin" /> : <Check size={size} strokeWidth={2.5} />}
      </button>
    </>
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
  const recorder = useVoiceRecorder((text) => onSubmit(text, { viaVoz: true }));
  const recording = recorder.status !== "idle";

  useEffect(() => {
    onActivityChange?.(focused || value.length > 0 || recording);
  }, [focused, value, recording, onActivityChange]);

  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value, recording]);

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

  const sendClass = "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:bg-primary/90 disabled:bg-primary/15 disabled:text-muted-foreground";
  const iconClass = "shrink-0 rounded-full p-2 text-muted-foreground hover:text-foreground";
  const startRecording = () => void recorder.start();

  return (
    <div className="w-full">
      {/* Móvil (<640px): rectángulo de dos renglones */}
      <form
        onSubmit={submit}
        className="flex w-full flex-col gap-1 rounded-[24px] border border-white/70 bg-input-bg p-2.5 focus-within:ring-1 focus-within:ring-ring sm:hidden"
      >
        {recording ? (
          <div className="flex min-h-14 items-center gap-1 pl-2">
            <RecordingControls recorder={recorder} size={18} />
          </div>
        ) : (
          <>
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
              <Button variant="ghost" size="icon" disabled={disabled} type="button" onClick={startRecording} aria-label="Usar micrófono" className={iconClass}>
                <Mic size={18} />
              </Button>
              <Button
                type="submit"
                aria-label="Enviar pregunta"
                disabled={!canSend}
                className={sendClass}
              >
                <ArrowRight size={18} />
              </Button>
            </div>
          </>
        )}
      </form>

      {/* Desktop (≥640px): píldora de un renglón */}
      <form
        onSubmit={submit}
        className={`relative mx-auto hidden w-full max-w-[640px] items-center gap-1 rounded-full border border-white/70 bg-input-bg py-2 pl-5 pr-2 focus-within:ring-1 focus-within:ring-ring sm:flex ${tall ? "lg:hidden" : ""}`}
      >
        {recording ? (
          <RecordingControls recorder={recorder} size={18} />
        ) : (
          <>
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
            <Button variant="ghost" size="icon" disabled={disabled} type="button" onClick={startRecording} aria-label="Usar micrófono" className={iconClass}>
              <Mic size={18} />
            </Button>
            <Button
              type="submit"
              aria-label="Enviar pregunta"
              disabled={!canSend}
              className={sendClass}
            >
              <ArrowRight size={18} />
            </Button>
          </>
        )}
      </form>

      {/* Desktop grande (≥1024px) dentro de la foto: píldora alta */}
      {tall && (
        <form
          onSubmit={submit}
          className="relative mx-auto hidden w-full min-h-[88px] items-center gap-2 rounded-full border border-white/70 bg-input-bg py-3 pl-6 pr-3 focus-within:ring-1 focus-within:ring-ring lg:flex"
        >
          {recording ? (
            <RecordingControls recorder={recorder} size={22} large />
          ) : (
            <>
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
              <Button variant="ghost" size="icon" disabled={disabled} type="button" onClick={startRecording} aria-label="Usar micrófono" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full p-0 text-muted-foreground hover:text-foreground">
                <Mic size={22} />
              </Button>
              <Button
                type="submit"
                aria-label="Enviar pregunta"
                disabled={!canSend}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:bg-primary/90 disabled:bg-primary/15 disabled:text-muted-foreground"
              >
                <ArrowRight size={22} />
              </Button>
            </>
          )}
        </form>
      )}

      {recorder.error && (
        <p role="alert" className="mx-auto mt-2 max-w-[640px] px-2 text-sm leading-5 text-muted-foreground">{recorder.error}</p>
      )}
    </div>
  );
}
