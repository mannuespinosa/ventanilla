// Edge function `voice`: voz con ElevenLabs, sin tocar el RAG de `ask`.
//   POST /voice/stt  multipart { audio }  → { text }
//   POST /voice/tts  { text } (markdown de ask) → audio/mpeg
//   POST /voice/token → { token } de un solo uso para Scribe Realtime en el navegador
// La versión hablada se arma de forma determinista: sin LLM.
// Solo responde a los orígenes de `origenes_permitidos`; sin Origin (curl),
// solo con el header X-Ventanilla-Dev igual al secreto VENTANILLA_DEV_TOKEN.

import config from "../../../ventanilla.config.json" with { type: "json" };

const ELEVEN = "https://api.elevenlabs.io/v1";
const VOZ = config.voz;
const ORIGENES = new Set(config.origenes_permitidos);
const MAX_AUDIO_BYTES = 5 * 1024 * 1024;
const MAX_TEXT = 10_000;
const MAX_SPOKEN = 400;
// Bitrate bajo: suficiente para voz y ligero en móvil.
const OUTPUT_FORMAT = "mp3_22050_32";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Falta ${name}`);
  return value;
}

// Comparación en tiempo constante para no filtrar el token por latencia.
function sameSecret(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

function allowed(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (origin) return ORIGENES.has(origin);
  const token = Deno.env.get("VENTANILLA_DEV_TOKEN");
  const dev = req.headers.get("x-ventanilla-dev");
  return !!token && !!dev && sameSecret(dev, token);
}

// ---------- Números a palabras (para montos en pesos) ----------

const UNIDADES = [
  "cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve",
  "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete",
  "dieciocho", "diecinueve", "veinte", "veintiuno", "veintidós", "veintitrés",
  "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve",
];
const DECENAS = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
const CENTENAS = [
  "", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos",
  "seiscientos", "setecientos", "ochocientos", "novecientos",
];

function hasta999(n: number): string {
  if (n === 100) return "cien";
  const parts: string[] = [];
  const c = Math.floor(n / 100);
  const r = n % 100;
  if (c) parts.push(CENTENAS[c]);
  if (r) {
    parts.push(r < 30 ? UNIDADES[r] : DECENAS[Math.floor(r / 10)] + (r % 10 ? ` y ${UNIDADES[r % 10]}` : ""));
  }
  return parts.join(" ");
}

// "uno" → "un" antes de sustantivo: "veintiún pesos", "un millón".
function apocope(words: string): string {
  return words.replace(/uno$/, "un").replace(/veintiun$/, "veintiún");
}

// Hasta 999,999,999; devuelve la forma que va antes de "pesos".
function numeroEnLetras(n: number): string {
  if (n === 0) return "cero";
  const millones = Math.floor(n / 1_000_000);
  const miles = Math.floor(n / 1000) % 1000;
  const resto = n % 1000;
  const parts: string[] = [];
  if (millones) parts.push(millones === 1 ? "un millón" : `${apocope(hasta999(millones))} millones`);
  if (miles) parts.push(miles === 1 ? "mil" : `${apocope(hasta999(miles))} mil`);
  if (resto) parts.push(apocope(hasta999(resto)));
  // "dos millones de pesos", pero "dos millones cien pesos".
  if (millones && !miles && !resto) parts.push("de");
  return parts.join(" ");
}

function pesos(entero: string, centavos: string | undefined): string {
  const n = Number(entero.replace(/,/g, ""));
  if (!Number.isSafeInteger(n) || n >= 1_000_000_000) return `${entero} pesos`;
  let spoken = `${numeroEnLetras(n)} ${n === 1 ? "peso" : "pesos"}`;
  const c = centavos ? Number(centavos.padEnd(2, "0")) : 0;
  if (c) spoken += ` con ${apocope(hasta999(c))} ${c === 1 ? "centavo" : "centavos"}`;
  return spoken;
}

// ---------- Markdown → versión hablada ----------

function toSpoken(markdown: string): string {
  let text = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\s*\[\d+(?:\s*,\s*\d+)*\]/g, "") // citas [1], [2][3], [1, 2]
    .replace(/\s*\(?(?:https?:\/\/|www\.)[^\s)]+\)?/g, "")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/^\s*(?:[-*+•]|\d+[.)])\s+/gm, "")
    .replace(/^\s*\|?[\s:|-]+\|[\s:|-]*$/gm, "") // separador de tablas
    .replace(/\s*\|\s*/g, ", ")
    .replace(/(\*{1,3})(\S(?:.*?\S)?)\1/g, "$2")
    .replace(/(?<!\w)(_{1,3})(\S(?:.*?\S)?)\1(?!\w)/g, "$2")
    .replace(/[*~]+|(?<!\w)_+|_+(?!\w)/g, "")
    .replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}\uFE0F\u200D]/gu, "");

  // Montos: "$1,142" → "mil ciento cuarenta y dos pesos" (sin duplicar "pesos"/"MXN").
  text = text.replace(
    /\$\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?(?:\s*(?:pesos|MXN|M\.N\.))?/gi,
    (_, entero: string, centavos?: string) => pesos(entero, centavos),
  );
  // Otros números con separador de miles: "1,142" se leería "uno coma…".
  text = text.replace(/\b\d{1,3}(?:,\d{3})+\b/g, (n) => n.replace(/,/g, ""));

  // Cada renglón (p. ej. un elemento de lista) termina como oración.
  text = text
    .split("\n")
    .map((line) => line.trim().replace(/[,;:]$/, ""))
    .filter(Boolean)
    .map((line) => (/[.!?…]$/.test(line) ? line : `${line}.`))
    .join(" ")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim();

  return truncate(text, MAX_SPOKEN);
}

// Corta en límite de oración; si la primera ya excede, en el último espacio.
function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const sentences = text.split(/(?<=[.!?…])\s+/);
  let out = "";
  for (const sentence of sentences) {
    const next = out ? `${out} ${sentence}` : sentence;
    if (next.length > max) break;
    out = next;
  }
  if (out) return out;
  const cut = text.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:]$/, "")}…`;
}

// ---------- ElevenLabs ----------

async function speechToText(audio: File): Promise<string> {
  const form = new FormData();
  form.append("file", audio, audio.name || "audio");
  form.append("model_id", VOZ.modelo_stt);
  form.append("language_code", VOZ.idioma);
  form.append("tag_audio_events", "false");
  // Campo repetido, uno por término (así lo manda el SDK oficial).
  for (const term of VOZ.terminos_clave) form.append("keyterms", term);

  const response = await fetch(`${ELEVEN}/speech-to-text`, {
    method: "POST",
    headers: { "xi-api-key": env("ELEVENLABS_API_KEY") },
    body: form,
  });
  if (!response.ok) throw new Error(`STT ${response.status} ${await response.text()}`);
  const data = await response.json();
  return typeof data.text === "string" ? data.text.trim() : "";
}

async function textToSpeech(text: string, voiceId: string): Promise<ArrayBuffer> {
  const response = await fetch(
    `${ELEVEN}/text-to-speech/${voiceId}?output_format=${OUTPUT_FORMAT}`,
    {
      method: "POST",
      headers: { "xi-api-key": env("ELEVENLABS_API_KEY"), "Content-Type": "application/json" },
      body: JSON.stringify({ text, model_id: VOZ.modelo_tts, language_code: VOZ.idioma }),
    },
  );
  if (!response.ok) throw new Error(`TTS ${voiceId} ${response.status} ${await response.text()}`);
  return await response.arrayBuffer();
}

// ---------- Rutas ----------

async function handleStt(req: Request): Promise<Response> {
  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > MAX_AUDIO_BYTES + 64 * 1024) return json({ error: "Audio de máximo 5 MB" }, 413);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ error: "Se espera multipart con el campo audio" }, 400);
  }
  const audio = form.get("audio");
  if (!(audio instanceof File) || audio.size === 0) return json({ error: "Falta audio" }, 400);
  if (audio.size > MAX_AUDIO_BYTES) return json({ error: "Audio de máximo 5 MB" }, 413);

  try {
    return json({ text: await speechToText(audio) });
  } catch (error) {
    console.error(error);
    return json({ error: "No se pudo transcribir el audio. Intenta de nuevo." }, 502);
  }
}

// La llave se queda aquí: el navegador solo recibe un token que caduca en 15 min.
async function handleToken(): Promise<Response> {
  try {
    const response = await fetch(`${ELEVEN}/single-use-token/realtime_scribe`, {
      method: "POST",
      headers: { "xi-api-key": env("ELEVENLABS_API_KEY") },
    });
    if (!response.ok) throw new Error(`token ${response.status} ${await response.text()}`);
    const { token } = await response.json();
    if (typeof token !== "string") throw new Error("token con forma inválida");
    return json({ token });
  } catch (error) {
    console.error(error);
    return json({ error: "No se pudo iniciar la transcripción en vivo" }, 502);
  }
}

async function handleTts(req: Request): Promise<Response> {
  let body: { text?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }
  const raw = typeof body.text === "string" ? body.text : "";
  if (raw.length > MAX_TEXT) return json({ error: `Máximo ${MAX_TEXT} caracteres` }, 400);
  const spoken = toSpoken(raw);
  if (!spoken) return json({ error: "Falta text" }, 400);

  for (const voiceId of [VOZ.voice_id, VOZ.voice_id_respaldo]) {
    try {
      const audio = await textToSpeech(spoken, voiceId);
      return new Response(audio, {
        headers: { ...corsHeaders, "Content-Type": "audio/mpeg" },
      });
    } catch (error) {
      console.error(error);
    }
  }
  return json({ error: "No se pudo generar el audio. Intenta de nuevo." }, 502);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!allowed(req)) return json({ error: "Origen no permitido" }, 403);
  if (req.method !== "POST") return json({ error: "Usa POST" }, 405);

  const path = new URL(req.url).pathname;
  if (path.endsWith("/stt")) return await handleStt(req);
  if (path.endsWith("/tts")) return await handleTts(req);
  if (path.endsWith("/token")) return await handleToken();
  return json({ error: "Ruta no encontrada: usa /voice/stt, /voice/tts o /voice/token" }, 404);
});
