// Edge function `ask`: pregunta → búsqueda híbrida → Gemma 4 → {answer, sources}.
// El modelo nunca escribe URLs: cita fragmentos [n] y aquí se convierten en
// las ligas reales de la base. Sin cita o con NO_LO_SE, sources va vacío.

const GEMINI = "https://generativelanguage.googleapis.com/v1beta";
const EMBED_MODEL = "gemini-embedding-2";
const MODELS = ["gemma-4-31b-it", "gemma-4-26b-a4b-it"];
const MAX_QUESTION = 500;
const NO_ANSWER = "No encontré esto en las fuentes oficiales que tengo.";

const SYSTEM_PROMPT = `Eres Ventanilla, un asistente de trámites de la Ciudad de México.

Reglas:
1. Responde SOLO con información de los fragmentos numerados que te doy. No uses lo que sepas por tu cuenta.
2. Nunca inventes requisitos, costos, plazos, horarios ni ligas. Si la pregunta pide un dato (por ejemplo, el costo) que no aparece en los fragmentos, dilo claramente.
3. Respuesta corta: de 2 a 5 oraciones o una lista breve. Español de México, tuteando, claro y amable.
4. Cita cada dato con el número de su fragmento entre corchetes, por ejemplo [1] o [2][3]. No escribas URLs.
5. Para COSTOS, la fuente prioritaria es data.finanzas.cdmx.gob.mx/formato_lc (es la que genera la línea de captura). Si otra fuente oficial da un monto distinto, dilo explícitamente, por ejemplo: "la ficha indica $X, pero el monto vigente para pago según Finanzas es $Y", y cita ambas.
6. Si los fragmentos no contienen la respuesta a la pregunta, responde exactamente: NO_LO_SE`;

type Doc = {
  id: number;
  tramite: string;
  titulo: string;
  url: string;
  contenido: string;
  score: number;
};
type Source = { titulo: string; url: string };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Expose-Headers": "x-ventanilla-model",
};

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extra },
  });
}

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Falta ${name}`);
  return value;
}

async function embedQuestion(question: string): Promise<number[] | null> {
  try {
    const response = await fetch(`${GEMINI}/models/${EMBED_MODEL}:embedContent`, {
      method: "POST",
      headers: { "x-goog-api-key": env("GEMINI_API_KEY"), "Content-Type": "application/json" },
      body: JSON.stringify({
        content: { parts: [{ text: `task: search result | query: ${question}` }] },
        output_dimensionality: 768,
      }),
    });
    if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
    return (await response.json()).embedding.values;
  } catch (error) {
    // La búsqueda full-text sigue funcionando sin embedding.
    console.error("embedding falló:", error);
    return null;
  }
}

async function search(question: string, embedding: number[] | null): Promise<Doc[]> {
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const response = await fetch(`${env("SUPABASE_URL")}/rest/v1/rpc/buscar_docs`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query_text: question, query_embedding: embedding, match_count: 5 }),
  });
  if (!response.ok) throw new Error(`buscar_docs ${response.status} ${await response.text()}`);
  return await response.json();
}

async function generate(model: string, question: string, docs: Doc[]): Promise<string> {
  const fragments = docs
    // La URL va en el encabezado para que el modelo sepa qué fuente es cuál
    // (p. ej. Finanzas para costos); en la respuesta solo cita [n].
    .map((doc, i) => `[${i + 1}] ${doc.titulo}\nFuente: ${doc.url}\n${doc.contenido}`)
    .join("\n\n---\n\n");
  const response = await fetch(`${GEMINI}/models/${model}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": env("GEMINI_API_KEY"), "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [
        { role: "user", parts: [{ text: `Fragmentos:\n\n${fragments}\n\nPregunta: ${question}` }] },
      ],
      generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
    }),
  });
  if (!response.ok) throw new Error(`${model} ${response.status} ${await response.text()}`);
  const data = await response.json();
  const parts: { text?: string; thought?: boolean }[] = data.candidates?.[0]?.content?.parts ?? [];
  return parts
    .filter((part) => !part.thought && part.text)
    .map((part) => part.text)
    .join("")
    .trim();
}

// Convierte las citas [n] / [n, m] en fuentes, solo de los fragmentos citados,
// sin URLs repetidas y en orden de aparición.
function citedSources(text: string, docs: Doc[]): Source[] {
  const seen = new Set<string>();
  const sources: Source[] = [];
  for (const match of text.matchAll(/\[(\d+(?:\s*,\s*\d+)*)\]/g)) {
    for (const n of match[1].split(",").map((s) => Number(s.trim()))) {
      const doc = docs[n - 1];
      if (!doc || seen.has(doc.url)) continue;
      seen.add(doc.url);
      sources.push({ titulo: doc.titulo, url: doc.url });
    }
  }
  return sources;
}

function stripCitations(text: string): string {
  return text
    .replace(/\s*\[(\d+(?:\s*,\s*\d+)*)\]/g, "")
    .replace(/\s*\(?https?:\/\/[^\s)]+\)?/g, "") // las ligas solo van en sources
    .replace(/[ \t]+([.,;:])/g, "$1")
    .trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Usa POST" }, 405);

  let body: { question?: unknown; model?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }
  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question) return json({ error: "Falta question" }, 400);
  if (question.length > MAX_QUESTION)
    return json({ error: `Máximo ${MAX_QUESTION} caracteres` }, 400);

  // `model` solo se acepta para el benchmark y solo de la lista permitida.
  const primary =
    typeof body.model === "string" && MODELS.includes(body.model)
      ? body.model
      : (Deno.env.get("ASK_MODEL") ?? MODELS[0]);
  const models = [primary, ...MODELS.filter((m) => m !== primary)];

  try {
    const docs = await search(question, await embedQuestion(question));
    if (docs.length === 0) return json({ answer: NO_ANSWER, sources: [] });

    let text = "";
    let used = "";
    for (const model of models) {
      try {
        text = await generate(model, question, docs);
        used = model;
        break;
      } catch (error) {
        console.error("generación falló:", error);
      }
    }
    if (!used) return json({ error: "El modelo no respondió. Intenta de nuevo." }, 502);

    const headers = { "x-ventanilla-model": used };
    const sources = text.includes("NO_LO_SE") ? [] : citedSources(text, docs);
    if (sources.length === 0) return json({ answer: NO_ANSWER, sources: [] }, 200, headers);
    return json({ answer: stripCitations(text), sources }, 200, headers);
  } catch (error) {
    console.error(error);
    return json({ error: "Error interno" }, 500);
  }
});
