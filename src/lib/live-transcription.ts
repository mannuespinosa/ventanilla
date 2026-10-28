import { config } from "./config";

// Transcripción en vivo con Scribe v2 Realtime (SDK oficial @elevenlabs/client).
// El audio sale del mismo stream que graba el respaldo: se guarda desde el primer
// instante y se envía al abrir la sesión, así no se pierden las primeras palabras.
// Cualquier falla rechaza finish() y quien llama vuelve en silencio a /voice/stt.

// Límites del modo en vivo: hasta 50 términos de máximo 20 caracteres.
const KEYTERMS = config.voz.terminosClave.filter((term) => term.length <= 20).slice(0, 50);
const SAMPLE_RATES = [16000, 22050, 24000, 44100, 48000];
const CONNECT_TIMEOUT_MS = 5000;
const COMMIT_TIMEOUT_MS = 4000;

export type LiveTranscription = {
  // Detiene la captura, hace commit y resuelve con el texto final.
  finish: () => Promise<string>;
  close: () => void;
};

async function fetchToken(): Promise<string> {
  const response = await fetch(`${config.endpoints.voice}/token`, { method: "POST" });
  if (!response.ok) throw new Error(`voice/token respondió ${response.status}`);
  const { token } = ((await response.json()) ?? {}) as Record<string, unknown>;
  if (typeof token !== "string") throw new Error("Respuesta de voice/token con forma inválida");
  return token;
}

function toBase64Pcm16(samples: Float32Array): string {
  const pcm = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i] ?? 0));
    pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  const bytes = new Uint8Array(pcm.buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

// `onText` recibe el texto acumulado (confirmado + parcial) cada vez que cambia.
export function startLiveTranscription(stream: MediaStream, context: AudioContext, onText: (text: string) => void): LiveTranscription {
  const sampleRate = context.sampleRate;
  if (!SAMPLE_RATES.includes(sampleRate)) throw new Error(`Frecuencia ${sampleRate} no soportada`);

  const committed: string[] = [];
  let partial = "";
  const pending: string[] = [];
  let failed: Error | null = null;
  let closed = false;
  let connection: import("@elevenlabs/client").RealtimeConnection | null = null;
  let started = false;
  const waiters = new Set<{ resolve: () => void; reject: (error: Error) => void; on: "started" | "committed" }>();

  const emit = () => onText([...committed, partial].filter(Boolean).join(" "));
  const notify = (on: "started" | "committed") => waiters.forEach((w) => {
    if (w.on === on) { waiters.delete(w); w.resolve(); }
  });
  const fail = (error: Error) => {
    if (failed || closed) return;
    failed = error;
    waiters.forEach((w) => w.reject(error));
    waiters.clear();
  };
  const waitFor = (on: "started" | "committed", ms: number) => new Promise<void>((resolve, reject) => {
    if (failed) return reject(failed);
    const waiter = { resolve, reject, on };
    waiters.add(waiter);
    window.setTimeout(() => {
      if (waiters.delete(waiter)) reject(new Error(`Tiempo agotado esperando ${on}`));
    }, ms);
  });

  const flush = () => {
    while (connection && started && pending.length) connection.send({ audioBase64: pending.shift() ?? "" });
  };

  // Captura: ScriptProcessor es viejo pero funciona igual en Chrome y Safari, sin worklets.
  const source = context.createMediaStreamSource(stream);
  const processor = context.createScriptProcessor(4096, 1, 1);
  processor.onaudioprocess = (event) => {
    if (failed || closed) return;
    pending.push(toBase64Pcm16(event.inputBuffer.getChannelData(0)));
    try {
      flush();
    } catch (error) {
      fail(error instanceof Error ? error : new Error(String(error)));
    }
  };
  source.connect(processor);
  processor.connect(context.destination);
  const stopCapture = () => {
    processor.onaudioprocess = null;
    source.disconnect();
    processor.disconnect();
  };

  const connected = Promise.all([fetchToken(), import("@elevenlabs/client")])
    .then(([token, { Scribe, RealtimeEvents, CommitStrategy, AudioFormat }]) => {
      if (closed || failed) return;
      const current = Scribe.connect({
        token,
        modelId: config.voz.modeloRealtime,
        languageCode: config.voz.idioma,
        keyterms: KEYTERMS,
        commitStrategy: CommitStrategy.MANUAL,
        audioFormat: `pcm_${sampleRate}` as (typeof AudioFormat)[keyof typeof AudioFormat],
        sampleRate,
      });
      connection = current;
      current.on(RealtimeEvents.SESSION_STARTED, () => {
        started = true;
        try {
          flush();
          notify("started");
        } catch (error) {
          fail(error instanceof Error ? error : new Error(String(error)));
        }
      });
      current.on(RealtimeEvents.PARTIAL_TRANSCRIPT, (data) => {
        partial = data.text;
        emit();
      });
      current.on(RealtimeEvents.COMMITTED_TRANSCRIPT, (data) => {
        if (data.text.trim()) committed.push(data.text.trim());
        partial = "";
        emit();
        notify("committed");
      });
      current.on(RealtimeEvents.ERROR, (error) => fail(new Error(`Scribe: ${JSON.stringify(error)}`)));
      current.on(RealtimeEvents.CLOSE, () => fail(new Error("Scribe cerró la conexión")));
    })
    .catch((error: unknown) => fail(error instanceof Error ? error : new Error(String(error))));

  const close = () => {
    if (closed) return;
    closed = true;
    stopCapture();
    waiters.clear();
    try {
      connection?.close();
    } catch {
      // ya cerrada
    }
  };

  const finish = async () => {
    stopCapture();
    try {
      await connected;
      if (!started) await waitFor("started", CONNECT_TIMEOUT_MS);
      if (failed) throw failed;
      flush();
      const done = waitFor("committed", COMMIT_TIMEOUT_MS);
      connection?.commit();
      await done;
      const text = committed.join(" ").trim();
      if (!text) throw new Error("Transcripción en vivo vacía");
      return text;
    } finally {
      close();
    }
  };

  return { finish, close };
}
