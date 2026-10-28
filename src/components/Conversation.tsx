import { useEffect, useRef } from "react";
import { Link as LinkIcon } from "lucide-react";
import { AskInput } from "./AskInput";
import type { AskResponse } from "@/lib/ask";

export type ConversationTurn = { id: number; question: string; response?: AskResponse };

function ModelLabel({ model }: { model?: string | undefined }) {
  if (!model) return null;
  const name = model.startsWith("gemma-4") ? "Gemma 4" : model;
  return (
    <p className="mt-4 text-xs text-muted-foreground" title={model}>
      Respondido por {name} · modelo abierto
    </p>
  );
}

export function Conversation({ turns, pending, onSubmit }: {
  turns: ConversationTurn[];
  pending: boolean;
  onSubmit: (question: string) => void;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "end" });
  }, [turns]);

  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label="Conversación">
      <div className="min-h-0 flex-1 overflow-y-auto px-5 sm:px-8">
        <div className="mx-auto max-w-[720px] space-y-9 pb-8 pt-6" role="log" aria-label="Mensajes" aria-live="polite">
          {turns.map((turn) => (
            <div key={turn.id} className="space-y-6">
              <div className="flex justify-end">
                <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-sm bg-muted px-5 py-3 text-base leading-6 text-foreground">{turn.question}</p>
              </div>
              {!turn.response ? (
                <div role="status" aria-label="Buscando respuesta" className="flex h-7 items-center gap-1.5">
                  {[0, 1, 2].map((dot) => <span key={dot} className={`loading-dot loading-dot-${dot} h-1.5 w-1.5 rounded-full bg-muted-foreground`} />)}
                </div>
              ) : turn.response.sources.length === 0 ? (
                <div>
                  <p className="rounded-lg border border-warning-border bg-warning-bg px-4 py-3 text-base leading-7 text-foreground">No encontré una fuente oficial para responder esto con seguridad. Prefiero no adivinar.</p>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">Intenta reformular la pregunta o consulta el portal de trámites de la CDMX.</p>
                  <ModelLabel model={turn.response.model} />
                </div>
              ) : (
                <div>
                  <p className="whitespace-pre-wrap break-words font-sans text-base leading-7 text-foreground sm:text-[17px]">{turn.response.answer}</p>
                  <p className="mb-2 mt-5 text-xs text-muted-foreground">Fuentes</p>
                  <div className="flex flex-wrap gap-2">
                    {turn.response.sources.map((source, i) => (
                      <a key={`${source.url}-${i}`} href={source.url} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-2 rounded-lg border border-border px-3 py-2 transition-colors hover:border-white/30 hover:bg-card focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                        <LinkIcon size={15} className="shrink-0 text-muted-foreground" />
                        <span className="min-w-0 text-sm">
                          <span className="block break-words text-foreground">{source.titulo}</span>
                          <span className="block break-all text-xs text-muted-foreground">{new URL(source.url).hostname}</span>
                        </span>
                      </a>
                    ))}
                  </div>
                  <ModelLabel model={turn.response.model} />
                </div>
              )}
            </div>
          ))}
          <div ref={endRef} />
        </div>
      </div>
      <div className="sticky bottom-0 shrink-0 bg-gradient-to-t from-background via-background to-transparent px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-8 sm:px-8">
        <div className="mx-auto max-w-[720px]">
          <AskInput onSubmit={onSubmit} disabled={pending} />
        </div>
      </div>
    </section>
  );
}