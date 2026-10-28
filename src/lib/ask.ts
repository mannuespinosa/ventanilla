export type Source = { titulo: string; url: string };
export type AskResponse = { answer: string; sources: Source[] };

// La URL de la función no es secreta; VITE_ASK_URL permite apuntar a otra.
export const ASK_URL: string =
  import.meta.env["VITE_ASK_URL"] || "https://ngwzqmvqfchqiogxjzki.supabase.co/functions/v1/ask";

function isSource(value: unknown): value is Source {
  if (typeof value !== "object" || value === null) return false;
  const { titulo, url } = value as Record<string, unknown>;
  return typeof titulo === "string" && typeof url === "string" && /^https?:\/\//.test(url);
}

export async function ask(question: string): Promise<AskResponse> {
  const response = await fetch(ASK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  if (!response.ok) throw new Error(`ask respondió ${response.status}`);

  const data: unknown = await response.json();
  const { answer, sources } = (data ?? {}) as Record<string, unknown>;
  if (typeof answer !== "string" || !Array.isArray(sources))
    throw new Error("Respuesta de ask con forma inválida");
  return { answer, sources: sources.filter(isSource) };
}
