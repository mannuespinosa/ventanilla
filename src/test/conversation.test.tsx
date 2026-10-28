import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Index } from "@/routes/index";
import { Conversation } from "@/components/Conversation";
import { ask, type AskResponse } from "@/lib/ask";

vi.mock("@/lib/ask", () => ({ ask: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
  window.matchMedia = vi.fn().mockReturnValue({ matches: true });
});
afterEach(cleanup);

function deferred() {
  let resolve: (response: AskResponse) => void = () => {};
  const promise = new Promise<AskResponse>((done) => { resolve = done; });
  return { promise, resolve };
}

function send(question: string) {
  const input = screen.getAllByLabelText("Escribe tu pregunta")[0];
  fireEvent.change(input, { target: { value: question } });
  fireEvent.submit(input.closest("form") as HTMLFormElement);
}

describe("conversation rules", () => {
  it("never displays an answer without sources", () => {
    render(<Conversation turns={[{ id: 1, question: "Pregunta", response: { answer: "UNSUPPORTED_ANSWER", sources: [] } }]} pending={false} onSubmit={vi.fn()} />);
    expect(screen.queryByText("UNSUPPORTED_ANSWER")).not.toBeInTheDocument();
    expect(screen.getByRole("log").querySelector("a")).toBeNull();
  });

  it("blocks new questions while a response is pending", async () => {
    const response = deferred();
    vi.mocked(ask).mockReturnValue(response.promise);
    render(<Index />);
    send("licencia");
    expect(screen.getAllByLabelText("Escribe tu pregunta").every((input) => input.hasAttribute("disabled"))).toBe(true);
    send("acta");
    expect(ask).toHaveBeenCalledTimes(1);
    await act(async () => response.resolve({ answer: "Respuesta", sources: [{ titulo: "Fuente", url: "https://tramites.cdmx.gob.mx" }] }));
    expect(screen.getAllByLabelText("Escribe tu pregunta").every((input) => !input.hasAttribute("disabled"))).toBe(true);
  });

  it("clears conversation and ignores late answers after returning home", async () => {
    const response = deferred();
    vi.mocked(ask).mockReturnValue(response.promise);
    render(<Index />);
    send("licencia");
    fireEvent.click(screen.getByRole("button", { name: "Ventanilla" }));
    expect(screen.queryByRole("log")).not.toBeInTheDocument();
    await act(async () => response.resolve({ answer: "STALE_ANSWER", sources: [{ titulo: "Fuente", url: "https://tramites.cdmx.gob.mx" }] }));
    expect(screen.queryByRole("log")).not.toBeInTheDocument();
    expect(screen.queryByText("STALE_ANSWER")).not.toBeInTheDocument();
  });

  it("sends with Enter but preserves Shift+Enter for a newline", () => {
    vi.mocked(ask).mockReturnValue(new Promise(() => {}));
    render(<Index />);
    const input = screen.getAllByLabelText("Escribe tu pregunta")[0];
    fireEvent.change(input, { target: { value: "tenencia" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect(ask).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(ask).toHaveBeenCalledWith("tenencia");
  });
});