import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Index } from "@/routes/index";
import { Conversation } from "@/components/Conversation";
import { ask } from "@/lib/ask";
import { speak, stopSpeech, transcribe } from "@/lib/voice";

vi.mock("@/lib/ask", () => ({ ask: vi.fn() }));
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
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function micButton(name = "Usar micrófono") {
  const button = screen.getAllByRole("button", { name })[0];
  if (!button) throw new Error(`Falta el botón ${name}`);
  return button;
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

    await act(async () => fireEvent.click(micButton()));
    expect(micButton("Detener grabación")).toHaveTextContent("0:00");
    await act(async () => fireEvent.click(micButton("Detener grabación")));

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
    await act(async () => fireEvent.click(micButton()));
    await act(async () => fireEvent.click(micButton("Detener grabación")));
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
});
