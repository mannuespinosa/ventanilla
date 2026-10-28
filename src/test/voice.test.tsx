import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Index } from "@/routes/index";
import { Conversation } from "@/components/Conversation";
import { ask } from "@/lib/ask";
import { speak, stopSpeech, transcribe } from "@/lib/voice";
import { startLiveTranscription } from "@/lib/live-transcription";

vi.mock("@/lib/ask", () => ({ ask: vi.fn() }));
vi.mock("@/lib/live-transcription", () => ({ startLiveTranscription: vi.fn() }));
vi.mock("@/lib/voice", () => ({
  MAX_RECORDING_SECONDS: 30,
  recordingMimeType: () => "audio/webm;codecs=opus",
  transcribe: vi.fn(),
  speak: vi.fn(),
  stopSpeech: vi.fn(),
  unlockAudio: vi.fn(),
  togglePause: vi.fn(),
  usePlayback: () => ({ turnId: null, status: "idle" }),
}));

const ANSWER = { answer: "Cuesta $1,142 [1].", sources: [{ titulo: "Finanzas", url: "https://data.finanzas.cdmx.gob.mx" }], model: "gemma-4-26b-a4b-it" };

class FakeRecorder extends EventTarget {
  state: RecordingState = "inactive";
  mimeType = "audio/webm;codecs=opus";
  start() { this.state = "recording"; }
  stop() {
    this.state = "inactive";
    const data = new Event("dataavailable") as Event & { data: Blob };
    data.data = new Blob(["audio"], { type: this.mimeType });
    this.dispatchEvent(data);
    this.dispatchEvent(new Event("stop"));
  }
}

const getUserMedia = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal("MediaRecorder", FakeRecorder);
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });
  getUserMedia.mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] });
  vi.mocked(speak).mockResolvedValue(true);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });

function micButton(name = "Usar micrófono") {
  const button = screen.getAllByRole("button", { name })[0];
  if (!button) throw new Error(`Falta el botón ${name}`);
  return button;
}

// Graba `ms` milisegundos (con un Date falso) y deja el composer en modo grabación.
async function record(ms = 2000) {
  vi.useFakeTimers({ toFake: ["Date"] });
  await act(async () => fireEvent.click(micButton()));
  vi.setSystemTime(Date.now() + ms);
}

function send(question: string) {
  const input = screen.getAllByLabelText("Escribe tu pregunta")[0];
  if (!input) throw new Error("Question input missing");
  fireEvent.change(input, { target: { value: question } });
  const form = input.closest("form");
  if (!form) throw new Error("Question form missing");
  fireEvent.submit(form);
}

describe("voz", () => {
  it("transcribes a recording, asks with it and reads the answer aloud", async () => {
    vi.mocked(transcribe).mockResolvedValue("¿Cuánto cuesta la licencia tipo A?");
    vi.mocked(ask).mockResolvedValue(ANSWER);
    render(<Index />);

    await record();
    expect(screen.getAllByText("Escuchando…").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Enviar pregunta" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Adjuntar archivo" })).not.toBeInTheDocument();
    await act(async () => fireEvent.click(micButton("Enviar audio")));

    expect(transcribe).toHaveBeenCalledTimes(1);
    expect(ask).toHaveBeenCalledWith("¿Cuánto cuesta la licencia tipo A?", []);
    expect(screen.getByText("¿Cuánto cuesta la licencia tipo A?")).toBeInTheDocument();
    expect(speak).toHaveBeenCalledWith(expect.any(Number), "Cuesta $1,142 [1].");
    expect(screen.getByText("Respondido por Gemma 4 · modelo abierto · Voz: ElevenLabs")).toBeInTheDocument();
  });

  it("does not read typed questions aloud and stops any audio in progress", async () => {
    vi.mocked(ask).mockResolvedValue(ANSWER);
    render(<Index />);
    await act(async () => send("licencia"));
    expect(stopSpeech).toHaveBeenCalled();
    expect(speak).not.toHaveBeenCalled();
    expect(screen.getByText("Respondido por Gemma 4 · modelo abierto")).toBeInTheDocument();
  });

  it("reads only the main no-source sentence aloud on voice turns", async () => {
    vi.mocked(transcribe).mockResolvedValue("¿Cómo tramito mi pasaporte?");
    vi.mocked(ask).mockResolvedValue({ answer: "No encontré esto en las fuentes oficiales que tengo.", sources: [], model: "gemma-4-26b-a4b-it" });
    render(<Index />);
    await record();
    await act(async () => fireEvent.click(micButton("Enviar audio")));
    expect(speak).toHaveBeenCalledWith(expect.any(Number), "No encontré una fuente oficial para responder esto con seguridad. Prefiero no adivinar.");
    expect(screen.getByText("Respondido por Gemma 4 · modelo abierto · Voz: ElevenLabs")).toBeInTheDocument();
  });

  it("reads the referral authority aloud on voice turns, without the URL", async () => {
    vi.mocked(transcribe).mockResolvedValue("Renovación de pasaporte de mi hija");
    vi.mocked(ask).mockResolvedValue({
      answer: "No encontré esto en las fuentes oficiales que tengo.",
      sources: [],
      derivacion: {
        autoridad: "Secretaría de Relaciones Exteriores (SRE)",
        url: "https://www.gob.mx/pasaporte",
      },
    });
    render(<Index />);
    await record();
    await act(async () => fireEvent.click(micButton("Enviar audio")));
    expect(speak).toHaveBeenCalledWith(
      expect.any(Number),
      "No encontré una fuente oficial de la Ciudad de México para esto. Este trámite lo atiende Secretaría de Relaciones Exteriores (SRE).",
    );
    expect(vi.mocked(speak).mock.calls[0]?.[1]).not.toContain("gob.mx");
  });

  it("does not read typed no-source answers aloud", async () => {
    vi.mocked(ask).mockResolvedValue({ answer: "No encontré esto en las fuentes oficiales que tengo.", sources: [] });
    render(<Index />);
    await act(async () => send("pasaporte"));
    expect(screen.getByText(/No encontré una fuente oficial/)).toBeInTheDocument();
    expect(speak).not.toHaveBeenCalled();
  });

  it("cancels with ✕ silently, without calling STT", async () => {
    render(<Index />);
    await record();
    await act(async () => fireEvent.click(micButton("Cancelar grabación")));
    expect(transcribe).not.toHaveBeenCalled();
    expect(ask).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText("Escuchando…")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Usar micrófono" }).length).toBeGreaterThan(0);
  });

  it("cancels with Escape silently, without calling STT", async () => {
    render(<Index />);
    await record();
    await act(async () => fireEvent.keyDown(document, { key: "Escape" }));
    expect(transcribe).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText("Escuchando…")).not.toBeInTheDocument();
  });

  it("shows a spinner on ✓ while transcribing and sends without filling the input", async () => {
    let finish: (text: string) => void = () => {};
    vi.mocked(transcribe).mockReturnValue(new Promise((done) => { finish = done; }));
    vi.mocked(ask).mockReturnValue(new Promise(() => {}));
    render(<Index />);
    await record();
    await act(async () => fireEvent.click(micButton("Enviar audio")));
    expect(micButton("Transcribiendo audio")).toBeDisabled();
    await act(async () => finish("acta de nacimiento"));
    expect(ask).toHaveBeenCalledWith("acta de nacimiento", []);
    expect(screen.getByText("acta de nacimiento")).toBeInTheDocument();
    expect(screen.getAllByLabelText("Escribe tu pregunta").every((input) => (input as HTMLInputElement).value === "")).toBe(true);
  });

  it("says it could not hear only for recordings under half a second, below the composer", async () => {
    render(<Index />);
    await record(200);
    await act(async () => fireEvent.click(micButton("Enviar audio")));
    expect(transcribe).not.toHaveBeenCalled();
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("No alcancé a escucharte");
    expect(alert.previousElementSibling?.tagName).toBe("FORM");
  });

  it("explains when microphone permission is denied", async () => {
    getUserMedia.mockRejectedValue(new DOMException("denied", "NotAllowedError"));
    render(<Index />);
    await act(async () => fireEvent.click(micButton()));
    expect(screen.getByRole("alert")).toHaveTextContent("No tengo permiso para usar el micrófono");
    expect(ask).not.toHaveBeenCalled();
  });

  it("keeps the written answer when reading it aloud fails", async () => {
    vi.mocked(transcribe).mockResolvedValue("licencia");
    vi.mocked(ask).mockResolvedValue(ANSWER);
    vi.mocked(speak).mockRejectedValue(new Error("tts 502"));
    render(<Index />);
    await record();
    await act(async () => fireEvent.click(micButton("Enviar audio")));
    expect(screen.getByText(/Cuesta \$1,142/)).toBeInTheDocument();
    expect(screen.getByText(/No pude leer la respuesta en voz alta/)).toBeInTheDocument();
    expect(screen.queryByText(/Voz: ElevenLabs/)).not.toBeInTheDocument();
  });

  it("shows the voice attribution only on answers read aloud", () => {
    render(
      <Conversation
        turns={[
          { id: 1, question: "a", response: ANSWER, viaVoz: true, voz: "leida" },
          { id: 2, question: "b", response: ANSWER },
        ]}
        pending={false}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getAllByText(/Voz: ElevenLabs/)).toHaveLength(1);
  });

  describe("en vivo", () => {
    class FakeAudioContext {
      sampleRate = 48000;
      resume() { return Promise.resolve(); }
      close() { return Promise.resolve(); }
      createAnalyser() { return { fftSize: 0, smoothingTimeConstant: 0, frequencyBinCount: 128, getByteFrequencyData: () => {} }; }
      createMediaStreamSource() { return { connect: () => {} }; }
    }

    beforeEach(() => {
      vi.stubGlobal("AudioContext", FakeAudioContext);
      vi.stubGlobal("requestAnimationFrame", () => 0);
      vi.stubGlobal("cancelAnimationFrame", () => {});
    });

    it("shows the live text while speaking and sends the committed text with ✓", async () => {
      let show: (text: string) => void = () => {};
      vi.mocked(startLiveTranscription).mockImplementation((_stream, _context, onText) => {
        show = onText;
        return { finish: vi.fn().mockResolvedValue("¿Cuánto cuesta la licencia?"), close: vi.fn() };
      });
      vi.mocked(ask).mockReturnValue(new Promise(() => {}));
      render(<Index />);
      await record();
      await act(async () => show("¿Cuánto cuesta"));
      expect(screen.getAllByText("¿Cuánto cuesta").length).toBeGreaterThan(0);
      expect(screen.queryByText("Escuchando…")).not.toBeInTheDocument();
      await act(async () => fireEvent.click(micButton("Enviar audio")));
      expect(ask).toHaveBeenCalledWith("¿Cuánto cuesta la licencia?", []);
      expect(transcribe).not.toHaveBeenCalled();
    });

    it("falls back silently to /voice/stt when the live session fails", async () => {
      vi.mocked(startLiveTranscription).mockReturnValue({ finish: vi.fn().mockRejectedValue(new Error("ws")), close: vi.fn() });
      vi.mocked(transcribe).mockResolvedValue("acta de nacimiento");
      vi.mocked(ask).mockReturnValue(new Promise(() => {}));
      render(<Index />);
      await record();
      await act(async () => fireEvent.click(micButton("Enviar audio")));
      expect(transcribe).toHaveBeenCalledTimes(1);
      expect(ask).toHaveBeenCalledWith("acta de nacimiento", []);
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("falls back silently when the live session cannot start", async () => {
      vi.mocked(startLiveTranscription).mockImplementation(() => { throw new Error("sin token"); });
      vi.mocked(transcribe).mockResolvedValue("licencia");
      vi.mocked(ask).mockReturnValue(new Promise(() => {}));
      render(<Index />);
      await record();
      expect(screen.getAllByText("Escuchando…").length).toBeGreaterThan(0);
      await act(async () => fireEvent.click(micButton("Enviar audio")));
      expect(ask).toHaveBeenCalledWith("licencia", []);
    });

    it("closes the live session without sending when cancelled", async () => {
      const close = vi.fn();
      const finish = vi.fn();
      vi.mocked(startLiveTranscription).mockReturnValue({ finish, close });
      render(<Index />);
      await record();
      await act(async () => fireEvent.click(micButton("Cancelar grabación")));
      expect(close).toHaveBeenCalled();
      expect(finish).not.toHaveBeenCalled();
      expect(ask).not.toHaveBeenCalled();
    });
  });
});
