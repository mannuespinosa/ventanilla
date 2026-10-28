import { useSyncExternalStore } from "react";
import { config } from "./config";

// Servicio de voz: STT/TTS contra la función `voice` y un solo reproductor para la app.
export const VOICE_URL: string = config.endpoints.voice;
export const MAX_RECORDING_SECONDS = 30;

export async function transcribe(audio: Blob): Promise<string> {
  const form = new FormData();
  const extension = audio.type.includes("mp4") ? "mp4" : "webm";
  form.append("audio", audio, `pregunta.${extension}`);
  const response = await fetch(`${VOICE_URL}/stt`, { method: "POST", body: form });
  if (!response.ok) throw new Error(`voice/stt respondió ${response.status}`);
  const { text } = ((await response.json()) ?? {}) as Record<string, unknown>;
  if (typeof text !== "string") throw new Error("Respuesta de voice/stt con forma inválida");
  return text.trim();
}

async function synthesize(text: string): Promise<Blob> {
  const response = await fetch(`${VOICE_URL}/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!response.ok) throw new Error(`voice/tts respondió ${response.status}`);
  return await response.blob();
}

// Formato que el navegador sabe grabar: webm/opus en Chrome y Firefox, mp4 en Safari.
export function recordingMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) => MediaRecorder.isTypeSupported(type));
}

// ---------- Reproductor ----------

export type Playback = { turnId: number | null; status: "idle" | "loading" | "playing" | "paused" };

// 10 ms de silencio: reproducirlo dentro de un clic "desbloquea" el elemento para el autoplay.
const SILENCE = "data:audio/wav;base64,UklGRnQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==";
const IDLE: Playback = { turnId: null, status: "idle" };

let audio: HTMLAudioElement | null = null;
let objectUrl: string | null = null;
let playback: Playback = IDLE;
// Cada stopSpeech() invalida las lecturas en curso, como requestRef en la página.
let generation = 0;
const listeners = new Set<() => void>();

function setPlayback(next: Playback) {
  playback = next;
  listeners.forEach((listener) => listener());
}

function releaseUrl() {
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = null;
}

// Llamar dentro del handler de un clic (el del micrófono).
export function unlockAudio() {
  if (audio || typeof Audio === "undefined") return;
  audio = new Audio();
  audio.addEventListener("ended", () => setPlayback(IDLE));
  audio.src = SILENCE;
  audio.play().catch(() => {});
}

export function stopSpeech() {
  generation += 1;
  audio?.pause();
  releaseUrl();
  if (playback.status !== "idle") setPlayback(IDLE);
}

// Lee `text` para el turno `turnId`. Resuelve true si empezó a sonar, false si se canceló.
export async function speak(turnId: number, text: string): Promise<boolean> {
  stopSpeech();
  const current = generation;
  if (!audio) throw new Error("El audio no se desbloqueó con un clic");
  setPlayback({ turnId, status: "loading" });
  try {
    const blob = await synthesize(text);
    if (generation !== current) return false;
    objectUrl = URL.createObjectURL(blob);
    audio.src = objectUrl;
    await audio.play();
    if (generation !== current) return false;
    setPlayback({ turnId, status: "playing" });
    return true;
  } catch (error) {
    if (generation === current) setPlayback(IDLE);
    throw error;
  }
}

export function togglePause() {
  if (!audio || playback.turnId === null) return;
  if (playback.status === "playing") {
    audio.pause();
    setPlayback({ ...playback, status: "paused" });
  } else if (playback.status === "paused") {
    audio.play().catch(() => setPlayback(IDLE));
    setPlayback({ ...playback, status: "playing" });
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePlayback(): Playback {
  return useSyncExternalStore(subscribe, () => playback, () => IDLE);
}
