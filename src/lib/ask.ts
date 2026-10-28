import { config } from "./config";

export type Source = { titulo: string; url: string };
// `model` es el modelo que respondió (header x-ventanilla-model), si hubo uno.
export type AskResponse = { answer: string; sources: Source[]; model?: string };
// Interacciones previas para que `ask` entienda seguimientos como "¿dónde puedo pagar?".
export type HistoryTurn = { question: string; answer: string };
export const MAX_HISTORY = 3;

// Viene de ventanilla.config.json → endpoints.ask; VITE_ASK_URL permite apuntar a otra.
export const ASK_URL: string = config.endpoints.ask;

function isSource(value: unknown): value is Source {
  if (typeof value !== "object" || value === null) return false;
  const { titulo, url } = value as Record<string, unknown>;
  return typeof titulo === "string" && typeof url === "string" && /^https?:\/\//.test(url);
}

export async function ask(question: string, history: HistoryTurn[] = []): Promise<AskResponse> {
  const recent = history.filter((turn) => turn.answer).slice(-MAX_HISTORY);
  const response = await fetch(ASK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, ...(recent.length ? { history: recent } : {}) }),
  });
  if (!response.ok) throw new Error(`ask respondió ${response.status}`);

  const data: unknown = await response.json();
  const { answer, sources } = (data ?? {}) as Record<string, unknown>;
  if (typeof answer !== "string" || !Array.isArray(sources))
    throw new Error("Respuesta de ask con forma inválida");
  const model = response.headers.get("x-ventanilla-model");
  return { answer, sources: sources.filter(isSource), ...(model ? { model } : {}) };
}
