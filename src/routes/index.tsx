import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { Home } from "@/components/Home";
import { useRef, useState } from "react";
import { Conversation, type ConversationTurn } from "@/components/Conversation";
import { ask } from "@/lib/ask";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ventanilla — Trámites de la CDMX, sin vueltas" },
      { name: "description", content: "Asistente independiente y open source para resolver dudas sobre trámites de la Ciudad de México." },
      { property: "og:title", content: "Ventanilla — Trámites de la CDMX" },
      { property: "og:description", content: "Pregunta sobre trámites de la CDMX y recibe respuestas con la fuente oficial." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

export function Index() {
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [pending, setPending] = useState(false);
  const requestRef = useRef(0);
  const busyRef = useRef(false);

  const reset = () => {
    requestRef.current += 1;
    busyRef.current = false;
    setPending(false);
    setTurns([]);
  };

  const submit = async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || busyRef.current) return;
    busyRef.current = true;
    const id = ++requestRef.current;
    setPending(true);
    // Turnos ya respondidos antes de esta pregunta; ask.ts se queda con los últimos.
    const history = turns.flatMap((turn) =>
      turn.response ? [{ question: turn.question, answer: turn.response.answer }] : [],
    );
    setTurns((current) => [...current, { id, question: trimmed }]);
    try {
      const response = await ask(trimmed, history);
      if (requestRef.current !== id) return;
      setTurns((current) => current.map((turn) => turn.id === id ? { ...turn, response } : turn));
    } catch {
      if (requestRef.current !== id) return;
      setTurns((current) => current.map((turn) => turn.id === id ? { ...turn, response: { answer: "", sources: [] } } : turn));
    } finally {
      if (requestRef.current === id) {
        busyRef.current = false;
        setPending(false);
      }
    }
  };

  return (
    <main className={turns.length ? "flex h-dvh flex-col overflow-hidden bg-background" : "min-h-screen bg-background"}>
      <div className="shrink-0"><SiteHeader onHome={reset} /></div>
      {turns.length ? <Conversation turns={turns} pending={pending} onSubmit={submit} /> : <Home onSubmit={submit} />}
    </main>
  );
}
