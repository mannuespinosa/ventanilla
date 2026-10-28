import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_RECORDING_SECONDS, recordingMimeType, stopSpeech, transcribe, unlockAudio } from "@/lib/voice";

export type RecorderStatus = "idle" | "recording" | "transcribing";

// Un clic graba y otro detiene (o se corta solo a los 30 s); el texto transcrito va a onText.
export function useVoiceRecorder(onText: (text: string) => void) {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timersRef = useRef<{ tick?: number; limit?: number }>({});
  const startingRef = useRef(false);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;
  const mountedRef = useRef(true);

  const clearTimers = () => {
    window.clearInterval(timersRef.current.tick);
    window.clearTimeout(timersRef.current.limit);
    timersRef.current = {};
  };

  const stop = useCallback(() => {
    clearTimers();
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimers();
      const recorder = recorderRef.current;
      recorderRef.current = null;
      if (recorder && recorder.state !== "inactive") recorder.stop();
    };
  }, []);

  const start = useCallback(async () => {
    // Dentro del clic: desbloquea el audio para leer la respuesta y calla la anterior.
    unlockAudio();
    stopSpeech();
    setError(null);

    if (startingRef.current) return;
    const mimeType = recordingMimeType();
    if (!mimeType || !navigator.mediaDevices?.getUserMedia) {
      setError("Tu navegador no permite grabar audio. Escribe tu pregunta.");
      return;
    }

    let stream: MediaStream;
    startingRef.current = true;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (cause) {
      startingRef.current = false;
      const denied = cause instanceof DOMException && (cause.name === "NotAllowedError" || cause.name === "SecurityError");
      setError(denied
        ? "No tengo permiso para usar el micrófono. Actívalo en tu navegador o escribe tu pregunta."
        : "No encontré un micrófono disponible. Escribe tu pregunta.");
      return;
    }
    startingRef.current = false;
    if (!mountedRef.current) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks: Blob[] = [];
    recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    });
    recorder.addEventListener("stop", async () => {
      stream.getTracks().forEach((track) => track.stop());
      if (recorderRef.current !== recorder) return;
      recorderRef.current = null;
      const audio = new Blob(chunks, { type: recorder.mimeType || mimeType });
      if (audio.size === 0) {
        setStatus("idle");
        return;
      }
      setStatus("transcribing");
      try {
        const text = await transcribe(audio);
        if (!mountedRef.current) return;
        if (text) onTextRef.current(text);
        else setError("No alcancé a escucharte. Intenta de nuevo o escribe tu pregunta.");
      } catch {
        if (mountedRef.current) setError("No pude transcribir el audio. Intenta de nuevo o escribe tu pregunta.");
      } finally {
        if (mountedRef.current) setStatus("idle");
      }
    });

    recorderRef.current = recorder;
    recorder.start();
    setSeconds(0);
    setStatus("recording");
    const startedAt = Date.now();
    timersRef.current = {
      tick: window.setInterval(() => {
        setSeconds(Math.min(MAX_RECORDING_SECONDS, Math.floor((Date.now() - startedAt) / 1000)));
      }, 250),
      limit: window.setTimeout(stop, MAX_RECORDING_SECONDS * 1000),
    };
  }, [stop]);

  const toggle = useCallback(() => {
    if (status === "recording") stop();
    else if (status === "idle") void start();
  }, [status, start, stop]);

  return { status, seconds, error, toggle };
}
