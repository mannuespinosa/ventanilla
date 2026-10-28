import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_RECORDING_SECONDS, recordingMimeType, stopSpeech, transcribe, unlockAudio } from "@/lib/voice";

export type RecorderStatus = "idle" | "recording" | "transcribing";

// Menos que esto no alcanza para una pregunta: se avisa sin llamar a STT.
const MIN_RECORDING_MS = 500;
const TOO_SHORT = "No alcancé a escucharte. Intenta de nuevo o escribe tu pregunta.";

type Session = {
  recorder: MediaRecorder;
  stream: MediaStream;
  context: AudioContext | null;
  startedAt: number;
  // "send": ✓ (o el corte de 30 s) transcribe y envía; "discard": ✕ o Escape.
  outcome: "send" | "discard";
};

// start() empieza a grabar; confirm() detiene, transcribe y manda el texto a onText;
// cancel() descarta el audio en silencio.
export function useVoiceRecorder(onText: (text: string) => void) {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const timersRef = useRef<{ tick?: number; limit?: number }>({});
  const startingRef = useRef(false);
  // Sube al cancelar o desmontar: una transcripción vieja ya no se envía.
  const generationRef = useRef(0);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  const finish = useCallback((outcome: Session["outcome"]) => {
    const session = sessionRef.current;
    if (!session) return;
    window.clearInterval(timersRef.current.tick);
    window.clearTimeout(timersRef.current.limit);
    timersRef.current = {};
    session.outcome = outcome;
    if (session.recorder.state !== "inactive") session.recorder.stop();
  }, []);

  const confirm = useCallback(() => finish("send"), [finish]);

  const cancel = useCallback(() => {
    generationRef.current += 1;
    finish("discard");
    setStatus("idle");
  }, [finish]);

  useEffect(() => () => {
    generationRef.current += 1;
    finish("discard");
  }, [finish]);

  // Escape cancela mientras se graba o transcribe.
  useEffect(() => {
    if (status === "idle") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") cancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [status, cancel]);

  const start = useCallback(async () => {
    // Dentro del clic: desbloquea el audio para leer la respuesta y calla la anterior.
    unlockAudio();
    stopSpeech();
    setError(null);
    if (startingRef.current || sessionRef.current) return;

    const mimeType = recordingMimeType();
    if (!mimeType || !navigator.mediaDevices?.getUserMedia) {
      setError("Tu navegador no permite grabar audio. Escribe tu pregunta.");
      return;
    }
    // También dentro del clic, para que Safari permita el AudioContext.
    const context = typeof AudioContext === "undefined" ? null : new AudioContext();
    const generation = generationRef.current;

    let stream: MediaStream;
    startingRef.current = true;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (cause) {
      void context?.close();
      const denied = cause instanceof DOMException && (cause.name === "NotAllowedError" || cause.name === "SecurityError");
      setError(denied
        ? "No tengo permiso para usar el micrófono. Actívalo en tu navegador o escribe tu pregunta."
        : "No encontré un micrófono disponible. Escribe tu pregunta.");
      return;
    } finally {
      startingRef.current = false;
    }
    if (generationRef.current !== generation) {
      stream.getTracks().forEach((track) => track.stop());
      void context?.close();
      return;
    }

    let node: AnalyserNode | null = null;
    if (context) {
      node = context.createAnalyser();
      node.fftSize = 256;
      node.smoothingTimeConstant = 0.6;
      context.createMediaStreamSource(stream).connect(node);
    }

    const recorder = new MediaRecorder(stream, { mimeType });
    const session: Session = { recorder, stream, context, startedAt: Date.now(), outcome: "send" };
    const chunks: Blob[] = [];
    recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    });
    recorder.addEventListener("stop", async () => {
      stream.getTracks().forEach((track) => track.stop());
      void context?.close();
      if (sessionRef.current === session) sessionRef.current = null;
      setAnalyser(null);
      if (session.outcome === "discard" || generationRef.current !== generation) return;

      const audio = new Blob(chunks, { type: recorder.mimeType || mimeType });
      if (Date.now() - session.startedAt < MIN_RECORDING_MS || audio.size === 0) {
        setError(TOO_SHORT);
        setStatus("idle");
        return;
      }
      setStatus("transcribing");
      try {
        const text = await transcribe(audio);
        if (generationRef.current !== generation) return;
        if (text) onTextRef.current(text);
        else setError(TOO_SHORT);
      } catch {
        if (generationRef.current === generation) setError("No pude transcribir el audio. Intenta de nuevo o escribe tu pregunta.");
      } finally {
        if (generationRef.current === generation) setStatus("idle");
      }
    });

    sessionRef.current = session;
    recorder.start();
    setAnalyser(node);
    setSeconds(0);
    setStatus("recording");
    timersRef.current = {
      tick: window.setInterval(() => {
        setSeconds(Math.min(MAX_RECORDING_SECONDS, Math.floor((Date.now() - session.startedAt) / 1000)));
      }, 250),
      limit: window.setTimeout(confirm, MAX_RECORDING_SECONDS * 1000),
    };
  }, [confirm]);

  return { status, seconds, error, analyser, start, confirm, cancel };
}
