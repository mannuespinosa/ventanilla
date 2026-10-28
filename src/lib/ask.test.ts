import { afterEach, describe, expect, it, vi } from "vitest";
import { ask } from "./ask";

afterEach(() => vi.useRealTimers());

describe("ask contract", () => {
  it("waits 1.2 seconds before answering", async () => {
    vi.useFakeTimers();
    const settled = vi.fn();
    const response = ask("licencia").then(settled);
    await vi.advanceTimersByTimeAsync(1199);
    expect(settled).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await response;
    expect(settled).toHaveBeenCalledOnce();
  });

  it.each([["LICENCIA de conducir", 2], ["acta de nacimiento", 1], ["tenencia", 1]] as const)(
    "returns official-portal placeholder sources for %s", async (question, count) => {
      vi.useFakeTimers();
      const pending = ask(question);
      await vi.advanceTimersByTimeAsync(1200);
      const result = await pending;
      expect(result.sources).toHaveLength(count);
      expect(result.answer.length).toBeGreaterThan(0);
      expect(result.sources.every((source) => source.url === "https://tramites.cdmx.gob.mx")).toBe(true);
    },
  );

  it("returns an empty answer and sources for an unknown question", async () => {
    vi.useFakeTimers();
    const pending = ask("¿Dónde compro café?");
    await vi.advanceTimersByTimeAsync(1200);
    expect(await pending).toEqual({ answer: "", sources: [] });
  });
});