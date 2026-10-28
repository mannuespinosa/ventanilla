import { afterEach, describe, expect, it, vi } from "vitest";
import { ASK_URL, ask } from "./ask";

afterEach(() => vi.unstubAllGlobals());

function mockFetch(status: number, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("ask contract", () => {
  it("posts the question to the ask function", async () => {
    const fetchMock = mockFetch(200, { answer: "Respuesta", sources: [] });
    await ask("¿Cuánto cuesta la licencia?");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(ASK_URL);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ question: "¿Cuánto cuesta la licencia?" });
  });

  it("returns the answer and official sources", async () => {
    const sources = [
      {
        titulo: "Licencias",
        url: "https://data.finanzas.cdmx.gob.mx/formato_lc/conceptos/licencias",
      },
    ];
    mockFetch(200, { answer: "Cuesta $1,142.00.", sources });
    expect(await ask("licencia")).toEqual({ answer: "Cuesta $1,142.00.", sources });
  });

  it("keeps an empty sources list so the UI shows the no-source message", async () => {
    mockFetch(200, { answer: "No encontré esto en las fuentes oficiales que tengo.", sources: [] });
    expect((await ask("¿Dónde compro café?")).sources).toEqual([]);
  });

  it("drops malformed sources", async () => {
    mockFetch(200, {
      answer: "Hola",
      sources: [
        { titulo: "Ok", url: "https://cdmx.gob.mx" },
        { titulo: "Mal", url: "javascript:alert(1)" },
        null,
      ],
    });
    expect((await ask("hola")).sources).toEqual([{ titulo: "Ok", url: "https://cdmx.gob.mx" }]);
  });

  it("throws on a non-200 response", async () => {
    mockFetch(502, { error: "El modelo no respondió." });
    await expect(ask("licencia")).rejects.toThrow("502");
  });

  it("throws on a response without answer and sources", async () => {
    mockFetch(200, { error: "raro" });
    await expect(ask("licencia")).rejects.toThrow("forma inválida");
  });
});
