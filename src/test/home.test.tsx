import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Index } from "@/routes/index";
import { ask } from "@/lib/ask";

vi.mock("@/lib/ask", () => ({ ask: vi.fn() }));
let notify: IntersectionObserverCallback;
let observed: Element;
beforeEach(() => {
  vi.mocked(ask).mockReturnValue(new Promise(() => {}));
  window.matchMedia = vi.fn().mockReturnValue({ matches: true });
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal("IntersectionObserver", class {
    constructor(callback: IntersectionObserverCallback) { notify = callback; }
    observe(element: Element) { observed = element; }
    disconnect() {}
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
function leaveHero() {
  act(() => notify([{ target: observed, isIntersecting: false, boundingClientRect: { bottom: -1 } } as IntersectionObserverEntry], {} as IntersectionObserver));
}

describe("home behavior", () => {
  it("shares the exact draft between hero and fixed composers in both directions", () => {
    render(<Index />);
    const hero = screen.getAllByLabelText("Escribe tu pregunta")[0];
    if (!hero) throw new Error("Missing hero input");
    fireEvent.change(hero, { target: { value: "Renovar mi licencia" } });
    expect(screen.queryByTestId("home-fixed-input")).toBeNull();
    leaveHero();
    const fixed = screen.getByTestId("home-fixed-input").querySelector("textarea");
    if (!fixed) throw new Error("Missing fixed input");
    expect(fixed.value).toBe("Renovar mi licencia");
    fireEvent.change(fixed, { target: { value: "Pagar el predial" } });
    expect(hero).toHaveValue("Pagar el predial");
    act(() => notify([{ target: observed, isIntersecting: true, boundingClientRect: { bottom: 200 } } as IntersectionObserverEntry], {} as IntersectionObserver));
    expect(screen.queryByTestId("home-fixed-input")).toBeNull();
  });

  it("submits the shared draft and removes all home-only sections in conversation", () => {
    render(<Index />);
    leaveHero();
    const fixed = screen.getByTestId("home-fixed-input").querySelector("textarea");
    if (!fixed) throw new Error("Missing fixed input");
    fireEvent.change(fixed, { target: { value: "tenencia" } });
    fireEvent.keyDown(fixed, { key: "Enter" });
    expect(ask).toHaveBeenCalledWith("tenencia");
    expect(screen.getByRole("log")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Manifiesto" })).toBeNull();
    expect(screen.queryByTestId("home-fixed-input")).toBeNull();
    expect(screen.queryByRole("contentinfo")).toBeNull();
  });
});